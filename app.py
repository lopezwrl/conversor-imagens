import concurrent.futures
import io
import json
import mimetypes
import re
import zipfile

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageOps

app = Flask(__name__)

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

MIMETYPES_POR_FORMATO = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "BMP": "image/bmp",
    "GIF": "image/gif",
    "TIFF": "image/tiff",
}

CARACTERES_INVALIDOS = re.compile(r'[\\/:*?"<>|]')
CARACTERES_CONTROLE = re.compile(r"[\x00-\x1f\x7f-\x9f]")


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


def converter_uma_imagem(dados_bytes, cfg):
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
    return resposta


if __name__ == "__main__":
    app.run(debug=True, port=5000)