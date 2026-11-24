<<<<<<< HEAD
import base64
import io
import json
import logging
import os
import re
import shutil
import tempfile
import time
import zipfile

from flask import Flask, Response, jsonify, render_template, request, stream_with_context
from PIL import Image

from background_remover import ErroRemocaoFundo, MODOS_VALIDOS, remover_fundo_avancado

app = Flask(__name__)

# Logs simples de auditoria do lote — aparecem no painel de logs do Render.
# Não registram conteúdo de imagem nem dados sensíveis, só contagens e nomes
# de arquivo, o suficiente pra descobrir em qual etapa um lote travou.
logging.basicConfig(level=logging.INFO, format="[revela] %(message)s")
logger = logging.getLogger("revela")

# Limite generoso para lotes grandes, mas evita uploads sem controle.
app.config["MAX_CONTENT_LENGTH"] = 300 * 1024 * 1024  # 300 MB

=======
import concurrent.futures
import io
import json
import mimetypes
import re
import zipfile

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageOps

app = Flask(__name__)

>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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

<<<<<<< HEAD
MIME_POR_FORMATO = {
=======
MIMETYPES_POR_FORMATO = {
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "BMP": "image/bmp",
    "GIF": "image/gif",
    "TIFF": "image/tiff",
}

<<<<<<< HEAD
# Formatos cujo encoder do Pillow preserva corretamente o canal alpha.
FORMATOS_COM_ALPHA = {"PNG", "WEBP", "TIFF"}

EXTENSOES_VALIDAS = {"png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif"}

CARACTERES_INVALIDOS = re.compile(r'[\\/:*?"<>|]')
CARACTERES_CONTROLE = re.compile(r"[\x00-\x1f\x7f-\x9f]")
COR_HEX = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
=======
CARACTERES_INVALIDOS = re.compile(r'[\\/:*?"<>|]')
CARACTERES_CONTROLE = re.compile(r"[\x00-\x1f\x7f-\x9f]")
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0


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


<<<<<<< HEAD
def extensao_do_arquivo(nome):
    if not nome or "." not in nome:
        return ""
    return nome.rsplit(".", 1)[1].lower()


def extensao_valida(nome):
    return extensao_do_arquivo(nome) in EXTENSOES_VALIDAS


=======
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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


<<<<<<< HEAD
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
=======
def converter_uma_imagem(dados_bytes, cfg):
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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
<<<<<<< HEAD
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
=======

    with Image.open(io.BytesIO(dados_bytes)) as raw_img:
        # Corrige rotação automática de câmeras de celular (EXIF)
        try:
            img = ImageOps.exif_transpose(raw_img)
        except Exception:
            img = raw_img

        # Tratamento de cores e canais de transparência
        if formato in ("JPEG", "BMP"):
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img_rgba = img.convert("RGBA")
                fundo = Image.new("RGB", img_rgba.size, (255, 255, 255))
                fundo.paste(img_rgba, mask=img_rgba.split()[3])
                img_convertida = fundo
            else:
                img_convertida = img.convert("RGB")
        elif formato in ("PNG", "WEBP"):
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img_convertida = img.convert("RGBA")
            else:
                img_convertida = img.convert("RGB")
        else:
            img_convertida = img.convert("RGB")

        # Redimensionamento
        if largura or altura:
            largura_atual, altura_atual = img_convertida.size
            if manter_proporcao:
                if largura and not altura:
                    altura = max(1, round(altura_atual * (largura / largura_atual)))
                elif altura and not largura:
                    largura = max(1, round(largura_atual * (altura / altura_atual)))
                elif largura and altura:
                    img_convertida.thumbnail((largura, altura), Image.LANCZOS)
                    largura, altura = img_convertida.size
            largura = largura or largura_atual
            altura = altura or altura_atual
            if img_convertida.size != (largura, altura):
                img_convertida = img_convertida.resize((largura, altura), Image.LANCZOS)

        parametros_salvar = {}
        if formato in ("JPEG", "WEBP"):
            parametros_salvar["quality"] = qualidade
            parametros_salvar["optimize"] = True

        buffer = io.BytesIO()
        img_convertida.save(buffer, format=FORMATOS_PILLOW[formato], **parametros_salvar)
        buffer.seek(0)
        return buffer.read(), img_convertida.size, formato
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/converter-lote", methods=["POST"])
def api_converter_lote():
    arquivos = request.files.getlist("arquivos")
<<<<<<< HEAD
    logger.info("Arquivos recebidos: %d", len(arquivos))
=======
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
    if not arquivos:
        return jsonify({"erro": "Nenhum arquivo enviado."}), 400

    try:
        config = json.loads(request.form.get("config", "{}"))
    except json.JSONDecodeError:
        config = {}

<<<<<<< HEAD
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
        logger.info("Iniciando processamento: %d", total)
        sucessos = 0
        falhas = 0
        nomes_usados = set()
        buffer_zip = io.BytesIO()
        zf = zipfile.ZipFile(buffer_zip, "w", zipfile.ZIP_DEFLATED) if usar_zip else None

        try:
            for indice, (nome_original, caminho) in enumerate(itens, start=1):
                # Chave pela ordem de envio, não pelo nome original: dois
                # arquivos com o mesmo nome (comum em fotos de câmera/pastas
                # diferentes, ex. duas "IMG_0001.jpg") não podem dividir a
                # mesma configuração por colisão de chave.
                cfg = config.get(str(indice - 1)) or config.get(nome_original) or {}
                logger.info("Processando (%d/%d): %s", indice, total, nome_original)
                inicio_item = time.monotonic()

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
                    # Os bytes individuais SEMPRE vão junto no evento (mesmo em
                    # modo ZIP): o ZIP só é fechado no final do lote inteiro, e
                    # se o processamento for interrompido antes disso (ex.:
                    # timeout numa imagem mais pesada), o front-end ainda
                    # consegue entregar ao usuário tudo que já havia terminado
                    # em vez de perder o lote inteiro por causa do ZIP que
                    # nunca chegou a ser fechado.
                    evento_resultado["dados"] = base64.b64encode(dados).decode("ascii")
                    evento_resultado["mime"] = MIME_POR_FORMATO.get(formato, "application/octet-stream")

                    yield json.dumps(evento_resultado, ensure_ascii=True) + "\n"
                    sucessos += 1
                    logger.info(
                        "Concluído (%d/%d): %s em %.1fs",
                        indice, total, nome_original, time.monotonic() - inicio_item,
                    )

                except Exception as exc:
                    falhas += 1
                    logger.info(
                        "Erro (%d/%d): %s após %.1fs — %s",
                        indice, total, nome_original, time.monotonic() - inicio_item, exc,
                    )
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

            logger.info(
                "Processamento concluído: %d — Sucessos: %d — Falhas: %d",
                total, sucessos, falhas,
            )

            if usar_zip:
                logger.info("Criando ZIP com %d arquivo(s)", len(nomes_usados))
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

    resposta = Response(stream_with_context(gerar()), mimetype="application/x-ndjson")
    # Evita que um proxy reverso na frente do servidor (comum em PaaS como o
    # Render) armazene a resposta em buffer inteira antes de repassar — sem
    # isso, o cliente só veria progresso quando o proxy decidisse liberar o
    # buffer (ou nunca, se isso estourar algum timeout do proxy antes).
    resposta.headers["X-Accel-Buffering"] = "no"
=======
    usar_zip_param = request.form.get("usar_zip", "true").lower() in ("true", "1", "on")

    # Lê todos os bytes de forma segura antes de despachar para threads
    itens_para_processar = []
    for arquivo in arquivos:
        itens_para_processar.append({
            "nome_original": arquivo.filename,
            "bytes": arquivo.read(),
            "cfg": config.get(arquivo.filename, {}),
        })

    def processar_item(item):
        nome_orig = item["nome_original"]
        try:
            dados_conv, dimensoes, formato = converter_uma_imagem(item["bytes"], item["cfg"])
            return {
                "nome": nome_orig,
                "status": "ok",
                "dados": dados_conv,
                "dimensoes": f"{dimensoes[0]}x{dimensoes[1]}",
                "formato": formato,
                "cfg": item["cfg"],
            }
        except Exception as e:
            return {
                "nome": nome_orig,
                "status": "erro",
                "mensagem": str(e),
                "cfg": item["cfg"],
            }

    # Processamento paralelo com ThreadPoolExecutor
    max_workers = min(8, max(1, len(itens_para_processar)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        resultados_brutos = list(executor.map(processar_item, itens_para_processar))

    # Resolução de nomes e montagem da resposta
    nomes_usados = set()
    arquivos_prontos = []
    metadados_resultados = []

    for r in resultados_brutos:
        if r["status"] == "ok":
            formato = r["formato"]
            extensao = EXTENSAO_POR_FORMATO.get(formato, "png")
            nome_base = r["nome"].rsplit(".", 1)[0]
            novo_nome = r["cfg"].get("novo_nome")

            nome_final = resolver_nome_saida(nome_base, novo_nome, extensao, nomes_usados)
            nomes_usados.add(nome_final)

            arquivos_prontos.append({
                "nome_final": nome_final,
                "dados": r["dados"],
                "formato": formato,
            })
            metadados_resultados.append({
                "nome": r["nome"],
                "status": "ok",
                "salvo_como": nome_final,
                "dimensoes": r["dimensoes"],
                "tamanho_kb": round(len(r["dados"]) / 1024, 1),
            })
        else:
            metadados_resultados.append({
                "nome": r["nome"],
                "status": "erro",
                "mensagem": r.get("mensagem", "Erro desconhecido"),
            })

    if not arquivos_prontos:
        return jsonify({"erro": "Nenhuma imagem pôde ser convertida.", "detalhes": metadados_resultados}), 400

    # Se apenas 1 arquivo foi convertido e o usuário não pediu zip, envia o arquivo diretamente
    if not usar_zip_param and len(arquivos_prontos) == 1:
        unico = arquivos_prontos[0]
        buffer_unico = io.BytesIO(unico["dados"])
        mimetype = MIMETYPES_POR_FORMATO.get(unico["formato"], "application/octet-stream")
        resposta = send_file(
            buffer_unico,
            mimetype=mimetype,
            as_attachment=True,
            download_name=unico["nome_final"],
        )
    else:
        # Montagem do ZIP comprimido
        buffer_zip = io.BytesIO()
        with zipfile.ZipFile(buffer_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in arquivos_prontos:
                zf.writestr(item["nome_final"], item["dados"])

        buffer_zip.seek(0)
        resposta = send_file(
            buffer_zip,
            mimetype="application/zip",
            as_attachment=True,
            download_name="revela_convertido.zip",
        )

    resultados_json = json.dumps(metadados_resultados, ensure_ascii=True)
    resposta.headers["X-Resultados"] = resultados_json
    resposta.headers["Access-Control-Expose-Headers"] = "X-Resultados"
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
    return resposta


if __name__ == "__main__":
    app.run(debug=True, port=5000)