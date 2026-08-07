import io
import json
import zipfile

from flask import Flask, request, jsonify, render_template, send_file
from PIL import Image

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


def converter_uma_imagem(arquivo_stream, cfg):
    formato = (cfg.get("formato") or "PNG").upper()
    if formato not in FORMATOS_PILLOW:
        formato = "PNG"

    largura = cfg.get("largura") or None
    altura = cfg.get("altura") or None
    largura = int(largura) if largura else None
    altura = int(altura) if altura else None
    qualidade = int(cfg.get("qualidade") or 90)
    manter_proporcao = cfg.get("manter_proporcao", True)

    with Image.open(arquivo_stream) as img:
        img_convertida = img.convert("RGBA") if formato == "PNG" else img.convert("RGB")

        if largura or altura:
            largura_atual, altura_atual = img_convertida.size
            if manter_proporcao:
                if largura and not altura:
                    altura = round(altura_atual * (largura / largura_atual))
                elif altura and not largura:
                    largura = round(largura_atual * (altura / altura_atual))
                elif largura and altura:
                    img_convertida.thumbnail((largura, altura))
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
        return buffer.read(), img_convertida.size


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

    resultados = []
    buffer_zip = io.BytesIO()
    nomes_usados = set()

    with zipfile.ZipFile(buffer_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for arquivo in arquivos:
            cfg = config.get(arquivo.filename, {})
            try:
                dados_convertidos, dimensoes = converter_uma_imagem(arquivo.stream, cfg)

                formato = (cfg.get("formato") or "PNG").upper()
                if formato not in FORMATOS_PILLOW:
                    formato = "PNG"
                extensao = EXTENSAO_POR_FORMATO[formato]
                nome_base = arquivo.filename.rsplit(".", 1)[0]
                nome_saida = f"{nome_base}.{extensao}"

                # evita sobrescrever se dois arquivos originais viram o mesmo nome
                contador = 1
                nome_final = nome_saida
                while nome_final in nomes_usados:
                    nome_final = f"{nome_base}_{contador}.{extensao}"
                    contador += 1
                nomes_usados.add(nome_final)

                zf.writestr(nome_final, dados_convertidos)
                resultados.append({
                    "nome": arquivo.filename,
                    "status": "ok",
                    "salvo_como": nome_final,
                    "dimensoes": f"{dimensoes[0]}x{dimensoes[1]}",
                })
            except Exception as e:
                resultados.append({"nome": arquivo.filename, "status": "erro", "mensagem": str(e)})

    buffer_zip.seek(0)
    resposta = send_file(
        buffer_zip,
        mimetype="application/zip",
        as_attachment=True,
        download_name="convertido.zip",
    )
    resultados_json = json.dumps(resultados, ensure_ascii=True)
    resposta.headers["X-Resultados"] = resultados_json
    resposta.headers["Access-Control-Expose-Headers"] = "X-Resultados"
    return resposta


if __name__ == "__main__":
    print("\n  Conversor rodando! Abra no navegador: http://127.0.0.1:5000\n")
    app.run(debug=True, port=5000)