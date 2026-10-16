let arquivosAtuais = [];
let imagensAtuais = [];
let nomePastaAtual = "convertidas";
let hashImagensAdicionadas = new Set();
let modoAdicionar = false;

// Elementos do DOM
const zonaArraste = document.getElementById("zona-arraste");
const inputFotos = document.getElementById("input-fotos");
const inputPasta = document.getElementById("input-pasta");
const mensagemErro = document.getElementById("mensagem-erro");
const tiraFilme = document.getElementById("tira-filme");
const secaoTiraFilme = document.getElementById("secao-tira-filme");
const painelLote = document.getElementById("painel-lote");
const painelAcao = document.getElementById("painel-acao");
const painelResultado = document.getElementById("painel-resultado");
const mensagemDestino = document.getElementById("mensagem-destino");
const btnConverter = document.getElementById("btn-converter");
const btnAplicarLote = document.getElementById("btn-aplicar-lote");
const btnAdicionarMais = document.getElementById("btn-adicionar-mais");
const btnNovaSessao = document.getElementById("btn-nova-sessao");
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
  aplicarTema(temaSalvo);
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  localStorage.setItem("revela_tema", tema);
}

function trocarTema() {
  const temaAtual = document.documentElement.getAttribute("data-theme") || "light";
  aplicarTema(temaAtual === "light" ? "dark" : "light");
}

if (toggleTema) toggleTema.addEventListener("click", trocarTema);
iniciarTema();

// ===== UTILITÁRIOS DE ARQUIVO =====
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

if (inputFotos) {
  inputFotos.addEventListener("change", () => {
    const todos = Array.from(inputFotos.files);
    if (!todos.length) return;

    if (!modoAdicionar) nomePastaAtual = "fotos_selecionadas";
    const validos = todos.filter((f) => extensaoValida(f.name));
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
    const validos = todos.filter((f) => extensaoValida(f.name));
    processarArquivos(validos, modoAdicionar);
    inputPasta.value = "";
    modoAdicionar = false;
  });
}

// ===== SUPORTE A DRAG & DROP E PASTAS =====
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

// ===== MODAL SELEÇÃO =====
function abrirMenuSelecao(adicionar = false) {
  modoAdicionar = adicionar;

  const backdrop = document.createElement("div");
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
    zonaArraste.scrollIntoView({ behavior: "smooth" });
  });
}

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

  for (const arquivo of arquivos) {
    const hash = await gerarHashArquivo(arquivo);
    if (hashImagensAdicionadas.has(hash)) continue;

    let largura = 0, altura = 0;
    try {
      const bitmap = await createImageBitmap(arquivo);
      largura = bitmap.width;
      altura = bitmap.height;
      bitmap.close();
    } catch {
      continue;
    }

    hashImagensAdicionadas.add(hash);
    arquivosAtuais.push(arquivo);

    const extOriginal = extensaoDoArquivo(arquivo.name).toUpperCase();
    const formatoOriginal = extOriginal === "JPG" ? "JPEG" : extOriginal;

    imagensAtuais.push({
      file: arquivo,
      hash,
      nome: arquivo.name,
      nomeBase: nomeBaseSemExtensao(arquivo.name),
      largura,
      altura,
      tamanhoKB: Math.round((arquivo.size / 1024) * 10) / 10,
      urlMiniatura: URL.createObjectURL(arquivo),
      formatoOriginal,
    });

    novosAdicionados++;
  }

  if (novosAdicionados === 0 && !imagensAtuais.length) {
    mostrarToast("Nenhuma imagem nova foi adicionada.", "aviso");
    return;
  }

  montarGrade();
  painelLote.hidden = false;
  painelAcao.hidden = false;
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
function montarGrade() {
  tiraFilme.innerHTML = "";
  const prefixoLote = loteNomeBase ? loteNomeBase.value.trim() : "";

  imagensAtuais.forEach((img, indice) => {
    const quadro = document.createElement("article");
    quadro.className = "quadro";
    quadro.dataset.indice = indice;
    quadro.style.animationDelay = `${Math.min(indice * 0.035, 0.35)}s`;

    const formatos = ["WEBP", "PNG", "JPEG", "BMP", "GIF", "TIFF"];
    const opcoesFormato = formatos
      .map((f) => `<option value="${f}" ${f === img.formatoOriginal ? "selected" : ""}>${f}</option>`)
      .join("");

    const valorNome = prefixoLote ? `${prefixoLote}_${indice + 1}` : "";
    const placeholderNome = img.nomeBase;

    quadro.innerHTML = `
      <div class="miniatura-caixa">
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

  let alterados = 0;
  document.querySelectorAll(".quadro").forEach((quadro) => {
    if (formato) quadro.querySelector(".input-formato").value = formato;
    if (largura) quadro.querySelector(".input-largura").value = largura;
    if (altura) quadro.querySelector(".input-altura").value = altura;
    if (qualidade) quadro.querySelector(".input-qualidade").value = qualidade;
    if (proporcao) quadro.querySelector(".input-proporcao").checked = proporcao === "on";
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

// ===== ESTADO VISUAL DE CARREGAMENTO =====
function ativarCarregamento(ativo) {
  btnConverter.disabled = ativo;

  if (ativo) {
    btnConverter.classList.add("carregando");
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

  document.querySelectorAll(".quadro").forEach((quadro) => {
    const indice = Number(quadro.dataset.indice);
    const img = imagensAtuais[indice];
    if (!img) return;

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
  } finally {
    ativarCarregamento(false);
  }
}

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