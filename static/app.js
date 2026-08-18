let arquivosAtuais = [];
let imagensAtuais = [];
let nomePastaAtual = "convertidas";
let hashImagensAdicionadas = new Set();

const zonaArraste = document.getElementById("zona-arraste");
const inputFotos = document.getElementById("input-fotos");
const inputPasta = document.getElementById("input-pasta");
const mensagemErro = document.getElementById("mensagem-erro");
const tiraFilme = document.getElementById("tira-filme");
const painelLote = document.getElementById("painel-lote");
const painelAcao = document.getElementById("painel-acao");
const painelResultado = document.getElementById("painel-resultado");
const mensagemDestino = document.getElementById("mensagem-destino");
const btnConverter = document.getElementById("btn-converter");
const btnAplicarLote = document.getElementById("btn-aplicar-lote");
const btnAdicionarMais = document.getElementById("btn-adicionar-mais");
const btnNovaSessao = document.getElementById("btn-nova-sessao");
const usarZip = document.getElementById("usar-zip");
const toggleTema = document.getElementById("toggle-tema");
const loteNomeBase = document.getElementById("lote-nome-base");
const barraProgressoContainer = document.getElementById("barra-progresso-container");

const EXTENSOES_VALIDAS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif"];

// ===== CRIAR HASH ÚNICO PARA ARQUIVO =====
async function gerarHashArquivo(arquivo) {
  const buffer = await arquivo.slice(0, 1024 * 1024).arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== DARK MODE =====
function iniciarTema() {
  const temaSalvo = localStorage.getItem("tema") || "light";
  aplicarTema(temaSalvo);
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem("tema", tema);
}

function trocarTema() {
  const temaAtual = document.documentElement.getAttribute("data-theme") || "light";
  aplicarTema(temaAtual === "light" ? "dark" : "light");
}

toggleTema.addEventListener("click", trocarTema);
iniciarTema();

// ===== VERIFICAR SUPORTE =====
function verificarSuporteArraste() {
  const testeInput = document.createElement('input');
  const temSuporteWebkit = DataTransferItem && DataTransferItem.prototype && 'webkitGetAsEntry' in DataTransferItem.prototype;
  const temSuporteFolders = 'webkitdirectory' in testeInput || 'msdirectory' in testeInput;

  if (!temSuporteWebkit || !temSuporteFolders) {
    document.getElementById("aviso-navegador").hidden = false;
    return false;
  }
  return true;
}

const navegadorCompativel = verificarSuporteArraste();

function extensaoDoArquivo(nome) {
  return nome.split(".").pop().toLowerCase();
}

function extensaoValida(nome) {
  return EXTENSOES_VALIDAS.includes(extensaoDoArquivo(nome));
}

function nomeBaseSemExtensao(nome) {
  const idx = nome.lastIndexOf(".");
  return idx > 0 ? nome.substring(0, idx) : nome;
}

let modoAdicionar = false;

// ===== INPUT EVENT LISTENERS =====
if (inputFotos) {
  inputFotos.addEventListener("change", () => {
    const todos = Array.from(inputFotos.files);
    if (!todos.length) return;

    if (!modoAdicionar) nomePastaAtual = "fotos_selecionadas";
    const validos = todos.filter(f => extensaoValida(f.name));
    processarArquivos(validos, modoAdicionar);
    inputFotos.value = "";
    modoAdicionar = false;
  });
}

if (inputPasta) {
  inputPasta.addEventListener("change", () => {
    const todos = Array.from(inputPasta.files);
    if (!todos.length) return;

    if (!modoAdicionar) {
      nomePastaAtual = (todos[0].webkitRelativePath || todos[0].name).split("/")[0];
    }
    usarZip.checked = true;
    const validos = todos.filter(f => extensaoValida(f.name));
    processarArquivos(validos, modoAdicionar);
    inputPasta.value = "";
    modoAdicionar = false;
  });
}

// ===== DRAG & DROP =====
function lerArquivosDeDiretorio(entradaDiretorio) {
  return new Promise((resolve) => {
    const leitor = entradaDiretorio.createReader();
    const encontrados = [];

    function lerLote() {
      leitor.readEntries(async (entradas) => {
        if (!entradas.length) {
          resolve(encontrados);
          return;
        }
        for (const entrada of entradas) {
          if (entrada.isFile && extensaoValida(entrada.name)) {
            const arquivo = await new Promise((res) => entrada.file(res));
            encontrados.push(arquivo);
          } else if (entrada.isDirectory) {
            const subArquivos = await lerArquivosDeDiretorio(entrada);
            encontrados.push(...subArquivos);
          }
        }
        lerLote();
      });
    }
    lerLote();
  });
}

["dragenter", "dragover"].forEach((evt) => {
  zonaArraste.addEventListener(evt, (e) => {
    e.preventDefault();
    zonaArraste.classList.add("sobre-arraste");
  });
});

["dragleave", "dragend"].forEach((evt) => {
  zonaArraste.addEventListener(evt, () => zonaArraste.classList.remove("sobre-arraste"));
});

zonaArraste.addEventListener("drop", async (e) => {
  e.preventDefault();
  zonaArraste.classList.remove("sobre-arraste");
  mensagemErro.textContent = "";

  if (!navegadorCompativel) {
    mensagemErro.textContent = "Navegador incompatível. Use Chrome, Edge ou Brave.";
    return;
  }

  const items = e.dataTransfer.items;
  if (!items || !items.length) return;

  const entradas = [];
  for (let i = 0; i < items.length; i++) {
    const entrada = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
    if (entrada) entradas.push(entrada);
  }

  const encontrados = [];
  let temPasta = false;

  for (const entrada of entradas) {
    if (entrada.isDirectory) {
      temPasta = true;
      nomePastaAtual = entrada.name;
      const arquivos = await lerArquivosDeDiretorio(entrada);
      encontrados.push(...arquivos);
    } else if (entrada.isFile && extensaoValida(entrada.name)) {
      const arquivo = await new Promise((res) => entrada.file(res));
      encontrados.push(arquivo);
    }
  }

  if (!encontrados.length) {
    mensagemErro.textContent = "Nenhuma imagem válida encontrada.";
    return;
  }

  usarZip.checked = (encontrados.length + imagensAtuais.length) >= 4 || temPasta;
  processarArquivos(encontrados, modoAdicionar);
  modoAdicionar = false;
});

// ===== MODAL SELEÇÃO =====
function abrirMenuSelecao(adicionar = false) {
  modoAdicionar = adicionar;

  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
    z-index: 9998; animation: fadeIn 0.2s ease;
  `;

  const menu = document.createElement("div");
  menu.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 20px; padding: 2.5rem; z-index: 9999;
    box-shadow: var(--shadow-xl); text-align: center; width: 320px;
  `;

  menu.innerHTML = `
    <h3 style="margin-bottom: 1.5rem; color: var(--text-primary);">${adicionar ? "Adicionar imagens" : "Escolha o modo"}</h3>
    <button id="m-btn-fotos" class="botao-primario" style="width:100%; margin-bottom:0.8rem; justify-content:center;">📸 Fotos</button>
    <button id="m-btn-pasta" class="botao-primario" style="width:100%; margin-bottom:0.8rem; justify-content:center;">📁 Pasta</button>
    <button id="m-btn-cancelar" class="botao-secundario" style="width:100%;">Cancelar</button>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(menu);

  const fechar = () => {
    backdrop.remove();
    menu.remove();
  };

  menu.querySelector("#m-btn-fotos").onclick = () => { fechar(); inputFotos.click(); };
  menu.querySelector("#m-btn-pasta").onclick = () => { fechar(); inputPasta.click(); };
  menu.querySelector("#m-btn-cancelar").onclick = () => { fechar(); modoAdicionar = false; };
  backdrop.onclick = fechar;
}

zonaArraste.addEventListener("click", () => abrirMenuSelecao(false));
if (btnAdicionarMais) btnAdicionarMais.addEventListener("click", () => abrirMenuSelecao(true));

if (btnNovaSessao) {
  btnNovaSessao.addEventListener("click", () => {
    imagensAtuais = [];
    arquivosAtuais = [];
    hashImagensAdicionadas.clear();
    tiraFilme.innerHTML = "";
    painelLote.hidden = true;
    painelAcao.hidden = true;
    painelResultado.hidden = true;
    mensagemErro.textContent = "";
    if (loteNomeBase) loteNomeBase.value = "";
    zonaArraste.scrollIntoView({ behavior: "smooth" });
  });
}

// ===== PROCESSAR ARQUIVOS =====
async function processarArquivos(arquivos, adicionar = false) {
  if (!adicionar) {
    arquivosAtuais = [];
    imagensAtuais = [];
    hashImagensAdicionadas.clear();
  }

  for (const arquivo of arquivos) {
    const hash = await gerarHashArquivo(arquivo);
    if (hashImagensAdicionadas.has(hash)) continue;

    let largura = 0, altura = 0;
    try {
      const bitmap = await createImageBitmap(arquivo);
      largura = bitmap.width;
      altura = bitmap.height;
      bitmap.close();
    } catch { continue; }

    hashImagensAdicionadas.add(hash);
    arquivosAtuais.push(arquivo);

    imagensAtuais.push({
      file: arquivo,
      nome: arquivo.name,
      nomeBase: nomeBaseSemExtensao(arquivo.name),
      largura,
      altura,
      tamanhoKB: Math.round((arquivo.size / 1024) * 10) / 10,
      urlMiniatura: URL.createObjectURL(arquivo),
      formatoOriginal: extensaoDoArquivo(arquivo.name).toUpperCase() === "JPG" ? "JPEG" : extensaoDoArquivo(arquivo.name).toUpperCase(),
    });
  }

  if (!imagensAtuais.length) {
    mensagemErro.textContent = "Nenhuma imagem nova para adicionar.";
    return;
  }

  montarGrade();
  painelLote.hidden = false;
  painelAcao.hidden = false;
  painelResultado.hidden = true;

  mensagemDestino.textContent = `${imagensAtuais.length} imagem(ns) pronta(s) para conversão.`;
}

// ===== MONTAR GRADE =====
function montarGrade() {
  tiraFilme.innerHTML = "";
  const prefixoLote = loteNomeBase ? loteNomeBase.value.trim() : "";

  imagensAtuais.forEach((img, indice) => {
    const quadro = document.createElement("article");
    quadro.className = "quadro";
    quadro.dataset.indice = indice;
    quadro.style.animationDelay = `${Math.min(indice * 0.04, 0.4)}s`;

    const opcoesFormato = ["PNG", "JPEG", "WEBP", "BMP", "GIF", "TIFF"]
      .map((f) => `<option value="${f}" ${f === img.formatoOriginal ? "selected" : ""}>${f}</option>`)
      .join("");

    const valorNome = prefixoLote ? `${prefixoLote}_${indice + 1}` : "";
    const placeholderNome = img.nomeBase;

    quadro.innerHTML = `
      <div class="miniatura-caixa">
        <img loading="lazy" src="${img.urlMiniatura}" alt="${img.nome}">
      </div>
      <div class="info-quadro">
        <p class="nome-arquivo">${img.nome}</p>
        <p class="meta-arquivo">${img.largura}×${img.altura}px · ${img.tamanhoKB}KB</p>
      </div>
      <div class="controles-quadro">
        <div class="campo-mini campo-mini-largura-total">
          <label>Nome do Arquivo</label>
          <input type="text" class="input-nome-personalizado" value="${valorNome}" placeholder="${placeholderNome}">
        </div>
        <div class="campo-mini">
          <label>Formato</label>
          <select class="input-formato">${opcoesFormato}</select>
        </div>
        <div class="campo-mini">
          <label>Qualidade</label>
          <input type="number" class="input-qualidade" min="1" max="100" value="90">
        </div>
        <div class="campo-mini">
          <label>Largura</label>
          <input type="number" class="input-largura" min="1" placeholder="${img.largura}">
        </div>
        <div class="campo-mini">
          <label>Altura</label>
          <input type="number" class="input-altura" min="1" placeholder="${img.altura}">
        </div>
        <div class="linha-proporcao">
          <input type="checkbox" class="input-proporcao" checked>
          <label>Manter proporção</label>
        </div>
      </div>
    `;
    tiraFilme.appendChild(quadro);
  });
}

// ===== APLICAR LOTE EM TEMPO REAL =====
function aplicarNomeLote() {
  if (!loteNomeBase) return;
  const padrao = loteNomeBase.value.trim();
  const quadros = document.querySelectorAll(".quadro");

  quadros.forEach((quadro, indice) => {
    const input = quadro.querySelector(".input-nome-personalizado");
    if (input) {
      input.value = padrao ? `${padrao}_${indice + 1}` : "";
    }
  });
}

if (loteNomeBase) {
  loteNomeBase.addEventListener("input", aplicarNomeLote);
}

function aplicarLoteATodos() {
  const formato = document.getElementById("lote-formato").value;
  const largura = document.getElementById("lote-largura").value;
  const altura = document.getElementById("lote-altura").value;
  const qualidade = document.getElementById("lote-qualidade").value;
  const proporcao = document.getElementById("lote-proporcao").value;

  document.querySelectorAll(".quadro").forEach((quadro) => {
    if (formato) quadro.querySelector(".input-formato").value = formato;
    if (largura) quadro.querySelector(".input-largura").value = largura;
    if (altura) quadro.querySelector(".input-altura").value = altura;
    if (qualidade) quadro.querySelector(".input-qualidade").value = qualidade;
    if (proporcao) quadro.querySelector(".input-proporcao").checked = proporcao === "on";
  });
}

// ===== ESTADO VISUAL DE CARREGAMENTO =====
function ativarCarregamento(ativo) {
  btnConverter.disabled = ativo;

  if (ativo) {
    btnConverter.classList.add("carregando");
    btnConverter.innerHTML = `<span class="spinner"></span><span class="btn-text">Revelando...</span>`;
    if (barraProgressoContainer) {
      barraProgressoContainer.hidden = false;
      barraProgressoContainer.classList.add("ativo");
    }
    document.querySelectorAll(".quadro").forEach((q) => q.classList.add("carregando-shimmer"));
  } else {
    btnConverter.classList.remove("carregando");
    btnConverter.innerHTML = `<span class="btn-text">Revelar</span><span class="btn-icon">→</span>`;
    if (barraProgressoContainer) {
      barraProgressoContainer.classList.remove("ativo");
      setTimeout(() => { barraProgressoContainer.hidden = true; }, 300);
    }
    document.querySelectorAll(".quadro").forEach((q) => q.classList.remove("carregando-shimmer"));
  }
}

// ===== CONVERTER IMAGENS =====
async function converterImagens() {
  ativarCarregamento(true);

  const formData = new FormData();
  const config = {};

  document.querySelectorAll(".quadro").forEach((quadro) => {
    const indice = Number(quadro.dataset.indice);
    const img = imagensAtuais[indice];
    formData.append("arquivos", img.file, img.nome);

    const campoNome = quadro.querySelector(".input-nome-personalizado");
    const novoNomeBruto = campoNome ? campoNome.value.trim() : "";

    config[img.nome] = {
      formato: quadro.querySelector(".input-formato").value,
      largura: quadro.querySelector(".input-largura").value || null,
      altura: quadro.querySelector(".input-altura").value || null,
      qualidade: Number(quadro.querySelector(".input-qualidade").value) || 90,
      manter_proporcao: quadro.querySelector(".input-proporcao").checked,
      novo_nome: novoNomeBruto || null,
    };
  });

  formData.append("config", JSON.stringify(config));
  formData.append("usar_zip", usarZip.checked);

  try {
    const resposta = await fetch("/api/converter-lote", { method: "POST", body: formData });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      mensagemErro.textContent = erro.erro || "Erro na conversão.";
      return;
    }

    const cabecalhoResultados = resposta.headers.get("X-Resultados");
    const resultados = cabecalhoResultados ? JSON.parse(cabecalhoResultados) : [];

    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nomePastaAtual}_convertido.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    exibirResultado(resultados);
  } catch (erro) {
    mensagemErro.textContent = "Erro na comunicação com o servidor.";
  } finally {
    ativarCarregamento(false);
  }
}

function exibirResultado(resultados) {
  painelResultado.hidden = false;
  document.getElementById("resumo-resultado").textContent = `${resultados.length} imagem(ns) processada(s) com sucesso!`;

  const lista = document.getElementById("lista-resultado");
  lista.innerHTML = "";
  resultados.forEach((r) => {
    const li = document.createElement("li");
    li.innerHTML = r.status === "ok"
      ? `<span>${r.nome} → <strong>${r.salvo_como}</strong></span><span class="status-ok">✓ ${r.dimensoes}</span>`
      : `<span>${r.nome}</span><span class="status-erro">✕ Erro</span>`;
    lista.appendChild(li);
  });

  painelResultado.scrollIntoView({ behavior: "smooth" });
}

btnAplicarLote.addEventListener("click", aplicarLoteATodos);
btnConverter.addEventListener("click", converterImagens);