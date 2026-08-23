import base64
import io
import json
import os
import re
import shutil
import tempfile
import zipfile

from flask import Flask, Response, jsonify, render_template, request, stream_with_context
from PIL import Image

from background_remover import ErroRemocaoFundo, MODOS_VALIDOS, remover_fundo_avancado

app = Flask(__name__)

# Limite generoso para lotes grandes, mas evita uploads sem controle.
app.config["MAX_CONTENT_LENGTH"] = 300 * 1024 * 1024  # 300 MB

FORMATOS_PILLOW = {
    "PNG": "PNG",
    "JPEG": "JPEG",
    "WEBP": "WEBP",
    "BMP": "BMP",
    "GIF": "GIF",
    "TIFF": "TIFF",
}

EXTENSAO_POR_FORMATO = {
    "PNG": "png",
    "JPEG": "jpg",
    "WEBP": "webp",
    "BMP": "bmp",
    "GIF": "gif",
    "TIFF": "tiff",
}

MIME_POR_FORMATO = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "BMP": "image/bmp",
    "GIF": "image/gif",
    "TIFF": "image/tiff",
}

# Formatos cujo encoder do Pillow preserva corretamente o canal alpha.
FORMATOS_COM_ALPHA = {"PNG", "WEBP", "TIFF"}

EXTENSOES_VALIDAS = {"png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif"}

CARACTERES_INVALIDOS = re.compile(r'[\\/:*?"<>|]')
CARACTERES_CONTROLE = re.compile(r"[\x00-\x1f\x7f-\x9f]")
COR_HEX = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def sanitizar_nome_arquivo(nome):
    """Remove caracteres invalidos do SO, caracteres de controle e espacos extras."""
    if not nome:
        return ""

    try:
        texto = str(nome)
        texto = CARACTERES_INVALIDOS.sub("", texto)
        texto = CARACTERES_CONTROLE.sub("", texto)
        texto = re.sub(r"\s+", " ", texto).strip()
        texto = texto.rstrip(". ").strip()
        return texto
    except Exception:
        return ""


def extensao_do_arquivo(nome):
    if not nome or "." not in nome:
        return ""
    return nome.rsplit(".", 1)[1].lower()


def extensao_valida(nome):
    return extensao_do_arquivo(nome) in EXTENSOES_VALIDAS


def resolver_nome_saida(nome_base, novo_nome, extensao, nomes_usados):
    """Define o nome final do arquivo respeitando novo_nome e incrementando colisoes."""
    candidato = sanitizar_nome_arquivo(novo_nome) if novo_nome else ""
    if not candidato:
        candidato = sanitizar_nome_arquivo(nome_base) or "imagem"

    nome_saida = f"{candidato}.{extensao}"
    if nome_saida not in nomes_usados:
        return nome_saida

    contador = 1
    while True:
        nome_final = f"{candidato}_{contador}.{extensao}"
        if nome_final not in nomes_usados:
            return nome_final
        contador += 1


def cor_hex_para_rgb(cor, padrao=(255, 255, 255)):
    """Converte '#rrggbb' (ou '#rgb') em tupla RGB. Cai no padrão se inválida."""
    if not cor or not COR_HEX.match(cor):
        return padrao
    cor = cor.lstrip("#")
    if len(cor) == 3:
        cor = "".join(c * 2 for c in cor)
    return tuple(int(cor[i:i + 2], 16) for i in (0, 2, 4))


def mensagem_amigavel_erro(exc):
    """
    Traduz exceções técnicas comuns (arquivo corrompido, formato não
    reconhecido pelo Pillow, estouro de memória, máscara inválida, etc.)
    em mensagens curtas e amigáveis para o usuário final — nunca expõe
    traceback ou detalhes internos. Detalhes técnicos completos continuam
    disponíveis via logging padrão do servidor (não implementado aqui
    para não mudar a infraestrutura de logging já existente do projeto).
    """
    texto = str(exc)
    texto_lower = texto.lower()

    if isinstance(exc, MemoryError) or "memory" in texto_lower:
        return "A imagem é grande demais para ser processada com a memória disponível."
    if "cannot identify image file" in texto_lower or "identify image" in texto_lower:
        return "Não foi possível reconhecer este arquivo como uma imagem válida (pode estar corrompido)."
    if "truncated" in texto_lower:
        return "O arquivo de imagem parece estar incompleto ou corrompido."
    if isinstance(exc, RuntimeError) and texto:
        # erros já amigáveis levantados propositalmente (ex.: ErroRemocaoFundo)
        return texto
    if not texto:
        return "Erro ao processar esta imagem."
    return texto


def processar_imagem_stream(arquivo_stream, cfg):
    """
    Pipeline reutilizável de processamento de UMA imagem, usada tanto para
    processar 1 imagem quanto para lotes de centenas de imagens.

    É um gerador que primeiro emite eventos de progresso reais, um por
    etapa pesada ("removendo_fundo", "redimensionando", "convertendo"), e
    por fim emite o resultado final. Isso permite que o chamador reporte
    progresso honesto ao cliente sem simular percentuais falsos.

    Ordem do pipeline (conforme especificado):
      1. abrir e normalizar a imagem
      2. remover o fundo (se solicitado) — preservando o canal alpha
      3. redimensionar
      4. converter para o formato de saída + aplicar qualidade/compressão

    cfg aceita:
        formato, largura, altura, qualidade, manter_proporcao,
        remover_fundo (bool), cor_fundo ('#rrggbb', usada apenas quando o
        formato final não suporta transparência).

    yields:
        ("etapa", "removendo_fundo" | "redimensionando" | "convertendo")
        ("resultado", (dados_bytes, (largura, altura), aviso_ou_none))
    """
    formato = (cfg.get("formato") or "PNG").upper()
    if formato not in FORMATOS_PILLOW:
        formato = "PNG"

    largura = cfg.get("largura")
    altura = cfg.get("altura")
    largura = int(largura) if largura else None
    altura = int(altura) if altura else None
    qualidade = int(cfg.get("qualidade") or 90)
    qualidade = max(1, min(100, qualidade))
    manter_proporcao = cfg.get("manter_proporcao", True)
    remover_fundo_flag = bool(cfg.get("remover_fundo"))
    cor_fundo = cor_hex_para_rgb(cfg.get("cor_fundo"))
    modo_remocao = (cfg.get("modo_remocao") or "automatico").lower()
    if modo_remocao not in MODOS_VALIDOS:
        modo_remocao = "automatico"

    aviso = None

    # ----- 1. abrir e normalizar -----
    with Image.open(arquivo_stream) as img_original:
        img_original.load()  # valida integridade do arquivo cedo

        n_frames = getattr(img_original, "n_frames", 1)
        if remover_fundo_flag and n_frames > 1:
            aviso = (
                "Imagem GIF animada: a remoção de fundo foi aplicada apenas "
                "ao primeiro quadro; a animação original não é preservada."
            )

        imagem = img_original.convert("RGBA")

    # ----- 2. remover fundo (antes da exportação, para preservar alpha) -----
    if remover_fundo_flag:
        yield ("etapa", "removendo_fundo")
        try:
            nova_imagem, aviso_remocao = remover_fundo_avancado(imagem, modo=modo_remocao)
        except ErroRemocaoFundo as exc:
            imagem.close()
            raise RuntimeError(str(exc)) from exc
        imagem.close()
        imagem = nova_imagem
        if aviso_remocao:
            aviso = f"{aviso} {aviso_remocao}" if aviso else aviso_remocao

    # ----- 3. redimensionar -----
    yield ("etapa", "redimensionando")
    if largura or altura:
        largura_atual, altura_atual = imagem.size
        if manter_proporcao:
            if largura and not altura:
                altura = round(altura_atual * (largura / largura_atual))
            elif altura and not largura:
                largura = round(largura_atual * (altura / altura_atual))
            elif largura and altura:
                imagem.thumbnail((largura, altura))
                largura, altura = imagem.size
        largura = largura or largura_atual
        altura = altura or altura_atual
        if imagem.size != (largura, altura):
            imagem = imagem.resize((largura, altura), Image.LANCZOS)

    # ----- 4. converter formato + qualidade -----
    yield ("etapa", "convertendo")

    if formato in FORMATOS_COM_ALPHA:
        imagem_final = imagem
    else:
        # Formato não suporta transparência (JPEG, BMP, GIF): nunca
        # descartamos o alpha silenciosamente — compomos sobre uma cor
        # de fundo sólida (branco por padrão, ou a cor escolhida pelo
        # usuário) e avisamos o motivo.
        if imagem.mode == "RGBA":
            fundo = Image.new("RGB", imagem.size, cor_fundo)
            fundo.paste(imagem, mask=imagem.split()[3])
            imagem_final = fundo
            if remover_fundo_flag:
                mensagem_cor = (
                    f"{formato} não suporta fundo transparente: a imagem foi "
                    f"salva com um fundo sólido na cor escolhida."
                )
                aviso = f"{aviso} {mensagem_cor}" if aviso else mensagem_cor
        else:
            imagem_final = imagem.convert("RGB")

    parametros_salvar = {}
    if formato in ("JPEG", "WEBP"):
        parametros_salvar["quality"] = qualidade
        parametros_salvar["optimize"] = True

    buffer = io.BytesIO()
    imagem_final.save(buffer, format=FORMATOS_PILLOW[formato], **parametros_salvar)
    buffer.seek(0)
    dados = buffer.read()
    tamanho = imagem_final.size

    if imagem_final is not imagem:
        imagem.close()
    imagem_final.close()

    yield ("resultado", (dados, tamanho, aviso))


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/converter-lote", methods=["POST"])
def api_converter_lote():
    arquivos = request.files.getlist("arquivos")
    if not arquivos:
        return jsonify({"erro": "Nenhum arquivo enviado."}), 400

    try:
        config = json.loads(request.form.get("config", "{}"))
    except json.JSONDecodeError:
        config = {}

    usar_zip = request.form.get("usar_zip", "true").lower() == "true"

    # Salva os uploads em disco (arquivos temporários) em vez de manter
    # tudo em memória de uma vez, para lidar bem com dezenas/centenas de
    # imagens sem consumir RAM excessiva.
    pasta_temp = tempfile.mkdtemp(prefix="revela_")
    itens = []
    try:
        for indice, arquivo in enumerate(arquivos):
            nome_original = arquivo.filename or f"imagem_{indice}"
            caminho = os.path.join(pasta_temp, f"{indice}_{os.path.basename(nome_original)}")
            arquivo.save(caminho)
            itens.append((nome_original, caminho))
    except Exception:
        shutil.rmtree(pasta_temp, ignore_errors=True)
        return jsonify({"erro": "Falha ao receber os arquivos enviados."}), 400

    def gerar():
        total = len(itens)
        nomes_usados = set()
        buffer_zip = io.BytesIO()
        zf = zipfile.ZipFile(buffer_zip, "w", zipfile.ZIP_DEFLATED) if usar_zip else None

        try:
            for indice, (nome_original, caminho) in enumerate(itens, start=1):
                cfg = config.get(nome_original, {}) or {}

                try:
                    if not extensao_valida(nome_original):
                        raise ValueError(
                            "Formato de arquivo não suportado pelo Revela."
                        )

                    dados = dimensoes = aviso = None
                    with open(caminho, "rb") as origem:
                        for tipo_evento, valor in processar_imagem_stream(origem, cfg):
                            if tipo_evento == "etapa":
                                yield json.dumps({
                                    "tipo": "progresso",
                                    "indice": indice,
                                    "total": total,
                                    "nome": nome_original,
                                    "etapa": valor,
                                }, ensure_ascii=True) + "\n"
                            else:
                                dados, dimensoes, aviso = valor

                    formato = (cfg.get("formato") or "PNG").upper()
                    if formato not in FORMATOS_PILLOW:
                        formato = "PNG"
                    extensao = EXTENSAO_POR_FORMATO[formato]
                    nome_base = nome_original.rsplit(".", 1)[0] if "." in nome_original else nome_original
                    novo_nome = cfg.get("novo_nome")

                    nome_final = resolver_nome_saida(nome_base, novo_nome, extensao, nomes_usados)
                    nomes_usados.add(nome_final)

                    evento_resultado = {
                        "tipo": "resultado",
                        "nome": nome_original,
                        "status": "ok",
                        "salvo_como": nome_final,
                        "dimensoes": f"{dimensoes[0]}x{dimensoes[1]}",
                        "aviso": aviso,
                    }

                    if usar_zip:
                        zf.writestr(nome_final, dados)
                    else:
                        evento_resultado["dados"] = base64.b64encode(dados).decode("ascii")
                        evento_resultado["mime"] = MIME_POR_FORMATO.get(formato, "application/octet-stream")

                    yield json.dumps(evento_resultado, ensure_ascii=True) + "\n"

                except Exception as exc:
                    yield json.dumps({
                        "tipo": "resultado",
                        "nome": nome_original,
                        "status": "erro",
                        "mensagem": mensagem_amigavel_erro(exc),
                    }, ensure_ascii=True) + "\n"
                finally:
                    # libera o arquivo temporário assim que possível
                    try:
                        os.remove(caminho)
                    except OSError:
                        pass

            if usar_zip:
                zf.close()
                buffer_zip.seek(0)
                zip_base64 = base64.b64encode(buffer_zip.read()).decode("ascii")
                yield json.dumps({
                    "tipo": "concluido",
                    "zip_base64": zip_base64,
                    "nome_zip": "convertido.zip",
                }, ensure_ascii=True) + "\n"
            else:
                yield json.dumps({"tipo": "concluido"}, ensure_ascii=True) + "\n"
        finally:
            shutil.rmtree(pasta_temp, ignore_errors=True)

    return Response(stream_with_context(gerar()), mimetype="application/x-ndjson")


if __name__ == "__main__":
    app.run(debug=True, port=5000)