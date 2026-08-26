"""
background_remover.py
----------------------
Remoção de fundo SEM inteligência artificial / modelo de machine learning.
Usa técnicas de visão computacional clássica, sem download de modelo
nenhum, organizadas em camadas incrementais:

  CAMADA 1 — base clássica (usada pelo modo "automatico" e como ponto de
  partida do modo "inteligente"):

  1. Flood fill a partir das bordas da imagem (por similaridade de cor)
     Começa em vários pontos ao longo da moldura da foto e "anda" por
     regiões de cor parecida, marcando como "fundo garantido" tudo que
     estiver conectado à borda por cor semelhante. Isso identifica com
     precisão fundo uniforme, fundo com leve gradiente/sombra de estúdio,
     e também elementos soltos (como uma etiqueta clara encostada no
     produto) que estejam conectados à borda pela mesma cor — sem invadir
     o produto principal, porque uma mudança brusca de cor interrompe o
     "vazamento" do flood fill.

  2. GrabCut guiado por máscara (OpenCV)
     Usa o mapa de "fundo garantido" do passo 1 como ponto de partida
     (em vez de um retângulo genérico) e refina o contorno final com o
     algoritmo GrabCut, que ajusta a borda com base em estatística de cor
     (modelos de mistura gaussiana) — sem rede neural, sem modelo
     baixado, só matemática rodando na própria imagem.

  3. Maior componente conectado + preenchimento de buracos internos.

  CAMADA 2 — refinamento "inteligente" (modo "inteligente"), adicionada
  por cima da Camada 1 sem substituí-la:

  4. Isolamento do objeto principal por "pescoço fino" (ver
     `_isolar_objeto_principal_por_pescoco`): quando um objeto secundário
     (etiqueta, cartão, suporte, embalagem...) está encostado ou atrás do
     produto principal, GrabCut costuma fundir os dois num único blob de
     foreground. Esta etapa detecta topologicamente essa fusão — via
     erosão progressiva até a máscara se partir em componentes separados
     — e reconstrói apenas o "núcleo" do maior componente de volta ao seu
     tamanho original (reconstrução morfológica), descartando a parte que
     só estava ligada por uma conexão estreita. É puramente geométrico:
     não depende de cor, não usa coordenadas fixas e generaliza para
     qualquer imagem com essa estrutura (produto + objeto encostado).

  5. Reforço opcional por silhueta poligonal (ver
     `_refinar_por_silhueta_poligonal`): quando o contorno resultante se
     aproxima com alta confiança de um polígono convexo simples (produto
     de forma retangular/quadrilateral, por exemplo), usa esse polígono
     como heurística adicional para descartar regiões claramente
     externas à silhueta. É apenas um reforço de confiança — nunca a
     única fonte de decisão — e não assume que todo produto é retangular.

  6. Sistema de confiança: cada corte da Camada 2 recebe uma pontuação.
     Se a confiança for baixa (ex.: o "corte" removeria parte demais do
     objeto principal), o resultado da Camada 2 é descartado e o
     pipeline volta para o resultado mais conservador da Camada 1 —
     nunca o contrário. Isso segue a regra de preferir deixar um resíduo
     de fundo a arriscar destruir parte do produto.

Mantido com a mesma assinatura pública de antes (remover_fundo /
ErroRemocaoFundo) para que app.py não precise de nenhuma alteração
obrigatória — `remover_fundo` ganhou um parâmetro `modo` opcional, mas
continua funcionando exatamente como antes se chamado sem argumentos
extras.

Trade-off consciente: isso não iguala a precisão de modelos de IA em
cabelo/pelos muito finos, mas é bem mais fiel do que um retângulo cego,
especialmente em fotos de produto com elementos soltos encostados
(etiquetas, tags, fitas), objetos parcialmente atrás do produto e fundos
não perfeitamente uniformes.
"""

import numpy as np
import cv2
from PIL import Image, ImageOps


class ErroRemocaoFundo(Exception):
    """Erro amigável e específico de uma imagem durante a remoção de fundo."""


# Modos de remoção suportados. Mantido como conjunto simples (não Enum)
# para não impor nenhuma dependência nova nem mudar a assinatura pública.
MODOS_VALIDOS = {"automatico", "inteligente", "manual"}


def _mascara_fundo_por_flood_fill(arr_bgr, tolerancia=18, passo_semente=12):
    """
    Marca como "fundo garantido" (255) toda região conectada à borda da
    imagem por similaridade de cor, partindo de vários pontos ao longo da
    moldura (não só os 4 cantos) — assim cobre fundos com leve gradiente
    ou sombra sem precisar ser perfeitamente uniformes.

    Retorna uma máscara uint8 (mesmo tamanho da imagem): 255 = fundo
    garantido, 0 = incerto/provável objeto.
    """
    h, w = arr_bgr.shape[:2]
    mascara_cv = np.zeros((h + 2, w + 2), np.uint8)
    # FLOODFILL_FIXED_RANGE é essencial aqui: sem ela, o OpenCV compara
    # cada pixel novo com o vizinho já preenchido (não com a cor original
    # da semente), o que causa "vazamento por gradiente" — em bordas com
    # sombra/luz suave, o preenchimento vai "andando" e pode atravessar
    # até o objeto principal. Com a flag fixa, a comparação é sempre
    # contra a cor original de cada semente, contendo o preenchimento.
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)
    diff = (tolerancia, tolerancia, tolerancia)

    sementes = set()
    for x in range(0, w, passo_semente):
        sementes.add((x, 0))
        sementes.add((x, h - 1))
    for y in range(0, h, passo_semente):
        sementes.add((0, y))
        sementes.add((w - 1, y))

    imagem_trabalho = arr_bgr.copy()
    for (x, y) in sementes:
        if mascara_cv[y + 1, x + 1] == 0:
            cv2.floodFill(
                imagem_trabalho, mascara_cv, (x, y), 0,
                loDiff=diff, upDiff=diff, flags=flags,
            )

    return mascara_cv[1:-1, 1:-1]


def _preencher_buracos_internos(mascara_binaria):
    """
    Preenche "buracos" de fundo cercados por todos os lados pelo objeto —
    o caso clássico é o miolo das letras de um rótulo (o "O" de "PEPINO",
    por exemplo), que o GrabCut às vezes classifica como fundo só porque a
    cor ali é parecida com a cor do fundo real da foto, mesmo sem ter
    NENHUMA conexão física com a borda da imagem.

    A lógica: qualquer pixel de fundo (0) que não seja alcançável a partir
    da borda da imagem por um flood fill não pode ser fundo de verdade —
    fundo de verdade é sempre contíguo até a moldura da foto. Esses pixels
    "presos" são então promovidos a objeto (255).
    """
    h, w = mascara_binaria.shape
    mascara_flood = np.zeros((h + 2, w + 2), np.uint8)
    trabalho = mascara_binaria.copy()

    passo = max(2, min(h, w) // 150)
    sementes = set()
    for x in range(0, w, passo):
        sementes.add((x, 0))
        sementes.add((x, h - 1))
    for y in range(0, h, passo):
        sementes.add((0, y))
        sementes.add((w - 1, y))

    for (x, y) in sementes:
        if trabalho[y, x] == 0 and mascara_flood[y + 1, x + 1] == 0:
            cv2.floodFill(trabalho, mascara_flood, (x, y), 128)

    # tudo que continua 0 não foi alcançado a partir da borda: é um buraco
    # interno, não fundo de verdade.
    buracos_internos = trabalho == 0
    resultado = mascara_binaria.copy()
    resultado[buracos_internos] = 255
    return resultado


def _mascara_binaria_bruta(trabalho, h_r, w_r, iteracoes=6, tolerancia_flood=18):
    """
    Etapas 1+2+3 da Camada 1 (flood fill -> GrabCut -> maior componente
    conectado), retornando a máscara binária 0/255 ANTES do preenchimento
    de buracos e da suavização final. Extraída como função própria para
    ser reaproveitada tanto pelo modo "automatico" quanto como ponto de
    partida do modo "inteligente" — nenhuma das duas técnicas é refeita
    do zero, apenas reaproveitada.

    `trabalho` já deve estar na resolução reduzida (ou original, se a
    imagem já for pequena) usada para o processamento pesado.
    """
    fundo_garantido = _mascara_fundo_por_flood_fill(trabalho, tolerancia_flood)

    # inicializa a máscara do GrabCut: onde o flood fill tem certeza que é
    # fundo, marca GC_BGD; o resto começa como "provável objeto" para o
    # GrabCut refinar a partir da estatística de cor real da imagem.
    mascara_gc = np.full((h_r, w_r), cv2.GC_PR_FGD, np.uint8)
    mascara_gc[fundo_garantido == 255] = cv2.GC_BGD

    # se o flood fill não sobrou quase nada de fundo (ex.: produto ocupa
    # praticamente o quadro todo), garante ao menos uma margem fina como
    # fundo para o GrabCut ter de onde partir.
    if (fundo_garantido == 255).sum() < 0.01 * fundo_garantido.size:
        margem = max(2, int(min(h_r, w_r) * 0.02))
        mascara_gc[:margem, :] = cv2.GC_BGD
        mascara_gc[-margem:, :] = cv2.GC_BGD
        mascara_gc[:, :margem] = cv2.GC_BGD
        mascara_gc[:, -margem:] = cv2.GC_BGD

    modelo_fundo = np.zeros((1, 65), np.float64)
    modelo_objeto = np.zeros((1, 65), np.float64)

    try:
        cv2.grabCut(
            trabalho, mascara_gc, None,
            modelo_fundo, modelo_objeto,
            iteracoes, cv2.GC_INIT_WITH_MASK,
        )
    except cv2.error as exc:
        raise ErroRemocaoFundo(f"GrabCut falhou ao processar a imagem: {exc}") from exc

    alpha_binaria = np.where(
        (mascara_gc == cv2.GC_FGD) | (mascara_gc == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)

    # mantém apenas o MAIOR pedaço conectado do "objeto": qualquer região
    # isolada (uma etiqueta solta, um cantinho de sombra classificado
    # como objeto, etc.) que não esteja fisicamente ligada ao produto
    # principal é descartada — assume-se que o produto é sempre o maior
    # elemento contínuo da foto, premissa razoável para fotos de produto.
    n_componentes, rotulos, stats, _ = cv2.connectedComponentsWithStats(alpha_binaria, connectivity=8)
    if n_componentes > 2:  # 0 = fundo; mais de 1 componente de objeto
        maior_rotulo = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        alpha_binaria = np.where(rotulos == maior_rotulo, 255, 0).astype(np.uint8)

    return alpha_binaria


def _finalizar_mascara(alpha_binaria, tamanho_original, escala):
    """
    Etapas comuns de finalização (Camada 1, passo 3): preenche buracos
    internos, fecha pequenos buracos por morfologia e suaviza o contorno
    com um blur leve — depois escala de volta ao tamanho original.
    Reaproveitada por todos os modos (automático e inteligente) para não
    duplicar lógica.
    """
    alpha_binaria = _preencher_buracos_internos(alpha_binaria)

    kernel = np.ones((5, 5), np.uint8)
    alpha_binaria = cv2.morphologyEx(alpha_binaria, cv2.MORPH_CLOSE, kernel)
    alpha_suave = cv2.GaussianBlur(alpha_binaria, (0, 0), sigmaX=2.0)

    if escala < 1.0:
        alpha_suave = cv2.resize(alpha_suave, tamanho_original, interpolation=cv2.INTER_LINEAR)

    return alpha_suave


def _remover_contaminacao_de_cor_nas_bordas(arr_bgr, alpha, margem_px=25):
    """
    Corrige o "halo" de cor nas bordas semi-transparentes da máscara —
    o efeito que faz uma borda branca (ou perto de etiquetas/objetos
    claros) parecer um branco ligeiramente diferente do branco real do
    fundo da foto.

    Causa: o suavizador de borda (blur no alpha) deixa uma faixa fina de
    pixels com transparência PARCIAL (nem 0 nem 255). A cor RGB desses
    pixels continua sendo a cor ORIGINAL da foto ali — que é uma mistura
    do objeto com o fundo real (que raramente é um branco puro; costuma
    ter uma leve sombra/gradiente de estúdio). Ao compor essa borda sobre
    QUALQUER fundo novo (branco sólido, cor escolhida pelo usuário, etc.),
    esse resquício de cor do fundo original "vaza" através da transparência
    parcial e cria uma faixa visivelmente diferente do restante — o
    problema relatado.

    Correção: para cada pixel que não está totalmente opaco (alpha < 250),
    substitui a cor RGB pela cor do objeto opaco mais próximo, "estendendo"
    a cor do produto para fora em vez de manter a cor contaminada pelo
    fundo. Isso é feito por dilatação repetida guiada pela máscara de
    pixels já "conhecidos" (começando pelos pixels opacos) — a mesma ideia
    usada por ferramentas de "remover franja/spill" em editores de imagem.
    O canal alpha em si NUNCA é alterado por esta função, só a cor RGB dos
    pixels de borda; a transição suave da máscara continua exatamente a
    mesma.

    `margem_px` limita quantas iterações de dilatação são feitas — como a
    faixa de transparência parcial normalmente tem só alguns pixels de
    largura (o blur da máscara usa sigma=2), um valor pequeno já cobre
    toda a faixa contaminada sem custo de processar a imagem inteira.
    """
    opaco = (alpha >= 250).astype(np.uint8)
    faixa_contaminada = alpha < 250
    if not faixa_contaminada.any() or not opaco.any():
        return arr_bgr

    resultado = arr_bgr.copy()
    conhecido = opaco.copy()
    kernel = np.ones((3, 3), np.uint8)

    for _ in range(margem_px):
        se_ainda_falta = conhecido == 0
        if not se_ainda_falta.any():
            break
        dilatado_cor = cv2.dilate(resultado, kernel)
        dilatado_mascara = cv2.dilate(conhecido, kernel)
        recem_preenchido = (dilatado_mascara == 1) & se_ainda_falta
        if not recem_preenchido.any():
            break
        resultado[recem_preenchido] = dilatado_cor[recem_preenchido]
        conhecido[recem_preenchido] = 1

    saida = arr_bgr.copy()
    saida[faixa_contaminada] = resultado[faixa_contaminada]
    return saida


def _remover_por_grabcut_hibrido(arr_bgr, iteracoes=6, lado_max=900, tolerancia_flood=18):
    """
    Modo "automatico": combina o mapa de "fundo garantido" (flood fill a
    partir da borda) com GrabCut guiado por máscara, mantém o maior
    componente conectado e finaliza a máscara. Mesma técnica de sempre,
    agora organizada em funções menores e reutilizáveis.

    Roda em versão reduzida da imagem para evitar o alto custo de
    memória do GrabCut em fotos grandes (12MP+), depois escala o
    resultado de volta ao tamanho original.
    """
    h, w = arr_bgr.shape[:2]

    escala = min(1.0, lado_max / max(h, w))
    if escala < 1.0:
        w_r, h_r = max(1, int(w * escala)), max(1, int(h * escala))
        trabalho = cv2.resize(arr_bgr, (w_r, h_r), interpolation=cv2.INTER_AREA)
    else:
        w_r, h_r = w, h
        trabalho = arr_bgr

    trabalho = np.ascontiguousarray(trabalho, dtype=np.uint8)

    alpha_binaria = _mascara_binaria_bruta(trabalho, h_r, w_r, iteracoes, tolerancia_flood)
    return _finalizar_mascara(alpha_binaria, (w, h), escala)


# ---------------------------------------------------------------------------
# CAMADA 2 — refinamento "inteligente" (objetos secundários / atrás do produto)
# ---------------------------------------------------------------------------

def _isolar_objeto_principal_por_pescoco(mascara_binaria, max_iteracoes=25, kernel_base=3):
    """
    Localiza o objeto principal dentro de uma máscara binária (255/0) que
    pode incluir um objeto secundário ligado por uma conexão fina
    ("pescoço") — o caso clássico de uma etiqueta/cartão atrás ou
    encostado no produto que o GrabCut fundiu ao produto principal.

    Técnica: erosão morfológica progressiva até a máscara se partir em
    dois ou mais componentes conectados, seguida de reconstrução
    morfológica (dilatação repetida limitada pela máscara original) do
    maior componente pós-erosão de volta ao seu tamanho — mas sem voltar
    a atravessar o pescoço fino que foi rompido pela erosão.

    Não usa cor nem coordenadas: é puramente geométrico/topológico, então
    generaliza para qualquer imagem com essa estrutura (produto + objeto
    conectado por uma região estreita), em qualquer posição e resolução.

    Retorna (mascara_isolada, confianca) com confianca em [0, 1]. Se a
    técnica não encontrar nenhum "pescoço" (produto já é um único blob
    sem conexões finas), retorna a máscara original com confiança máxima
    (nada a cortar).
    """
    area_original = int((mascara_binaria == 255).sum())
    if area_original == 0:
        return mascara_binaria, 1.0

    tamanho_kernel = kernel_base
    dividiu = False
    rotulos = None
    stats = None

    for _ in range(max_iteracoes):
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (tamanho_kernel, tamanho_kernel))
        erodida = cv2.erode(mascara_binaria, kernel)
        n_comp, rotulos_teste, stats_teste, _ = cv2.connectedComponentsWithStats(erodida, connectivity=8)
        componentes_validos = [i for i in range(1, n_comp) if stats_teste[i, cv2.CC_STAT_AREA] > 0]
        if len(componentes_validos) >= 2:
            dividiu = True
            rotulos, stats = rotulos_teste, stats_teste
            break
        tamanho_kernel += 2

    if not dividiu:
        # não há pescoço fino detectável nesta imagem: nada a fazer, e com
        # confiança máxima de que a máscara original já está correta.
        return mascara_binaria, 1.0

    # identifica o maior componente pós-erosão: é o "núcleo" mais provável
    # do produto principal (assume-se que o produto ocupa mais área que
    # o objeto secundário — premissa razoável e geral para fotos de produto)
    maior_rotulo = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    nucleo = np.where(rotulos == maior_rotulo, 255, 0).astype(np.uint8)

    # reconstrução morfológica: dilata o núcleo repetidamente, mas nunca
    # além da máscara original — recupera toda a parte do objeto principal
    # perdida na erosão, sem voltar a invadir o pescoço/objeto secundário
    kernel_recon = np.ones((3, 3), np.uint8)
    reconstruida = nucleo.copy()
    for _ in range(300):  # limite de segurança para imagens muito grandes
        dilatada = cv2.dilate(reconstruida, kernel_recon)
        dilatada = cv2.bitwise_and(dilatada, mascara_binaria)
        if np.array_equal(dilatada, reconstruida):
            break
        reconstruida = dilatada

    area_reconstruida = int((reconstruida == 255).sum())
    proporcao_mantida = area_reconstruida / area_original if area_original else 0.0

    if proporcao_mantida < 0.15:
        # o corte eliminaria uma fatia grande demais da máscara original —
        # sinal de que provavelmente NÃO era um objeto secundário de fato
        # (ex.: produto com geometria naturalmente estreita em algum ponto).
        # Regra de ouro do projeto: preferir manter um resíduo de fundo a
        # arriscar destruir parte do produto. Confiança baixa -> descarta.
        return mascara_binaria, 0.3

    if proporcao_mantida > 0.985:
        # praticamente nada foi cortado: o "pescoço" era insignificante
        confianca = 0.55
    else:
        # quanto mais equilibrado o corte (nem quase tudo, nem quase nada),
        # maior a confiança de que separamos de fato produto e objeto anexo
        confianca = min(1.0, 0.6 + (1 - proporcao_mantida) * 0.4)

    return reconstruida, confianca


def _maior_contorno(mascara_binaria):
    contornos, _ = cv2.findContours(mascara_binaria, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contornos:
        return None
    return max(contornos, key=cv2.contourArea)


def _refinar_por_silhueta_poligonal(mascara_binaria, tolerancia_aproximacao=0.02):
    """
    Reforço de confiança opcional (não obrigatório, não exclusivo): quando
    o contorno externo do objeto principal se aproxima, com alta
    fidelidade, de um polígono convexo simples (produto com formato
    aproximadamente retangular/quadrilateral, por exemplo), usa esse
    polígono para descartar pixels que sobraram claramente FORA da
    silhueta poligonal — útil para "aparar" resquícios finos de um objeto
    secundário que a etapa de pescoço não tenha eliminado por completo.

    NÃO assume que todo produto é retangular: só age quando a razão entre
    a área do contorno real e a área do seu casco convexo (convex hull) é
    alta o suficiente para indicar uma forma já bastante convexa/regular.
    Caso contrário, devolve a máscara original inalterada.

    Retorna (mascara_refinada, confianca_do_reforco).
    """
    contorno = _maior_contorno(mascara_binaria)
    if contorno is None or cv2.contourArea(contorno) < 0.02 * mascara_binaria.size:
        return mascara_binaria, 0.0

    hull = cv2.convexHull(contorno)
    area_contorno = cv2.contourArea(contorno)
    area_hull = cv2.contourArea(hull)
    if area_hull <= 0:
        return mascara_binaria, 0.0

    razao_convexidade = area_contorno / area_hull

    # só confia na silhueta poligonal quando a forma já é MUITO próxima de
    # convexa (produto sólido, sem curvas nem reentrâncias relevantes) —
    # formas curvas/irregulares (elipses, contornos orgânicos etc.) NUNCA
    # devem ser aproximadas por um polígono de poucos vértices, porque a
    # simplificação corta "acordes" para dentro da curva e raspa partes
    # legítimas do produto. Limiar alto e proposital.
    if razao_convexidade < 0.955:
        return mascara_binaria, 0.0

    perimetro = cv2.arcLength(hull, True)
    aproximado = cv2.approxPolyDP(hull, tolerancia_aproximacao * perimetro, True)

    # só aceita polígonos com poucos vértices (retângulo, pentágono...) —
    # é o sinal geométrico de um objeto poligonal de verdade. Formas
    # curvas forçadas a virar polígono tendem a precisar de muitos
    # vértices (ex.: um octógono para aproximar uma elipse); isso é
    # rejeitado para não arriscar cortar bordas curvas legítimas.
    if len(aproximado) < 3 or len(aproximado) > 7:
        return mascara_binaria, 0.0

    area_aproximado = cv2.contourArea(aproximado)
    if area_hull <= 0 or area_aproximado / area_hull < 0.95:
        # a simplificação já cortaria uma fatia perceptível do casco
        # convexo original — sinal de que a forma não é bem descrita por
        # esse polígono; melhor não arriscar
        return mascara_binaria, 0.0

    # pequena margem de segurança (relativa ao tamanho do objeto) para não
    # raspar a borda real do produto por causa de aliasing/serrilhado
    margem = max(2, int(0.015 * np.sqrt(area_hull)))
    poligono_mascara = np.zeros_like(mascara_binaria)
    cv2.fillPoly(poligono_mascara, [aproximado], 255)
    kernel_margem = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (margem * 2 + 1, margem * 2 + 1))
    poligono_mascara = cv2.dilate(poligono_mascara, kernel_margem)

    refinada = cv2.bitwise_and(mascara_binaria, poligono_mascara)

    area_antes = int((mascara_binaria == 255).sum())
    area_depois = int((refinada == 255).sum())
    if area_antes == 0 or area_depois / area_antes < 0.9:
        # o polígono cortaria mais do que um resíduo pequeno — não
        # confiar, manter a máscara original (só aparamos sobras finas,
        # nunca fatias grandes do objeto)
        return mascara_binaria, 0.0

    confianca = min(1.0, razao_convexidade)
    return refinada, confianca


def _refinar_com_grabcut_leve(arr_bgr_trabalho, mascara_semente, iteracoes=2):
    """
    Segunda passada, mais leve, de GrabCut usando o resultado da Camada 2
    como semente (GC_BGD fora, GC_PR_FGD dentro) apenas para suavizar a
    borda que a erosão/reconstrução pode ter deixado serrilhada — não
    redecide o que é produto ou fundo, só refina o contorno já decidido.
    """
    h_r, w_r = mascara_semente.shape[:2]
    mascara_gc = np.full((h_r, w_r), cv2.GC_BGD, np.uint8)
    mascara_gc[mascara_semente == 255] = cv2.GC_PR_FGD

    if (mascara_semente == 255).sum() < 10 or (mascara_semente == 0).sum() < 10:
        # muito pouco fundo ou muito pouco objeto para o GrabCut aprender
        # estatística de cor útil — mantém a máscara de entrada
        return mascara_semente

    modelo_fundo = np.zeros((1, 65), np.float64)
    modelo_objeto = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(
            arr_bgr_trabalho, mascara_gc, None,
            modelo_fundo, modelo_objeto,
            iteracoes, cv2.GC_INIT_WITH_MASK,
        )
    except cv2.error:
        # refinamento é opcional; se falhar, segue com a máscara anterior
        return mascara_semente

    return np.where(
        (mascara_gc == cv2.GC_FGD) | (mascara_gc == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)


def _remover_fundo_inteligente(arr_bgr, iteracoes=6, lado_max=900, tolerancia_flood=18):
    """
    Modo "inteligente": parte exatamente da mesma Camada 1 (flood fill +
    GrabCut + maior componente) e adiciona a análise de pescoço/silhueta
    da Camada 2 para separar objetos secundários encostados ou atrás do
    produto principal. Se a Camada 2 não tiver confiança suficiente em
    nenhuma das duas heurísticas, o resultado da Camada 1 é usado sem
    alteração (nunca arrisca destruir o produto por excesso de agressividade).

    Retorna (alpha_final, aviso_ou_none).
    """
    h, w = arr_bgr.shape[:2]

    escala = min(1.0, lado_max / max(h, w))
    if escala < 1.0:
        w_r, h_r = max(1, int(w * escala)), max(1, int(h * escala))
        trabalho = cv2.resize(arr_bgr, (w_r, h_r), interpolation=cv2.INTER_AREA)
    else:
        w_r, h_r = w, h
        trabalho = arr_bgr

    trabalho = np.ascontiguousarray(trabalho, dtype=np.uint8)

    mascara_base = _mascara_binaria_bruta(trabalho, h_r, w_r, iteracoes, tolerancia_flood)

    mascara_pescoco, confianca_pescoco = _isolar_objeto_principal_por_pescoco(mascara_base)

    aviso = None
    mascara_atual = mascara_base
    if confianca_pescoco >= 0.55 and not np.array_equal(mascara_pescoco, mascara_base):
        mascara_atual = mascara_pescoco
        aviso = (
            "Remoção Inteligente: um objeto conectado ao produto por uma "
            "região estreita (possível etiqueta, cartão ou objeto atrás) "
            "foi identificado e removido."
        )

    mascara_poligono, confianca_poligono = _refinar_por_silhueta_poligonal(mascara_atual)
    if confianca_poligono >= 0.9 and not np.array_equal(mascara_poligono, mascara_atual):
        mascara_atual = mascara_poligono
        if aviso is None:
            aviso = (
                "Remoção Inteligente: a silhueta do produto foi usada para "
                "aparar resíduos de fundo fora do contorno principal."
            )

    # refinamento leve de borda (não redecide, só suaviza)
    mascara_atual = _refinar_com_grabcut_leve(trabalho, mascara_atual, iteracoes=2)

    alpha_final = _finalizar_mascara(mascara_atual, (w, h), escala)
    return alpha_final, aviso


def remover_fundo_avancado(imagem: Image.Image, modo: str = "automatico"):
    """
    Remove o fundo de uma imagem PIL, escolhendo a técnica pelo `modo`:

      - "automatico": Camada 1 apenas (flood fill + GrabCut + maior
        componente + preenchimento de buracos). Rápido, é o padrão.
      - "inteligente": Camada 1 + Camada 2 (isolamento por pescoço fino /
        silhueta poligonal), para separar objetos secundários encostados
        ou atrás do produto principal. Mais custoso computacionalmente.
      - "manual": usa a mesma base rápida do modo "automatico" como ponto
        de partida — a correção fina é feita depois, no navegador, pelo
        editor de máscara com pincel (ver static/app.js). O backend não
        precisa de nenhuma lógica extra para este modo além de fornecer
        uma máscara inicial razoável.

    Retorna (imagem_rgba, aviso_ou_none). `aviso` traz uma mensagem
    amigável quando a Camada 2 efetivamente alterou o resultado, para que
    o usuário saiba que algo foi removido além do fundo simples.

    Levanta ErroRemocaoFundo em caso de falha, para que o chamador possa
    tratar o erro de forma amigável sem derrubar o processamento do lote.
    """
    modo = (modo or "automatico").lower()
    if modo not in MODOS_VALIDOS:
        modo = "automatico"

    try:
        rgb = ImageOps.exif_transpose(imagem).convert("RGB")
        arr_rgb = np.array(rgb)
        arr_bgr = cv2.cvtColor(arr_rgb, cv2.COLOR_RGB2BGR)

        aviso = None
        if modo == "inteligente":
            alpha, aviso = _remover_fundo_inteligente(arr_bgr)
        else:
            # "automatico" e "manual" usam a mesma base rápida da Camada 1
            alpha = _remover_por_grabcut_hibrido(arr_bgr)

        # Remove o resquício de cor do fundo original nos pixels de borda
        # semi-transparentes (ver docstring da função) antes de entregar a
        # imagem final — evita o halo/branco "diferente" perto de bordas e
        # etiquetas quando a imagem for composta sobre um novo fundo.
        arr_bgr_final = _remover_contaminacao_de_cor_nas_bordas(arr_bgr, alpha)
        arr_rgb_final = cv2.cvtColor(arr_bgr_final, cv2.COLOR_BGR2RGB)

        resultado = np.dstack([arr_rgb_final, alpha])
        return Image.fromarray(resultado, mode="RGBA"), aviso

    except ErroRemocaoFundo:
        raise
    except Exception as exc:
        raise ErroRemocaoFundo(f"Falha ao remover o fundo da imagem: {exc}") from exc


def remover_fundo(imagem: Image.Image, modo: str = "automatico") -> Image.Image:
    """
    Mantido por compatibilidade com o restante do projeto (mesma
    assinatura de antes, com um parâmetro `modo` opcional adicionado no
    final — chamadas antigas como `remover_fundo(imagem)` continuam
    funcionando sem nenhuma mudança). Veja `remover_fundo_avancado` para
    a versão que também retorna o aviso amigável.
    """
    resultado, _aviso = remover_fundo_avancado(imagem, modo=modo)
    return resultado