let arquivosAtuais = [];
let imagensAtuais = [];
let nomePastaAtual = "convertidas";
let hashImagensAdicionadas = new Set();
<<<<<<< HEAD

=======
let modoAdicionar = false;

// Elementos do DOM
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
const zonaArraste = document.getElementById("zona-arraste");
const inputFotos = document.getElementById("input-fotos");
const inputPasta = document.getElementById("input-pasta");
const mensagemErro = document.getElementById("mensagem-erro");
const tiraFilme = document.getElementById("tira-filme");
<<<<<<< HEAD
=======
const secaoTiraFilme = document.getElementById("secao-tira-filme");
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
const painelLote = document.getElementById("painel-lote");
const painelAcao = document.getElementById("painel-acao");
const painelResultado = document.getElementById("painel-resultado");
const mensagemDestino = document.getElementById("mensagem-destino");
const btnConverter = document.getElementById("btn-converter");
const btnAplicarLote = document.getElementById("btn-aplicar-lote");
const btnAdicionarMais = document.getElementById("btn-adicionar-mais");
const btnNovaSessao = document.getElementById("btn-nova-sessao");
<<<<<<< HEAD
const usarZip = document.getElementById("usar-zip");
const toggleTema = document.getElementById("toggle-tema");
const loteNomeBase = document.getElementById("lote-nome-base");
const loteModoRemocao = document.getElementById("lote-modo-remocao");
const barraProgressoContainer = document.getElementById("barra-progresso-container");
const barraProgresso = document.getElementById("barra-progresso");
const textoProgresso = document.getElementById("texto-progresso");
const etapasProcessamento = document.getElementById("etapas-processamento");
const filaProcessamento = document.getElementById("fila-processamento");
const filaLista = document.getElementById("fila-lista");
const filaContador = document.getElementById("fila-contador");
const estatisticasResultado = document.getElementById("estatisticas-resultado");
const gradeResultado = document.getElementById("grade-resultado");

const EXTENSOES_VALIDAS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif"];

// ===== ÍCONES SVG (mesma linguagem visual do resto do site — sem emoji) =====
const ICONES = {
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
  pasta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  alerta: `<svg class="icone-alerta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  seta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="15 6 21 12 15 18"></polyline><polyline points="9 6 3 12 9 18"></polyline></svg>`,
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
=======
const btnLimparTudoTopo = document.getElementById("btn-limpar-tudo-topo");
const usarZip = document.getElementById("usar-zip");
const toggleTema = document.getElementById("toggle-tema");
const loteNomeBase = document.getElementById("lote-nome-base");
const barraProgressoContainer = document.getElementById("barra-progresso-container");
const progressoLegenda = document.getElementById("progresso-legenda");
const contadorImagensChip = document.getElementById("contador-imagens-chip");

// Atalhos rápidos de upload
const btnAtalhoFotos = document.getElementById("btn-atalho-fotos");
const btnAtalhoPasta = document.getElementById("btn-atalho-pasta");

// Lightbox
const modalLightbox = document.getElementById("modal-lightbox");
const lightboxBackdrop = document.getElementById("lightbox-backdrop");
const lightboxFechar = document.getElementById("lightbox-fechar");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxNome = document.getElementById("lightbox-nome");
const lightboxMeta = document.getElementById("lightbox-meta");

// Toasts e Confetes
const toastContainer = document.getElementById("toast-container");
const canvasConfetti = document.getElementById("canvas-confetti");

const EXTENSOES_VALIDAS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif"];

// ===== SISTEMA DE TOASTS FLUTUANTES =====
function mostrarToast(mensagem, tipo = "info") {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;

  const icones = {
    info: `<svg class="icone-svg toast-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    sucesso: `<svg class="icone-svg toast-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    erro: `<svg class="icone-svg toast-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    aviso: `<svg class="icone-svg toast-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap: 0.65rem;">
      ${icones[tipo] || icones.info}
      <span>${mensagem}</span>
    </div>
    <button style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;margin-left:0.5rem;display:flex;align-items:center;" aria-label="Fechar">
      <svg class="icone-svg" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  const fechar = () => {
    toast.classList.add("saindo");
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector("button").onclick = fechar;
  toastContainer.appendChild(toast);

  setTimeout(fechar, 3800);
}

// ===== SISTEMA DE CONFETES EM CANVAS =====
function dispararConfetes() {
  if (!canvasConfetti) return;
  const ctx = canvasConfetti.getContext("2d");
  const largura = (canvasConfetti.width = window.innerWidth);
  const altura = (canvasConfetti.height = window.innerHeight);

  const cores = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#6366f1"];
  const particulas = [];

  for (let i = 0; i < 90; i++) {
    particulas.push({
      x: largura / 2 + (Math.random() - 0.5) * 200,
      y: altura * 0.4,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      size: Math.random() * 8 + 4,
      cor: cores[Math.floor(Math.random() * cores.length)],
      rotacao: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      opacidade: 1,
    });
  }

  let tempoInicio = Date.now();

  function animar() {
    ctx.clearRect(0, 0, largura, altura);
    const decorrido = Date.now() - tempoInicio;

    particulas.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravidade
      p.rotacao += p.vRot;
      p.opacidade = Math.max(0, 1 - decorrido / 2600);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotacao * Math.PI) / 180);
      ctx.fillStyle = p.cor;
      ctx.globalAlpha = p.opacidade;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    });

    if (decorrido < 2600) {
      requestAnimationFrame(animar);
    } else {
      ctx.clearRect(0, 0, largura, altura);
    }
  }

  requestAnimationFrame(animar);
}

// ===== CRIAR HASH ÚNICO PARA ARQUIVO =====
async function gerarHashArquivo(arquivo) {
  try {
    const buffer = await arquivo.slice(0, 1024 * 1024).arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`;
  }
}

// ===== TEMA CLARO / ESCURO =====
function iniciarTema() {
  const temaSalvo = localStorage.getItem("revela_tema") || 
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
  aplicarTema(temaSalvo);
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
<<<<<<< HEAD
  localStorage.setItem("tema", tema);
=======
  localStorage.setItem("revela_tema", tema);
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
}

function trocarTema() {
  const temaAtual = document.documentElement.getAttribute("data-theme") || "light";
  aplicarTema(temaAtual === "light" ? "dark" : "light");
}

<<<<<<< HEAD
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

=======
if (toggleTema) toggleTema.addEventListener("click", trocarTema);
iniciarTema();

// ===== UTILITÁRIOS DE ARQUIVO =====
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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

<<<<<<< HEAD
let modoAdicionar = false;

// ===== INPUT EVENT LISTENERS =====
=======
// ===== ATUALIZAR CONTADORES =====
function atualizarContadores() {
  const total = imagensAtuais.length;
  if (total === 0) {
    if (painelLote) painelLote.hidden = true;
    if (painelAcao) painelAcao.hidden = true;
    if (secaoTiraFilme) secaoTiraFilme.hidden = true;
    return;
  }

  const pesoTotalKB = imagensAtuais.reduce((acc, img) => acc + (img.file.size / 1024), 0);
  const pesoFormatado = pesoTotalKB > 1024 
    ? `${(pesoTotalKB / 1024).toFixed(1)} MB` 
    : `${Math.round(pesoTotalKB)} KB`;

  if (contadorImagensChip) {
    contadorImagensChip.textContent = `${total} imagem${total > 1 ? "ns" : ""} • ${pesoFormatado}`;
  }

  if (mensagemDestino) {
    mensagemDestino.textContent = `${total} imagem${total > 1 ? "ns" : ""} carregada${total > 1 ? "s" : ""} (${pesoFormatado}) pronta${total > 1 ? "s" : ""} para conversão.`;
  }
}

// ===== ATALHOS DE UPLOAD =====
if (btnAtalhoFotos) {
  btnAtalhoFotos.addEventListener("click", (e) => {
    e.stopPropagation();
    modoAdicionar = imagensAtuais.length > 0;
    inputFotos.click();
  });
}

if (btnAtalhoPasta) {
  btnAtalhoPasta.addEventListener("click", (e) => {
    e.stopPropagation();
    modoAdicionar = imagensAtuais.length > 0;
    inputPasta.click();
  });
}

>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
if (inputFotos) {
  inputFotos.addEventListener("change", () => {
    const todos = Array.from(inputFotos.files);
    if (!todos.length) return;

    if (!modoAdicionar) nomePastaAtual = "fotos_selecionadas";
<<<<<<< HEAD
    const validos = todos.filter(f => extensaoValida(f.name));
=======
    const validos = todos.filter((f) => extensaoValida(f.name));
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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
<<<<<<< HEAD
    const validos = todos.filter(f => extensaoValida(f.name));
=======
    const validos = todos.filter((f) => extensaoValida(f.name));
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
    processarArquivos(validos, modoAdicionar);
    inputPasta.value = "";
    modoAdicionar = false;
  });
}

<<<<<<< HEAD
// ===== DRAG & DROP =====
=======
// ===== SUPORTE A DRAG & DROP E PASTAS =====
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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

<<<<<<< HEAD
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
=======
if (zonaArraste) {
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
    if (mensagemErro) mensagemErro.textContent = "";

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
      mostrarToast("Nenhuma imagem compatível encontrada.", "aviso");
      return;
    }

    if (temPasta || (encontrados.length + imagensAtuais.length) >= 4) {
      usarZip.checked = true;
    }

    processarArquivos(encontrados, imagensAtuais.length > 0);
  });

  zonaArraste.addEventListener("click", (e) => {
    if (e.target.closest(".upload-botoes-atalho")) return;
    abrirMenuSelecao(imagensAtuais.length > 0);
  });
}
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0

// ===== MODAL SELEÇÃO =====
function abrirMenuSelecao(adicionar = false) {
  modoAdicionar = adicionar;

  const backdrop = document.createElement("div");
<<<<<<< HEAD
  backdrop.className = "modal-backdrop";

  const menu = document.createElement("div");
  menu.className = "modal-selecao";

  menu.innerHTML = `
    <h3 class="modal-titulo">${adicionar ? "Adicionar imagens" : "Escolha o modo"}</h3>
    <button id="m-btn-fotos" class="botao-primario modal-btn">${ICONES.camera}<span>Fotos</span></button>
    <button id="m-btn-pasta" class="botao-primario modal-btn">${ICONES.pasta}<span>Pasta</span></button>
    <button id="m-btn-cancelar" class="botao-secundario modal-btn">Cancelar</button>
=======
  backdrop.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(8px);
    z-index: 9998; animation: fadeIn 0.2s ease;
  `;

  const menu = document.createElement("div");
  menu.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius-xl); padding: 2rem; z-index: 9999;
    box-shadow: var(--shadow-xl); text-align: center; width: 90%; max-width: 360px;
    animation: zoomIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;

  menu.innerHTML = `
    <h3 style="margin-bottom: 1.25rem; font-size: 1.2rem; color: var(--text-primary);">
      ${adicionar ? "Adicionar Mais Imagens" : "Como deseja adicionar?"}
    </h3>
    <button id="m-btn-fotos" class="botao-primario" style="width:100%; margin-bottom:0.75rem; justify-content:center; gap:0.5rem;">
      <svg class="icone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      Selecionar Fotos
    </button>
    <button id="m-btn-pasta" class="botao-secundario" style="width:100%; margin-bottom:1rem; justify-content:center; gap:0.5rem;">
      <svg class="icone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      Pasta Completa
    </button>
    <button id="m-btn-cancelar" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer; font-size:0.88rem; width:100%;">
      Cancelar
    </button>
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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

<<<<<<< HEAD
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
    if (gradeResultado) gradeResultado.innerHTML = "";
    if (estatisticasResultado) estatisticasResultado.innerHTML = "";
    if (filaLista) filaLista.innerHTML = "";
    if (filaProcessamento) { filaProcessamento.hidden = true; filaProcessamento.classList.remove("ativo"); }
    mensagemErro.textContent = "";
    if (loteNomeBase) loteNomeBase.value = "";
=======
if (btnAdicionarMais) {
  btnAdicionarMais.addEventListener("click", () => abrirMenuSelecao(true));
}

// ===== LIMPEZA E REINICIALIZAÇÃO =====
function limparSessao() {
  imagensAtuais.forEach((img) => {
    if (img.urlMiniatura) URL.revokeObjectURL(img.urlMiniatura);
  });
  imagensAtuais = [];
  arquivosAtuais = [];
  hashImagensAdicionadas.clear();

  tiraFilme.innerHTML = "";
  if (painelLote) painelLote.hidden = true;
  if (painelAcao) painelAcao.hidden = true;
  if (secaoTiraFilme) secaoTiraFilme.hidden = true;
  if (painelResultado) painelResultado.hidden = true;
  if (mensagemErro) mensagemErro.textContent = "";
  if (loteNomeBase) loteNomeBase.value = "";

  atualizarContadores();
}

if (btnNovaSessao) {
  btnNovaSessao.addEventListener("click", () => {
    limparSessao();
    mostrarToast("Nova fila iniciada. Adicione suas fotos!", "info");
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
    zonaArraste.scrollIntoView({ behavior: "smooth" });
  });
}

<<<<<<< HEAD
// ===== PROCESSAR ARQUIVOS =====
async function processarArquivos(arquivos, adicionar = false) {
  if (!adicionar) {
    arquivosAtuais = [];
    imagensAtuais = [];
    hashImagensAdicionadas.clear();
  }

=======
if (btnLimparTudoTopo) {
  btnLimparTudoTopo.addEventListener("click", () => {
    limparSessao();
    mostrarToast("Lista de imagens limpa.", "info");
  });
}

// ===== PROCESSAR ARQUIVOS =====
async function processarArquivos(arquivos, adicionar = false) {
  if (!adicionar) {
    limparSessao();
  }

  let novosAdicionados = 0;

>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
  for (const arquivo of arquivos) {
    const hash = await gerarHashArquivo(arquivo);
    if (hashImagensAdicionadas.has(hash)) continue;

    let largura = 0, altura = 0;
    try {
      const bitmap = await createImageBitmap(arquivo);
      largura = bitmap.width;
      altura = bitmap.height;
      bitmap.close();
<<<<<<< HEAD
    } catch { continue; }
=======
    } catch {
      continue;
    }
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0

    hashImagensAdicionadas.add(hash);
    arquivosAtuais.push(arquivo);

<<<<<<< HEAD
    imagensAtuais.push({
      hash,
      file: arquivo,
=======
    const extOriginal = extensaoDoArquivo(arquivo.name).toUpperCase();
    const formatoOriginal = extOriginal === "JPG" ? "JPEG" : extOriginal;

    imagensAtuais.push({
      file: arquivo,
      hash,
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
      nome: arquivo.name,
      nomeBase: nomeBaseSemExtensao(arquivo.name),
      largura,
      altura,
      tamanhoKB: Math.round((arquivo.size / 1024) * 10) / 10,
      urlMiniatura: URL.createObjectURL(arquivo),
<<<<<<< HEAD
      formatoOriginal: extensaoDoArquivo(arquivo.name).toUpperCase() === "JPG" ? "JPEG" : extensaoDoArquivo(arquivo.name).toUpperCase(),
    });
  }

  if (!imagensAtuais.length) {
    mensagemErro.textContent = "Nenhuma imagem nova para adicionar.";
=======
      formatoOriginal,
    });

    novosAdicionados++;
  }

  if (novosAdicionados === 0 && !imagensAtuais.length) {
    mostrarToast("Nenhuma imagem nova foi adicionada.", "aviso");
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
    return;
  }

  montarGrade();
  painelLote.hidden = false;
  painelAcao.hidden = false;
<<<<<<< HEAD
  painelResultado.hidden = true;

  mensagemDestino.textContent = `${imagensAtuais.length} imagem(ns) pronta(s) para conversão.`;
}

// ===== FORMATOS QUE NÃO SUPORTAM TRANSPARÊNCIA =====
const FORMATOS_SEM_ALPHA = ["JPEG", "BMP", "GIF"];

function precisaCorDeFundo(formato) {
  return FORMATOS_SEM_ALPHA.includes(formato);
}

// ===== MONTAR GRADE =====
=======
  secaoTiraFilme.hidden = false;
  painelResultado.hidden = true;

  atualizarContadores();
  mostrarToast(`${novosAdicionados} imagem(ns) adicionada(s) à fila!`, "sucesso");
}

// ===== REMOVER IMAGEM INDIVIDUAL =====
function removerImagem(indice) {
  const card = tiraFilme.querySelector(`.quadro[data-indice="${indice}"]`);
  if (!card) return;

  card.classList.add("saindo");

  setTimeout(() => {
    const imgRemovida = imagensAtuais[indice];
    if (imgRemovida) {
      if (imgRemovida.urlMiniatura) URL.revokeObjectURL(imgRemovida.urlMiniatura);
      hashImagensAdicionadas.delete(imgRemovida.hash);
    }

    imagensAtuais.splice(indice, 1);
    arquivosAtuais.splice(indice, 1);

    montarGrade();
    atualizarContadores();
    mostrarToast("Imagem removida da lista.", "info");

    if (imagensAtuais.length === 0) {
      limparSessao();
    }
  }, 260);
}

// ===== MODAL LIGHTBOX (ZOOM) =====
function abrirLightbox(imgObj) {
  if (!modalLightbox || !lightboxImg) return;

  lightboxImg.src = imgObj.urlMiniatura;
  lightboxNome.textContent = imgObj.nome;
  lightboxMeta.textContent = `${imgObj.largura}×${imgObj.altura}px • ${imgObj.tamanhoKB} KB • Formato: ${imgObj.formatoOriginal}`;

  modalLightbox.hidden = false;
  modalLightbox.classList.add("ativo");
}

function fecharLightbox() {
  if (modalLightbox) {
    modalLightbox.hidden = true;
    modalLightbox.classList.remove("ativo");
    if (lightboxImg) lightboxImg.src = "";
  }
}

if (lightboxFechar) lightboxFechar.addEventListener("click", fecharLightbox);
if (lightboxBackdrop) lightboxBackdrop.addEventListener("click", fecharLightbox);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalLightbox && !modalLightbox.hidden) {
    fecharLightbox();
  }
});

// ===== MONTAR GRADE DE CARDS =====
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
function montarGrade() {
  tiraFilme.innerHTML = "";
  const prefixoLote = loteNomeBase ? loteNomeBase.value.trim() : "";

  imagensAtuais.forEach((img, indice) => {
    const quadro = document.createElement("article");
    quadro.className = "quadro";
    quadro.dataset.indice = indice;
<<<<<<< HEAD
    quadro.style.animationDelay = `${Math.min(indice * 0.04, 0.4)}s`;

    const opcoesFormato = ["PNG", "JPEG", "WEBP", "BMP", "GIF", "TIFF"]
=======
    quadro.style.animationDelay = `${Math.min(indice * 0.035, 0.35)}s`;

    const formatos = ["WEBP", "PNG", "JPEG", "BMP", "GIF", "TIFF"];
    const opcoesFormato = formatos
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
      .map((f) => `<option value="${f}" ${f === img.formatoOriginal ? "selected" : ""}>${f}</option>`)
      .join("");

    const valorNome = prefixoLote ? `${prefixoLote}_${indice + 1}` : "";
    const placeholderNome = img.nomeBase;

    quadro.innerHTML = `
      <div class="miniatura-caixa">
<<<<<<< HEAD
        <button type="button" class="btn-remover-quadro" title="Remover esta imagem" aria-label="Remover esta imagem">${ICONES.x}</button>
        <img loading="lazy" src="${img.urlMiniatura}" alt="${img.nome}">
        <span class="badge-transparencia">Fundo será removido</span>
      </div>
      <div class="info-quadro">
        <p class="nome-arquivo">${img.nome}</p>
        <p class="meta-arquivo">${img.largura}×${img.altura}px · ${img.tamanhoKB}KB</p>
      </div>
=======
        <span class="badge-formato-card">${img.formatoOriginal}</span>
        <button type="button" class="btn-card-remover" title="Remover esta foto" aria-label="Remover">
          <svg class="icone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <button type="button" class="btn-card-zoom" title="Ampliar imagem" aria-label="Ampliar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <img loading="lazy" src="${img.urlMiniatura}" alt="${img.nome}">
      </div>

      <div class="info-quadro">
        <p class="nome-arquivo" title="${img.nome}">${img.nome}</p>
        <p class="meta-arquivo">${img.largura}×${img.altura}px · ${img.tamanhoKB} KB</p>
      </div>

>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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
<<<<<<< HEAD
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

=======
          <label>Largura (px)</label>
          <input type="number" class="input-largura" min="1" placeholder="${img.largura}">
        </div>
        <div class="campo-mini">
          <label>Altura (px)</label>
          <input type="number" class="input-altura" min="1" placeholder="${img.altura}">
        </div>
        <div class="linha-proporcao">
          <input type="checkbox" class="input-proporcao" id="prop-${indice}" checked>
          <label for="prop-${indice}">Manter proporção</label>
        </div>
      </div>
    `;

    // Eventos do card
    quadro.querySelector(".btn-card-remover").onclick = () => removerImagem(indice);
    quadro.querySelector(".btn-card-zoom").onclick = () => abrirLightbox(img);
    quadro.querySelector(".miniatura-caixa img").onclick = () => abrirLightbox(img);

    tiraFilme.appendChild(quadro);
  });
}

>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
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
<<<<<<< HEAD
  const removerFundoLote = document.getElementById("lote-remover-fundo")
    ? document.getElementById("lote-remover-fundo").value
    : "";
  const modoRemocaoLote = loteModoRemocao ? loteModoRemocao.value : "";

=======

  let alterados = 0;
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
  document.querySelectorAll(".quadro").forEach((quadro) => {
    if (formato) quadro.querySelector(".input-formato").value = formato;
    if (largura) quadro.querySelector(".input-largura").value = largura;
    if (altura) quadro.querySelector(".input-altura").value = altura;
    if (qualidade) quadro.querySelector(".input-qualidade").value = qualidade;
    if (proporcao) quadro.querySelector(".input-proporcao").checked = proporcao === "on";
<<<<<<< HEAD
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

=======
    alterados++;
  });

  mostrarToast(`Parâmetros aplicados a ${alterados} imagem(ns)!`, "sucesso");
}

if (btnAplicarLote) {
  btnAplicarLote.addEventListener("click", aplicarLoteATodos);
}

// ===== PRESETS INTELIGENTES =====
document.querySelectorAll(".btn-preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    const preset = btn.dataset.preset;
    const quadros = document.querySelectorAll(".quadro");

    if (!quadros.length) {
      mostrarToast("Adicione imagens primeiro para aplicar um preset.", "aviso");
      return;
    }

    if (preset === "web") {
      document.getElementById("lote-formato").value = "WEBP";
      document.getElementById("lote-qualidade").value = 80;
      document.getElementById("lote-proporcao").value = "on";

      quadros.forEach((q) => {
        q.querySelector(".input-formato").value = "WEBP";
        q.querySelector(".input-qualidade").value = 80;
        q.querySelector(".input-proporcao").checked = true;
      });
      mostrarToast("Preset 'Web Otimizado' aplicado (WEBP • 80%)!", "sucesso");
    } 
    else if (preset === "social") {
      document.getElementById("lote-formato").value = "JPEG";
      document.getElementById("lote-largura").value = 1080;
      document.getElementById("lote-altura").value = 1080;
      document.getElementById("lote-qualidade").value = 90;
      document.getElementById("lote-proporcao").value = "on";

      quadros.forEach((q) => {
        q.querySelector(".input-formato").value = "JPEG";
        q.querySelector(".input-largura").value = 1080;
        q.querySelector(".input-altura").value = 1080;
        q.querySelector(".input-qualidade").value = 90;
        q.querySelector(".input-proporcao").checked = true;
      });
      mostrarToast("Preset 'Instagram Post' aplicado (1080×1080 • JPEG)!", "sucesso");
    } 
    else if (preset === "reduzir50") {
      document.getElementById("lote-qualidade").value = 85;
      document.getElementById("lote-proporcao").value = "on";

      quadros.forEach((q) => {
        const indice = Number(q.dataset.indice);
        const img = imagensAtuais[indice];
        if (img) {
          q.querySelector(".input-largura").value = Math.max(1, Math.round(img.largura / 2));
          q.querySelector(".input-altura").value = Math.max(1, Math.round(img.altura / 2));
          q.querySelector(".input-qualidade").value = 85;
          q.querySelector(".input-proporcao").checked = true;
        }
      });
      mostrarToast("Preset 'Reduzir 50%' aplicado em todas as fotos!", "sucesso");
    } 
    else if (preset === "qualidade") {
      document.getElementById("lote-formato").value = "PNG";
      document.getElementById("lote-qualidade").value = 100;
      document.getElementById("lote-proporcao").value = "on";

      quadros.forEach((q) => {
        q.querySelector(".input-formato").value = "PNG";
        q.querySelector(".input-qualidade").value = 100;
        q.querySelector(".input-proporcao").checked = true;
      });
      mostrarToast("Preset 'Alta Fidelidade' aplicado (PNG • Máxima nitidez)!", "sucesso");
    }
  });
});

>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
// ===== ESTADO VISUAL DE CARREGAMENTO =====
function ativarCarregamento(ativo) {
  btnConverter.disabled = ativo;

  if (ativo) {
    btnConverter.classList.add("carregando");
<<<<<<< HEAD
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
    esconderFila();
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

// ===== FILA VISUAL DE PROCESSAMENTO =====
// Mostra cada imagem do lote com seu status (pendente / processando /
// concluída / erro), na mesma ordem em que o servidor as processa —
// que é sempre a ordem de envio (ver comentário em converterImagens()).
let indiceFilaAtual = 0;
let totalFilaAtual = 0;

function montarFila(nomes) {
  if (!filaLista) return;
  filaLista.innerHTML = "";
  indiceFilaAtual = 0;
  totalFilaAtual = nomes.length;

  nomes.forEach((nome, i) => {
    const item = document.createElement("li");
    item.className = "fila-item";
    item.dataset.indice = i;
    item.style.animationDelay = `${Math.min(i * 0.03, 0.3)}s`;
    item.innerHTML = `
      <span class="fila-item-icone"><span class="ponto-pendente"></span></span>
      <span class="fila-item-nome">${nome}</span>
    `;
    filaLista.appendChild(item);
  });

  atualizarContadorFila();
  if (filaProcessamento) {
    filaProcessamento.hidden = false;
    requestAnimationFrame(() => filaProcessamento.classList.add("ativo"));
  }
  if (nomes.length) marcarItemFila(0, "processando");
}

function atualizarContadorFila() {
  if (!filaContador) return;
  const concluidos = Math.min(indiceFilaAtual, totalFilaAtual);
  filaContador.textContent = totalFilaAtual ? `${concluidos} de ${totalFilaAtual}` : "";
}

function marcarItemFila(indice, status) {
  const item = filaLista && filaLista.querySelector(`.fila-item[data-indice="${indice}"]`);
  if (!item) return;
  item.classList.remove("pendente", "processando", "concluida", "erro");
  item.classList.add(status);

  const icone = item.querySelector(".fila-item-icone");
  if (status === "processando") {
    icone.innerHTML = `<span class="anel-processando"></span>`;
  } else if (status === "concluida") {
    icone.innerHTML = ICONES.check;
  } else if (status === "erro") {
    icone.innerHTML = ICONES.x;
  } else {
    icone.innerHTML = `<span class="ponto-pendente"></span>`;
  }
}

// Avança a fila: fecha o item atual (sucesso ou erro) e abre o próximo.
function avancarFila(statusItemAtual) {
  marcarItemFila(indiceFilaAtual, statusItemAtual);
  indiceFilaAtual++;
  atualizarContadorFila();
  if (indiceFilaAtual < totalFilaAtual) {
    marcarItemFila(indiceFilaAtual, "processando");
  }
}

function esconderFila() {
  if (!filaProcessamento) return;
  filaProcessamento.classList.remove("ativo");
  setTimeout(() => { filaProcessamento.hidden = true; }, 400);
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
  montarFila(imagensAtuais.map((img) => img.nome));

  const formData = new FormData();
  const config = {};
  modosRemocaoUltimaConversao = {};
  let algumModoManual = false;
  let ordemEnvio = 0;
=======
    btnConverter.innerHTML = `<span class="spinner"></span><span class="btn-text">Processando em Paralelo...</span>`;
    if (barraProgressoContainer) {
      barraProgressoContainer.hidden = false;
      progressoLegenda.textContent = `Processando ${imagensAtuais.length} imagem(ns) simultaneamente com Turbo Multithread...`;
    }
  } else {
    btnConverter.classList.remove("carregando");
    btnConverter.innerHTML = `<span class="btn-text">Revelar Imagens</span><span class="btn-icon">→</span>`;
    if (barraProgressoContainer) {
      setTimeout(() => { barraProgressoContainer.hidden = true; }, 400);
    }
  }
}

// ===== CONVERSÃO DE IMAGENS =====
async function converterImagens() {
  if (!imagensAtuais.length) {
    mostrarToast("Nenhuma imagem selecionada para conversão.", "aviso");
    return;
  }

  ativarCarregamento(true);

  const formData = new FormData();
  const config = {};
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0

  document.querySelectorAll(".quadro").forEach((quadro) => {
    const indice = Number(quadro.dataset.indice);
    const img = imagensAtuais[indice];
<<<<<<< HEAD
=======
    if (!img) return;

>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
    formData.append("arquivos", img.file, img.nome);

    const campoNome = quadro.querySelector(".input-nome-personalizado");
    const novoNomeBruto = campoNome ? campoNome.value.trim() : "";
<<<<<<< HEAD
    const removerFundoAtivo = quadro.querySelector(".input-remover-fundo").checked;
    const radioModo = quadro.querySelector(".input-modo-remocao:checked");
    const modoRemocao = radioModo ? radioModo.value : "automatico";

    if (removerFundoAtivo && modoRemocao === "manual") algumModoManual = true;
    modosRemocaoUltimaConversao[img.nome] = removerFundoAtivo ? modoRemocao : null;

    // Chave pela ordem de envio (não pelo nome do arquivo): imagens com o
    // mesmo nome original (ex.: fotos de câmeras/pastas diferentes ambas
    // chamadas "IMG_0001.jpg") não podem dividir a mesma configuração.
    config[ordemEnvio] = {
=======

    config[img.nome] = {
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
      formato: quadro.querySelector(".input-formato").value,
      largura: quadro.querySelector(".input-largura").value || null,
      altura: quadro.querySelector(".input-altura").value || null,
      qualidade: Number(quadro.querySelector(".input-qualidade").value) || 90,
      manter_proporcao: quadro.querySelector(".input-proporcao").checked,
<<<<<<< HEAD
      remover_fundo: removerFundoAtivo,
      modo_remocao: modoRemocao,
      cor_fundo: quadro.querySelector(".input-cor-fundo").value,
      novo_nome: novoNomeBruto || null,
    };
    ordemEnvio++;
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
  let streamConcluido = false;
=======
      novo_nome: novoNomeBruto || null,
    };
  });

  formData.append("config", JSON.stringify(config));
  formData.append("usar_zip", usarZip.checked);
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0

  try {
    const resposta = await fetch("/api/converter-lote", { method: "POST", body: formData });

<<<<<<< HEAD
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
          avancarFila(evento.status === "ok" ? "concluida" : "erro");
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
          streamConcluido = true;
          atualizarProgresso(0, 1, "concluido");
          if (usarZipAtivo && evento.zip_base64) {
            const blob = base64ParaBlob(evento.zip_base64, "application/zip");
            baixarBlob(blob, evento.nome_zip || `${nomePastaAtual}_convertido.zip`);
          }
        }
      }
    }

    if (!streamConcluido) {
      // A conexão terminou sem o evento final "concluido" — o lote foi
      // interrompido no meio do processamento (em geral, um timeout do
      // servidor numa imagem que demorou demais), não um erro comum de
      // rede. O usuário precisa saber exatamente quantas terminaram antes
      // da interrupção, em vez de receber um resumo que parece completo.
      const total = imagensAtuais.length;
      mensagemErro.textContent =
        `A conversão foi interrompida antes de terminar: ${resultados.length} de ${total} ` +
        `imagem(ns) foram processadas antes da interrupção (provavelmente por demorar demais em ` +
        `alguma imagem). As processadas até aqui estão na lista abaixo — tente novamente com um ` +
        `lote menor ou sem remoção de fundo se isso persistir.`;

      // O ZIP nunca chegou a ser fechado no servidor (só fecha depois do
      // lote inteiro), mas cada resultado individual já veio com seus
      // próprios bytes — então nada do que já foi processado se perde.
      if (usarZipAtivo) {
        resultados.forEach((r) => {
          const modoDoItem = modosRemocaoUltimaConversao[r.nome];
          if (r.status === "ok" && r.dados && modoDoItem !== "manual") {
            const blob = base64ParaBlob(r.dados, r.mime);
            baixarBlob(blob, r.salvo_como);
          }
        });
      }
    }

    exibirResultado(resultados);
  } catch (erro) {
    if (resultados.length) {
      mensagemErro.textContent =
        `A conexão caiu durante o processamento: ${resultados.length} de ${imagensAtuais.length} ` +
        `imagem(ns) foram concluídas antes da queda.`;
      if (usarZipAtivo) {
        resultados.forEach((r) => {
          const modoDoItem = modosRemocaoUltimaConversao[r.nome];
          if (r.status === "ok" && r.dados && modoDoItem !== "manual") {
            const blob = base64ParaBlob(r.dados, r.mime);
            baixarBlob(blob, r.salvo_como);
          }
        });
      }
      exibirResultado(resultados);
    } else {
      mensagemErro.textContent = "Erro na comunicação com o servidor. Verifique sua conexão e tente novamente.";
    }
=======
    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      const msgErro = erro.erro || "Falha durante o processamento das imagens.";
      mostrarToast(msgErro, "erro");
      if (mensagemErro) mensagemErro.textContent = msgErro;
      return;
    }

    const cabecalhoResultados = resposta.headers.get("X-Resultados");
    const resultados = cabecalhoResultados ? JSON.parse(cabecalhoResultados) : [];

    // Baixa o arquivo resultante (ZIP ou único)
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Detecta nome apropriado de download
    if (!usarZip.checked && resultados.length === 1 && resultados[0].salvo_como) {
      link.download = resultados[0].salvo_como;
    } else {
      link.download = `${nomePastaAtual || "revela"}_convertido.zip`;
    }

    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    exibirResultado(resultados);
    dispararConfetes();
    mostrarToast("Imagens convertidas e download iniciado com sucesso!", "sucesso");
  } catch (erro) {
    mostrarToast("Erro na comunicação com o servidor.", "erro");
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
  } finally {
    ativarCarregamento(false);
  }
}

<<<<<<< HEAD
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

// ===== FORMATAÇÃO DE TAMANHOS (KB/MB) =====
function formatarTamanho(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(0, Math.round(bytes / 1024 * 10) / 10)}KB`;
}

function tamanhoBase64EmBytes(base64) {
  if (!base64) return 0;
  let padding = 0;
  if (base64.endsWith("==")) padding = 2;
  else if (base64.endsWith("=")) padding = 1;
  return Math.floor((base64.length * 3) / 4) - padding;
}

// ===== COMPARADOR ANTES / DEPOIS (arrastar para revelar original × resultado) =====
// Mostra o "antes" (arquivo enviado) sobre o "depois" (resultado processado),
// recortado por um divisor arrastável. O quadriculado de fundo do próprio
// container já denuncia áreas realmente transparentes no resultado.
function criarComparadorAntesDepois(urlOriginal, urlResultado, nomeAlt) {
  const container = document.createElement("div");
  container.className = "comparador-antes-depois";
  container.innerHTML = `
    <img class="comparador-img comparador-resultado" src="${urlResultado}" alt="${nomeAlt} — resultado" draggable="false">
    <img class="comparador-img comparador-original" src="${urlOriginal}" alt="${nomeAlt} — original" draggable="false">
    <div class="comparador-linha">
      <div class="comparador-alca">${ICONES.seta}</div>
    </div>
    <span class="comparador-label comparador-label-esquerda">ORIGINAL</span>
    <span class="comparador-label comparador-label-direita">RESULTADO</span>
  `;

  function definirPosicao(clientX) {
    const rect = container.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    container.style.setProperty("--pos", `${pct}%`);
  }

  let arrastando = false;
  container.addEventListener("pointerdown", (e) => {
    arrastando = true;
    container.classList.add("arrastando");
    if (container.setPointerCapture) {
      try { container.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    }
    definirPosicao(e.clientX);
  });
  container.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    definirPosicao(e.clientX);
  });
  const soltar = () => { arrastando = false; container.classList.remove("arrastando"); };
  container.addEventListener("pointerup", soltar);
  container.addEventListener("pointercancel", soltar);
  container.addEventListener("pointerleave", () => { if (!arrastando) return; });

  return container;
}

function exibirResultado(resultados) {
  painelResultado.hidden = false;
  const sucesso = resultados.filter((r) => r.status === "ok").length;
  const falhas = resultados.length - sucesso;
  document.getElementById("resumo-resultado").textContent = falhas
    ? `${sucesso} imagem(ns) processada(s) com sucesso, ${falhas} com erro.`
    : `${sucesso} imagem(ns) processada(s) com sucesso!`;

  // ----- estatísticas agregadas (tamanho original -> final, economia) -----
  let tamanhoOriginalTotal = 0;
  let tamanhoFinalTotal = 0;
  resultados.forEach((r, i) => {
    const original = imagensAtuais[i];
    if (original) tamanhoOriginalTotal += original.file.size;
    if (r.status === "ok" && r.dados) tamanhoFinalTotal += tamanhoBase64EmBytes(r.dados);
  });

  if (estatisticasResultado) {
    estatisticasResultado.innerHTML = "";
    const chips = [
      { rotulo: "Total", valor: `${resultados.length}`, sub: "imagem(ns)" },
      { rotulo: "Concluídas", valor: `${sucesso}`, classe: "stat-sucesso" },
    ];
    if (falhas > 0) chips.push({ rotulo: "Falharam", valor: `${falhas}`, classe: "stat-falha" });
    if (tamanhoOriginalTotal > 0 && tamanhoFinalTotal > 0) {
      const reducao = Math.round((1 - tamanhoFinalTotal / tamanhoOriginalTotal) * 1000) / 10;
      chips.push({
        rotulo: "Tamanho",
        valor: `${formatarTamanho(tamanhoOriginalTotal)} → ${formatarTamanho(tamanhoFinalTotal)}`,
        sub: reducao > 0 ? `${reducao}% de redução` : reducao < 0 ? `${Math.abs(reducao)}% maior` : "sem alteração",
        classe: "stat-economia",
      });
    }
    chips.forEach((c, i) => {
      const chip = document.createElement("div");
      chip.className = `stat-chip ${c.classe || ""}`;
      chip.style.animationDelay = `${i * 0.05}s`;
      chip.innerHTML = `
        <p class="stat-chip-rotulo">${c.rotulo}</p>
        <p class="stat-chip-valor">${c.valor}</p>
        ${c.sub ? `<p class="stat-chip-sub">${c.sub}</p>` : ""}
      `;
      estatisticasResultado.appendChild(chip);
    });
  }

  // ----- grade de cards -----
  if (gradeResultado) {
    gradeResultado.innerHTML = "";
    resultados.forEach((r, i) => {
      const card = document.createElement("article");
      card.className = `resultado-card ${r.status !== "ok" ? "card-erro" : ""}`;
      card.style.animationDelay = `${Math.min(i * 0.05, 0.5)}s`;

      if (r.status === "ok") {
        const original = imagensAtuais[i];
        const modo = modosRemocaoUltimaConversao[r.nome];
        const urlResultado = r.dados ? `data:${r.mime};base64,${r.dados}` : "";
        const tamanhoFinal = r.dados ? formatarTamanho(tamanhoBase64EmBytes(r.dados)) : "—";
        const avisoHtml = r.aviso ? `<span class="resultado-aviso">${ICONES.alerta}${r.aviso}</span>` : "";

        card.innerHTML = `
          <div class="resultado-thumb-caixa"></div>
          <div class="resultado-info">
            <p class="resultado-nome">${r.salvo_como}</p>
            <div class="resultado-meta-linha">
              <span class="resultado-tag">${r.dimensoes}</span>
              <span class="resultado-tag">${tamanhoFinal}</span>
            </div>
            <div class="resultado-rodape">
              <span class="resultado-status-ok">${ICONES.check}Concluída</span>
              <span class="resultado-acoes"></span>
            </div>
          </div>
        `;
        if (avisoHtml) card.querySelector(".resultado-info").insertAdjacentHTML("beforeend", avisoHtml);

        // thumbnail: comparador antes/depois quando temos a imagem original
        // correspondente (mostra especialmente bem a remoção de fundo);
        // caso contrário, cai para uma miniatura simples do resultado.
        const caixaThumb = card.querySelector(".resultado-thumb-caixa");
        if (original && urlResultado) {
          caixaThumb.appendChild(criarComparadorAntesDepois(original.urlMiniatura, urlResultado, r.salvo_como));
        } else if (urlResultado) {
          caixaThumb.innerHTML = `<img src="${urlResultado}" alt="${r.salvo_como}" loading="lazy">`;
        }

        // ações: baixar individualmente + editar máscara (modo manual)
        const acoes = card.querySelector(".resultado-acoes");
        if (r.dados && modo !== "manual") {
          const btnBaixar = document.createElement("button");
          btnBaixar.type = "button";
          btnBaixar.className = "btn-baixar-card";
          btnBaixar.title = "Baixar esta imagem";
          btnBaixar.setAttribute("aria-label", "Baixar esta imagem");
          btnBaixar.innerHTML = ICONES.download;
          btnBaixar.addEventListener("click", () => {
            const blob = base64ParaBlob(r.dados, r.mime);
            baixarBlob(blob, r.salvo_como);
          });
          acoes.appendChild(btnBaixar);
        }
        if (modo === "manual" && r.dados) {
          const btnEditar = document.createElement("button");
          btnEditar.type = "button";
          btnEditar.className = "botao-secundario btn-editar-mascara";
          btnEditar.textContent = "Editar máscara";
          btnEditar.addEventListener("click", () => {
            abrirEditorMascara({ dadosBase64: r.dados, mime: r.mime, nomeArquivo: r.salvo_como });
          });
          acoes.appendChild(btnEditar);
        }
      } else {
        card.innerHTML = `
          <div class="resultado-info">
            <p class="resultado-nome">${r.nome}</p>
            <div class="resultado-rodape">
              <span class="resultado-status-erro">${ICONES.x}Erro</span>
            </div>
          </div>
          ${r.mensagem ? `<p class="resultado-mensagem-erro">${r.mensagem}</p>` : ""}
        `;
      }

      gradeResultado.appendChild(card);
    });
  }

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
=======
// ===== EXIBIR RESULTADOS =====
function exibirResultado(resultados) {
  painelResultado.hidden = false;
  const totalOk = resultados.filter((r) => r.status === "ok").length;
  document.getElementById("resumo-resultado").textContent = `${totalOk} de ${resultados.length} imagem(ns) processada(s) com sucesso!`;

  const lista = document.getElementById("lista-resultado");
  lista.innerHTML = "";

  resultados.forEach((r) => {
    const li = document.createElement("li");
    if (r.status === "ok") {
      li.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.2rem;">
          <span><strong>${r.salvo_como}</strong></span>
          <span style="font-size:0.75rem; color:var(--text-tertiary);">Original: ${r.nome}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span style="font-size:0.8rem; color:var(--text-secondary);">${r.tamanho_kb ? r.tamanho_kb + " KB" : ""}</span>
          <span class="status-ok">
            <svg class="icone-svg" style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>${r.dimensoes}
          </span>
        </div>
      `;
    } else {
      li.innerHTML = `
        <span>${r.nome}</span>
        <span class="status-erro">
          <svg class="icone-svg" style="width:12px; height:12px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>${r.mensagem || "Erro"}
        </span>
      `;
    }
    lista.appendChild(li);
  });

  painelResultado.scrollIntoView({ behavior: "smooth" });
}

if (btnConverter) {
  btnConverter.addEventListener("click", converterImagens);
}
>>>>>>> 48a6683f31590034e487d8cc4bdbf1b65368a5f0
