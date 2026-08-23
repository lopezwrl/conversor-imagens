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
const loteModoRemocao = document.getElementById("lote-modo-remocao");
const barraProgressoContainer = document.getElementById("barra-progresso-container");
const barraProgresso = document.getElementById("barra-progresso");
const textoProgresso = document.getElementById("texto-progresso");
const etapasProcessamento = document.getElementById("etapas-processamento");

const EXTENSOES_VALIDAS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif"];

// ===== ÍCONES SVG (mesma linguagem visual do resto do site — sem emoji) =====
const ICONES = {
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
  pasta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  alerta: `<svg class="icone-alerta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
};

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
  backdrop.className = "modal-backdrop";

  const menu = document.createElement("div");
  menu.className = "modal-selecao";

  menu.innerHTML = `
    <h3 class="modal-titulo">${adicionar ? "Adicionar imagens" : "Escolha o modo"}</h3>
    <button id="m-btn-fotos" class="botao-primario modal-btn">${ICONES.camera}<span>Fotos</span></button>
    <button id="m-btn-pasta" class="botao-primario modal-btn">${ICONES.pasta}<span>Pasta</span></button>
    <button id="m-btn-cancelar" class="botao-secundario modal-btn">Cancelar</button>
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
      hash,
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

// ===== FORMATOS QUE NÃO SUPORTAM TRANSPARÊNCIA =====
const FORMATOS_SEM_ALPHA = ["JPEG", "BMP", "GIF"];

function precisaCorDeFundo(formato) {
  return FORMATOS_SEM_ALPHA.includes(formato);
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
        <button type="button" class="btn-remover-quadro" title="Remover esta imagem" aria-label="Remover esta imagem">${ICONES.x}</button>
        <img loading="lazy" src="${img.urlMiniatura}" alt="${img.nome}">
        <span class="badge-transparencia">Fundo será removido</span>
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
        <div class="linha-remover-fundo">
          <input type="checkbox" class="input-remover-fundo">
          <label>Remover fundo (IA)</label>
        </div>
        <div class="campo-modo-remocao">
          <label class="opcao-modo-remocao">
            <input type="radio" name="modo-remocao-${indice}" class="input-modo-remocao" value="automatico" checked>
            <span class="opcao-modo-titulo">Automático</span>
            <span class="opcao-modo-desc">Rápido para imagens com fundo simples.</span>
          </label>
          <label class="opcao-modo-remocao">
            <input type="radio" name="modo-remocao-${indice}" class="input-modo-remocao" value="inteligente">
            <span class="opcao-modo-titulo">Inteligente</span>
            <span class="opcao-modo-desc">Tenta separar objetos próximos ao produto.</span>
          </label>
          <label class="opcao-modo-remocao">
            <input type="radio" name="modo-remocao-${indice}" class="input-modo-remocao" value="manual">
            <span class="opcao-modo-titulo">Manual</span>
            <span class="opcao-modo-desc">Corrija detalhes usando o pincel.</span>
          </label>
        </div>
        <div class="campo-cor-fundo">
          <label>Cor de fundo</label>
          <input type="color" class="input-cor-fundo" value="#ffffff">
        </div>
        <p class="aviso-transparencia">
          ${ICONES.alerta}Este formato não suporta fundo transparente. Escolha uma cor de fundo ao lado ou use PNG/WEBP para manter a transparência.
        </p>
      </div>
    `;
    tiraFilme.appendChild(quadro);

    const selectFormato = quadro.querySelector(".input-formato");
    const checkboxRemoverFundo = quadro.querySelector(".input-remover-fundo");
    selectFormato.addEventListener("change", () => atualizarAvisoTransparencia(quadro));
    checkboxRemoverFundo.addEventListener("change", () => atualizarAvisoTransparencia(quadro));
    atualizarAvisoTransparencia(quadro);

    quadro.querySelector(".btn-remover-quadro").addEventListener("click", (e) => {
      e.stopPropagation();
      removerImagem(indice);
    });
  });
}

// ===== REMOVER UMA IMAGEM DA SELEÇÃO ATUAL (autonomia pro usuário) =====
function removerImagem(indice) {
  const [removida] = imagensAtuais.splice(indice, 1);
  if (removida) {
    hashImagensAdicionadas.delete(removida.hash);
    URL.revokeObjectURL(removida.urlMiniatura);
    const idxArquivo = arquivosAtuais.indexOf(removida.file);
    if (idxArquivo !== -1) arquivosAtuais.splice(idxArquivo, 1);
  }

  if (!imagensAtuais.length) {
    tiraFilme.innerHTML = "";
    painelLote.hidden = true;
    painelAcao.hidden = true;
    mensagemDestino.textContent = "";
    return;
  }

  montarGrade();
  mensagemDestino.textContent = `${imagensAtuais.length} imagem(ns) pronta(s) para conversão.`;
}

// ===== ATUALIZAR AVISO DE TRANSPARÊNCIA / PRÉ-VISUALIZAÇÃO QUADRICULADA =====
function atualizarAvisoTransparencia(quadro) {
  const formato = quadro.querySelector(".input-formato").value;
  const removerFundo = quadro.querySelector(".input-remover-fundo").checked;
  const campoCor = quadro.querySelector(".campo-cor-fundo");
  const aviso = quadro.querySelector(".aviso-transparencia");
  const badge = quadro.querySelector(".badge-transparencia");
  const miniatura = quadro.querySelector(".miniatura-caixa");

  const mostrarAvisoCor = removerFundo && precisaCorDeFundo(formato);
  campoCor.classList.toggle("visivel", mostrarAvisoCor);
  aviso.classList.toggle("visivel", mostrarAvisoCor);

  badge.classList.toggle("visivel", removerFundo);
  miniatura.classList.toggle("fundo-sera-removido", removerFundo);

  const campoModo = quadro.querySelector(".campo-modo-remocao");
  if (campoModo) campoModo.classList.toggle("visivel", removerFundo);
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
  const removerFundoLote = document.getElementById("lote-remover-fundo")
    ? document.getElementById("lote-remover-fundo").value
    : "";
  const modoRemocaoLote = loteModoRemocao ? loteModoRemocao.value : "";

  document.querySelectorAll(".quadro").forEach((quadro) => {
    if (formato) quadro.querySelector(".input-formato").value = formato;
    if (largura) quadro.querySelector(".input-largura").value = largura;
    if (altura) quadro.querySelector(".input-altura").value = altura;
    if (qualidade) quadro.querySelector(".input-qualidade").value = qualidade;
    if (proporcao) quadro.querySelector(".input-proporcao").checked = proporcao === "on";
    if (removerFundoLote) {
      quadro.querySelector(".input-remover-fundo").checked = removerFundoLote === "on";
    }
    if (modoRemocaoLote) {
      const radio = quadro.querySelector(`.input-modo-remocao[value="${modoRemocaoLote}"]`);
      if (radio) radio.checked = true;
    }
    atualizarAvisoTransparencia(quadro);
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
    if (barraProgresso) barraProgresso.style.width = "0%";
    if (textoProgresso) textoProgresso.textContent = "Preparando...";
    if (etapasProcessamento) {
      etapasProcessamento.querySelectorAll(".etapa-ponto").forEach((p) => p.classList.remove("ativa", "concluida"));
      etapasProcessamento.hidden = false;
    }
    document.querySelectorAll(".quadro").forEach((q) => q.classList.add("carregando-shimmer"));
  } else {
    btnConverter.classList.remove("carregando");
    btnConverter.innerHTML = `<span class="btn-text">Revelar</span><span class="btn-icon">→</span>`;
    if (barraProgressoContainer) {
      barraProgressoContainer.classList.remove("ativo");
      setTimeout(() => { barraProgressoContainer.hidden = true; }, 300);
    }
    if (etapasProcessamento) etapasProcessamento.hidden = true;
    document.querySelectorAll(".quadro").forEach((q) => q.classList.remove("carregando-shimmer"));
  }
}

// ===== RÓTULOS DE ETAPA (para o indicador "Removendo fundo...", etc.) =====
const ROTULOS_ETAPA = {
  removendo_fundo: "Removendo fundo...",
  redimensionando: "Redimensionando...",
  convertendo: "Convertendo...",
};

// Peso relativo de cada etapa dentro do progresso de UMA imagem, para que
// a barra avance de forma real (nunca mostra 100% antes de terminar).
const PESO_ETAPA = { removendo_fundo: 0.15, redimensionando: 0.55, convertendo: 0.85 };

const ORDEM_ETAPAS = ["removendo_fundo", "redimensionando", "convertendo"];

function atualizarEtapaIndicador(etapa) {
  if (!etapasProcessamento) return;
  const idxAtual = ORDEM_ETAPAS.indexOf(etapa);
  etapasProcessamento.querySelectorAll(".etapa-ponto").forEach((ponto) => {
    const idx = ORDEM_ETAPAS.indexOf(ponto.dataset.etapa);
    ponto.classList.toggle("ativa", idx === idxAtual);
    ponto.classList.toggle("concluida", idxAtual !== -1 && idx < idxAtual);
  });
}

function atualizarProgresso(indice, total, etapaOuConcluido) {
  if (!barraProgresso || !textoProgresso) return;
  if (etapaOuConcluido === "concluido") {
    barraProgresso.style.width = "100%";
    textoProgresso.textContent = "Concluído";
    if (etapasProcessamento) {
      etapasProcessamento.querySelectorAll(".etapa-ponto").forEach((p) => {
        p.classList.remove("ativa");
        p.classList.add("concluida");
      });
    }
    return;
  }
  const base = (indice - 1) / total;
  const fracaoEtapa = (PESO_ETAPA[etapaOuConcluido] || 1) / total;
  const percentual = Math.min(99, Math.round((base + fracaoEtapa) * 100));
  barraProgresso.style.width = `${percentual}%`;
  const rotulo = ROTULOS_ETAPA[etapaOuConcluido] || "Processando...";
  textoProgresso.textContent = `Processando imagem ${indice} de ${total} — ${rotulo}`;
  atualizarEtapaIndicador(etapaOuConcluido);
}

// ===== BASE64 -> BLOB E DOWNLOAD =====
function base64ParaBlob(base64, mime) {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime || "application/octet-stream" });
}

function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ===== CONVERTER IMAGENS (streaming: progresso real + downloads corretos) =====

// Guarda, por nome de arquivo, o modo de remoção escolhido na última
// conversão — usado depois em exibirResultado() para saber quais itens
// mostram o botão "Editar máscara" (correção manual).
let modosRemocaoUltimaConversao = {};

async function converterImagens() {
  ativarCarregamento(true);
  mensagemErro.textContent = "";

  const formData = new FormData();
  const config = {};
  modosRemocaoUltimaConversao = {};
  let algumModoManual = false;

  document.querySelectorAll(".quadro").forEach((quadro) => {
    const indice = Number(quadro.dataset.indice);
    const img = imagensAtuais[indice];
    formData.append("arquivos", img.file, img.nome);

    const campoNome = quadro.querySelector(".input-nome-personalizado");
    const novoNomeBruto = campoNome ? campoNome.value.trim() : "";
    const removerFundoAtivo = quadro.querySelector(".input-remover-fundo").checked;
    const radioModo = quadro.querySelector(".input-modo-remocao:checked");
    const modoRemocao = radioModo ? radioModo.value : "automatico";

    if (removerFundoAtivo && modoRemocao === "manual") algumModoManual = true;
    modosRemocaoUltimaConversao[img.nome] = removerFundoAtivo ? modoRemocao : null;

    config[img.nome] = {
      formato: quadro.querySelector(".input-formato").value,
      largura: quadro.querySelector(".input-largura").value || null,
      altura: quadro.querySelector(".input-altura").value || null,
      qualidade: Number(quadro.querySelector(".input-qualidade").value) || 90,
      manter_proporcao: quadro.querySelector(".input-proporcao").checked,
      remover_fundo: removerFundoAtivo,
      modo_remocao: modoRemocao,
      cor_fundo: quadro.querySelector(".input-cor-fundo").value,
      novo_nome: novoNomeBruto || null,
    };
  });

  // O modo "Manual" precisa do arquivo individual (fora do zip) para abrir
  // o editor de máscara no navegador — por isso, se alguma imagem estiver
  // nesse modo, a entrega em ZIP é temporariamente desativada só nesta
  // conversão (a preferência do usuário na caixa de seleção não é alterada).
  const usarZipAtivo = usarZip.checked && !algumModoManual;
  if (algumModoManual && usarZip.checked) {
    mensagemDestino.textContent = "Modo Manual ativo: os arquivos serão entregues individualmente (sem ZIP) para permitir a correção com pincel.";
  }
  formData.append("config", JSON.stringify(config));
  formData.append("usar_zip", usarZipAtivo);

  const resultados = [];

  try {
    const resposta = await fetch("/api/converter-lote", { method: "POST", body: formData });

    if (resposta.status === 413) {
      mensagemErro.textContent = "Os arquivos enviados são grandes demais para o servidor processar de uma vez. Tente enviar menos imagens ou em resolução menor.";
      return;
    }

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      mensagemErro.textContent = erro.erro || "Erro na conversão.";
      return;
    }

    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder("utf-8");
    let restante = "";

    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;

      restante += decodificador.decode(value, { stream: true });
      const linhas = restante.split("\n");
      restante = linhas.pop(); // última linha pode estar incompleta

      for (const linha of linhas) {
        if (!linha.trim()) continue;
        let evento;
        try {
          evento = JSON.parse(linha);
        } catch {
          continue; // ignora linha corrompida isolada, sem derrubar o restante do lote
        }

        if (evento.tipo === "progresso") {
          atualizarProgresso(evento.indice, evento.total, evento.etapa);
        } else if (evento.tipo === "resultado") {
          resultados.push(evento);
          // Itens no modo "manual" NÃO são baixados aqui: o usuário ainda
          // vai corrigir a máscara no editor, e o download correto (já
          // corrigido) acontece só quando ele clicar em "Confirmar e
          // baixar" — baixar aqui também resultaria em dois arquivos por
          // imagem, um deles sempre desatualizado.
          const modoDoItem = modosRemocaoUltimaConversao[evento.nome];
          if (evento.status === "ok" && !usarZipAtivo && evento.dados && modoDoItem !== "manual") {
            const blob = base64ParaBlob(evento.dados, evento.mime);
            baixarBlob(blob, evento.salvo_como);
          }
        } else if (evento.tipo === "concluido") {
          atualizarProgresso(0, 1, "concluido");
          if (usarZipAtivo && evento.zip_base64) {
            const blob = base64ParaBlob(evento.zip_base64, "application/zip");
            baixarBlob(blob, evento.nome_zip || `${nomePastaAtual}_convertido.zip`);
          }
        }
      }
    }

    exibirResultado(resultados);
  } catch (erro) {
    mensagemErro.textContent = "Erro na comunicação com o servidor. Verifique sua conexão e tente novamente.";
  } finally {
    ativarCarregamento(false);
  }
}

function dispararConfete() {
  const cores = ["#2563eb", "#60a5fa", "#10b981", "#f59e0b"];
  const alvo = document.querySelector(".painel-resultado .section-header h2") || painelResultado;
  if (!alvo) return;
  const rect = alvo.getBoundingClientRect();
  const burst = document.createElement("div");
  burst.className = "confete-burst";
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top}px`;

  for (let i = 0; i < 18; i++) {
    const pedaco = document.createElement("span");
    pedaco.className = "confete";
    const angulo = Math.random() * Math.PI * 2;
    const distancia = 40 + Math.random() * 50;
    pedaco.style.setProperty("--dx", `${Math.cos(angulo) * distancia}px`);
    pedaco.style.setProperty("--dy", `${Math.sin(angulo) * distancia - 20}px`);
    pedaco.style.setProperty("--rot", `${Math.random() * 360}deg`);
    pedaco.style.background = cores[i % cores.length];
    pedaco.style.animationDelay = `${Math.random() * 0.1}s`;
    burst.appendChild(pedaco);
  }

  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1200);
}

function exibirResultado(resultados) {
  painelResultado.hidden = false;
  const sucesso = resultados.filter((r) => r.status === "ok").length;
  const falhas = resultados.length - sucesso;
  document.getElementById("resumo-resultado").textContent = falhas
    ? `${sucesso} imagem(ns) processada(s) com sucesso, ${falhas} com erro.`
    : `${sucesso} imagem(ns) processada(s) com sucesso!`;

  const lista = document.getElementById("lista-resultado");
  lista.innerHTML = "";
  resultados.forEach((r) => {
    const li = document.createElement("li");
    if (r.status === "ok") {
      const avisoHtml = r.aviso ? `<span class="aviso-resultado">${ICONES.alerta}${r.aviso}</span>` : "";
      li.innerHTML = `
        <span>${r.nome} → <strong>${r.salvo_como}</strong>${avisoHtml}</span>
        <span class="resultado-status-grupo">
          <span class="status-ok">${ICONES.check}${r.dimensoes}</span>
        </span>
      `;

      const modo = modosRemocaoUltimaConversao[r.nome];
      if (modo === "manual" && r.dados) {
        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "botao-secundario btn-editar-mascara";
        btnEditar.textContent = "Editar máscara";
        btnEditar.addEventListener("click", () => {
          abrirEditorMascara({
            dadosBase64: r.dados,
            mime: r.mime,
            nomeArquivo: r.salvo_como,
          });
        });
        li.querySelector(".resultado-status-grupo").appendChild(btnEditar);
      }
    } else {
      li.innerHTML = `<span>${r.nome}${r.mensagem ? ` — ${r.mensagem}` : ""}</span><span class="status-erro">${ICONES.x}Erro</span>`;
    }
    lista.appendChild(li);
  });

  painelResultado.scrollIntoView({ behavior: "smooth" });
  if (sucesso > 0) {
    setTimeout(dispararConfete, 350);
  }
}

// ===== EDITOR DE MÁSCARA (CORREÇÃO MANUAL — MODO "MANUAL") =====
// Funciona inteiramente no navegador: a imagem já processada volta do
// servidor como PNG com canal alpha, e o RGB de cada pixel é preservado
// pelo backend mesmo onde alpha=0 (ver background_remover.py), então o
// editor não precisa buscar o arquivo original — restaurar uma região
// simplesmente volta o alpha dela para 255 usando a cor já presente.
// A imagem original nunca é destruída: tudo acontece sobre uma máscara
// alpha separada (`alphaAtual`), editável e com desfazer/refazer.
function abrirEditorMascara({ dadosBase64, mime, nomeArquivo }) {
  const imagem = new Image();

  imagem.onerror = () => {
    mensagemErro.textContent = "Não foi possível abrir o editor: a imagem retornada está corrompida ou em um formato inesperado.";
  };

  imagem.onload = () => {
    let largura, altura;
    try {
      largura = imagem.naturalWidth;
      altura = imagem.naturalHeight;
      if (!largura || !altura) throw new Error("dimensões inválidas");
    } catch {
      mensagemErro.textContent = "Não foi possível abrir o editor para esta imagem.";
      return;
    }

    const canvasBase = document.createElement("canvas");
    canvasBase.width = largura;
    canvasBase.height = altura;
    const ctxBase = canvasBase.getContext("2d");
    ctxBase.drawImage(imagem, 0, 0);

    let dadosOriginais;
    try {
      dadosOriginais = ctxBase.getImageData(0, 0, largura, altura);
    } catch {
      mensagemErro.textContent = "Não foi possível ler os pixels da imagem para edição.";
      return;
    }

    const rgbOriginal = dadosOriginais.data; // RGB nunca é alterado pelo editor
    let alphaAtual = new Uint8ClampedArray(largura * altura);
    for (let i = 0; i < alphaAtual.length; i++) alphaAtual[i] = rgbOriginal[i * 4 + 3];

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop editor-mascara-backdrop";

    const painel = document.createElement("div");
    painel.className = "editor-mascara-painel";
    painel.innerHTML = `
      <div class="editor-mascara-cabecalho">
        <h3>Corrigir máscara — ${nomeArquivo}</h3>
        <button type="button" class="editor-mascara-fechar" title="Cancelar" aria-label="Cancelar">${ICONES.x}</button>
      </div>
      <div class="editor-mascara-ferramentas">
        <div class="editor-grupo-ferramenta">
          <button type="button" class="editor-btn-ferramenta ativo" data-ferramenta="remover">Remover</button>
          <button type="button" class="editor-btn-ferramenta" data-ferramenta="restaurar">Restaurar</button>
          <button type="button" class="editor-btn-ferramenta" data-ferramenta="mover" title="Arrastar a imagem para navegar">Mover</button>
        </div>
        <label class="editor-campo-pincel">
          Pincel
          <input type="range" min="4" max="150" value="30" class="editor-tamanho-pincel">
        </label>
        <div class="editor-grupo-ferramenta">
          <button type="button" class="editor-btn-zoom" data-delta="-1" aria-label="Diminuir zoom">−</button>
          <span class="editor-zoom-valor">100%</span>
          <button type="button" class="editor-btn-zoom" data-delta="1" aria-label="Aumentar zoom">+</button>
        </div>
        <div class="editor-grupo-ferramenta">
          <button type="button" class="editor-btn-desfazer">Desfazer</button>
          <button type="button" class="editor-btn-refazer">Refazer</button>
        </div>
      </div>
      <p class="editor-mascara-dica">Dica: com qualquer ferramenta ativa, arraste segurando o botão do meio do mouse para navegar pela imagem.</p>
      <div class="editor-mascara-tela-container">
        <div class="editor-mascara-tela-quadriculado">
          <canvas class="editor-mascara-canvas"></canvas>
        </div>
      </div>
      <div class="editor-mascara-rodape">
        <button type="button" class="botao-secundario editor-btn-cancelar">Cancelar</button>
        <button type="button" class="botao-primario editor-btn-confirmar">Confirmar e baixar</button>
      </div>
    `;
    document.body.appendChild(backdrop);
    document.body.appendChild(painel);

    const canvas = painel.querySelector(".editor-mascara-canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");

    let zoom = Math.max(0.1, Math.min(1, 640 / largura));
    const zoomValor = painel.querySelector(".editor-zoom-valor");

    function aplicarZoom() {
      canvas.style.width = `${largura * zoom}px`;
      canvas.style.height = `${altura * zoom}px`;
      zoomValor.textContent = `${Math.round(zoom * 100)}%`;
    }
    aplicarZoom();

    function renderizar() {
      const quadro = ctx.createImageData(largura, altura);
      for (let i = 0; i < alphaAtual.length; i++) {
        const base = i * 4;
        quadro.data[base] = rgbOriginal[base];
        quadro.data[base + 1] = rgbOriginal[base + 1];
        quadro.data[base + 2] = rgbOriginal[base + 2];
        quadro.data[base + 3] = alphaAtual[i];
      }
      ctx.putImageData(quadro, 0, 0);
    }
    renderizar();

    // ----- desfazer / refazer -----
    const LIMITE_HISTORICO = 20;
    const pilhaDesfazer = [];
    const pilhaRefazer = [];

    function salvarEstadoParaDesfazer() {
      pilhaDesfazer.push(alphaAtual.slice());
      if (pilhaDesfazer.length > LIMITE_HISTORICO) pilhaDesfazer.shift();
      pilhaRefazer.length = 0;
    }

    painel.querySelector(".editor-btn-desfazer").addEventListener("click", () => {
      if (!pilhaDesfazer.length) return;
      pilhaRefazer.push(alphaAtual.slice());
      alphaAtual = pilhaDesfazer.pop();
      renderizar();
    });
    painel.querySelector(".editor-btn-refazer").addEventListener("click", () => {
      if (!pilhaRefazer.length) return;
      pilhaDesfazer.push(alphaAtual.slice());
      alphaAtual = pilhaRefazer.pop();
      renderizar();
    });

    // ----- ferramenta (remover / restaurar / mover) e tamanho do pincel -----
    let ferramentaAtiva = "remover";

    function atualizarCursor() {
      if (arrastandoTela) {
        canvas.style.cursor = "grabbing";
      } else {
        canvas.style.cursor = ferramentaAtiva === "mover" ? "grab" : "crosshair";
      }
    }

    painel.querySelectorAll(".editor-btn-ferramenta").forEach((btn) => {
      btn.addEventListener("click", () => {
        painel.querySelectorAll(".editor-btn-ferramenta").forEach((b) => b.classList.remove("ativo"));
        btn.classList.add("ativo");
        ferramentaAtiva = btn.dataset.ferramenta;
        // Troca de ferramenta sempre encerra qualquer arraste/pintura em
        // andamento — evita que um estado "preso" (ex.: o botão do mouse
        // foi solto fora da janela, como ao abrir o diálogo "Salvar
        // como", e o navegador nunca disparou o pointerup) impeça as
        // outras ferramentas de responderem depois.
        pintando = false;
        pararArrasteTela();
        atualizarCursor();
      });
    });

    const inputPincel = painel.querySelector(".editor-tamanho-pincel");
    let tamanhoPincel = Number(inputPincel.value);
    inputPincel.addEventListener("input", () => { tamanhoPincel = Number(inputPincel.value); });

    // ----- zoom -----
    painel.querySelectorAll(".editor-btn-zoom").forEach((btn) => {
      btn.addEventListener("click", () => {
        zoom = Math.min(4, Math.max(0.1, zoom + Number(btn.dataset.delta) * 0.15));
        aplicarZoom();
      });
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoom = Math.min(4, Math.max(0.1, zoom + (e.deltaY < 0 ? 0.1 : -0.1)));
      aplicarZoom();
    }, { passive: false });

    // ----- mover a tela (ferramenta "Mover" OU arrastar com o botão do meio do mouse, a qualquer momento) -----
    const containerTela = painel.querySelector(".editor-mascara-tela-container");
    let arrastandoTela = false;
    let ultimoPonteiroX = 0;
    let ultimoPonteiroY = 0;

    function iniciarArrasteTela(e) {
      arrastandoTela = true;
      ultimoPonteiroX = e.clientX;
      ultimoPonteiroY = e.clientY;
      atualizarCursor();
    }

    function moverArrasteTela(e) {
      containerTela.scrollLeft -= (e.clientX - ultimoPonteiroX);
      containerTela.scrollTop -= (e.clientY - ultimoPonteiroY);
      ultimoPonteiroX = e.clientX;
      ultimoPonteiroY = e.clientY;
    }

    function pararArrasteTela() {
      if (!arrastandoTela) return;
      arrastandoTela = false;
      atualizarCursor();
    }

    // botão do meio do mouse arrasta independentemente da ferramenta ativa
    canvas.addEventListener("auxclick", (e) => e.preventDefault());
    canvas.addEventListener("contextmenu", (e) => { if (arrastandoTela) e.preventDefault(); });

    // ----- pintura (pincéis Remover / Restaurar sobre a máscara alpha) -----
    let pintando = false;
    let ultimoX = 0;
    let ultimoY = 0;

    function coordenadasCanvas(evento) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (evento.clientX - rect.left) * (largura / rect.width),
        y: (evento.clientY - rect.top) * (altura / rect.height),
      };
    }

    function pintarCirculo(cx, cy, raio, valor) {
      const x0 = Math.max(0, Math.floor(cx - raio));
      const x1 = Math.min(largura - 1, Math.ceil(cx + raio));
      const y0 = Math.max(0, Math.floor(cy - raio));
      const y1 = Math.min(altura - 1, Math.ceil(cy + raio));
      const raio2 = raio * raio;
      for (let y = y0; y <= y1; y++) {
        const linhaBase = y * largura;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= raio2) alphaAtual[linhaBase + x] = valor;
        }
      }
    }

    // Carimba círculos ao LONGO de todo o segmento entre o ponto anterior e o
    // atual (não só nos dois extremos) — sem isso, um movimento rápido do
    // mouse/caneta pula pontos intermediários e o traço sai "pontilhado",
    // com falhas entre um carimbo e outro em vez de uma pincelada contínua.
    function pintarTraco(x0, y0, x1, y1, raio, valor) {
      const distancia = Math.hypot(x1 - x0, y1 - y0);
      const espacamento = Math.max(1, raio / 4);
      const passos = Math.max(1, Math.ceil(distancia / espacamento));
      for (let i = 0; i <= passos; i++) {
        const t = i / passos;
        pintarCirculo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, raio, valor);
      }
    }

    canvas.addEventListener("pointerdown", (e) => {
      // captura o ponteiro no canvas: garante que pointermove/pointerup
      // continuem chegando aqui mesmo que o cursor saia da área do canvas
      // durante o arraste (ex.: arrastar rápido demais e "escapar" da tela).
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ignora se o navegador recusar */ }
      }
      // botão do meio (1) sempre arrasta a tela, não importa a ferramenta ativa
      if (e.button === 1 || ferramentaAtiva === "mover") {
        e.preventDefault();
        iniciarArrasteTela(e);
        return;
      }
      pintando = true;
      salvarEstadoParaDesfazer();
      const { x, y } = coordenadasCanvas(e);
      ultimoX = x;
      ultimoY = y;
      pintarCirculo(x, y, tamanhoPincel / 2, ferramentaAtiva === "remover" ? 0 : 255);
      renderizar();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (arrastandoTela) {
        moverArrasteTela(e);
        return;
      }
      if (!pintando) return;
      const { x, y } = coordenadasCanvas(e);
      pintarTraco(ultimoX, ultimoY, x, y, tamanhoPincel / 2, ferramentaAtiva === "remover" ? 0 : 255);
      ultimoX = x;
      ultimoY = y;
      renderizar();
    });
    function finalizarGestoPonteiro() {
      pintando = false;
      pararArrasteTela();
    }
    window.addEventListener("pointerup", finalizarGestoPonteiro);
    // pointercancel: o navegador interrompe o gesto no meio (ex.: um
    // diálogo do sistema operacional — "Salvar como", seleção de arquivo —
    // abre enquanto o botão do mouse ainda está pressionado). Sem tratar
    // isso, "arrastandoTela"/"pintando" ficavam presos em true e nenhuma
    // ferramenta respondia depois, mesmo trocando o botão ativo.
    canvas.addEventListener("pointercancel", finalizarGestoPonteiro);
    window.addEventListener("blur", finalizarGestoPonteiro);

    atualizarCursor();

    // ----- fechar / cancelar / confirmar -----
    function fechar() {
      backdrop.remove();
      painel.remove();
    }
    painel.querySelector(".editor-mascara-fechar").addEventListener("click", fechar);
    painel.querySelector(".editor-btn-cancelar").addEventListener("click", fechar);
    backdrop.addEventListener("click", fechar);

    painel.querySelector(".editor-btn-confirmar").addEventListener("click", () => {
      canvas.toBlob((blob) => {
        if (!blob) {
          mensagemErro.textContent = "Não foi possível gerar o arquivo corrigido.";
          return;
        }
        baixarBlob(blob, nomeArquivo);
        fechar();
      }, "image/png");
    });
  };

  imagem.src = `data:${mime};base64,${dadosBase64}`;
}

btnAplicarLote.addEventListener("click", aplicarLoteATodos);
btnConverter.addEventListener("click", converterImagens);