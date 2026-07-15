let arquivosAtuais = [];
let imagensAtuais = [];
let nomePastaAtual = "convertidas";
let hashImagensAdicionadas = new Set(); // Armazenar hash das imagens para detectar duplicatas

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

const EXTENSOES_VALIDAS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tiff", "tif"];

// ===== CRIAR HASH ÚNICO PARA ARQUIVO =====
async function gerarHashArquivo(arquivo) {
  const buffer = await arquivo.slice(0, 1024 * 1024).arrayBuffer(); // Usar primeiros 1MB
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
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
  const novoTema = temaAtual === "light" ? "dark" : "light";
  aplicarTema(novoTema);
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

// ===== VARIÁVEL DE CONTROLE PARA ADICIONAR OU SUBSTITUIR =====
let modoAdicionar = false;

// ===== OPÇÃO 1: Fotos individuais =====
if (inputFotos) {
  inputFotos.addEventListener("change", () => {
    const todos = Array.from(inputFotos.files);
    if (!todos.length) return;

    if (!modoAdicionar) {
      nomePastaAtual = "fotos_selecionadas";
    }
    
    const quantidade = (modoAdicionar ? imagensAtuais.length : 0) + todos.filter(f => extensaoValida(f.name)).length;
    usarZip.checked = quantidade >= 4;
    
    const validos = todos.filter(f => extensaoValida(f.name));
    processarArquivos(validos, modoAdicionar);
    inputFotos.value = "";
    modoAdicionar = false;
  });
}

// ===== OPÇÃO 2: Pasta inteira =====
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

// ===== OPÇÃO 3: Drag & Drop =====
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
            const arquivo = await new Promise((resolveArquivo) => entrada.file(resolveArquivo));
            encontrados.push(arquivo);
          }
        }
        lerLote();
      });
    }
    lerLote();
  });
}

["dragenter", "dragover"].forEach((evento) => {
  zonaArraste.addEventListener(evento, (e) => {
    e.preventDefault();
    zonaArraste.classList.add("sobre-arraste");
  });
});

["dragleave", "dragend"].forEach((evento) => {
  zonaArraste.addEventListener(evento, () => zonaArraste.classList.remove("sobre-arraste"));
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
  if (!items || !items.length) {
    mensagemErro.textContent = "Não foi possível ler os arquivos.";
    return;
  }

  const encontrados = [];
  let nomePasta = "convertidas";
  let temPasta = false;
  let contadorArquivos = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entrada = item.webkitGetAsEntry && item.webkitGetAsEntry();

    if (!entrada) continue;

    if (entrada.isDirectory) {
      temPasta = true;
      nomePasta = entrada.name;
      const arquivos = await lerArquivosDeDiretorio(entrada);
      encontrados.push(...arquivos);
      contadorArquivos += arquivos.length;
    } else if (entrada.isFile && extensaoValida(entrada.name)) {
      const arquivo = await new Promise((resolveArquivo) => entrada.file(resolveArquivo));
      encontrados.push(arquivo);
      contadorArquivos++;
    }
  }

  if (!encontrados.length) {
    mensagemErro.textContent = "Nenhuma imagem válida encontrada.";
    return;
  }

  if (!modoAdicionar) {
    nomePastaAtual = temPasta ? nomePasta : "fotos_selecionadas";
  }
  usarZip.checked = (contadorArquivos + imagensAtuais.length) >= 4 || temPasta;
  processarArquivos(encontrados, modoAdicionar);
  modoAdicionar = false;
});

// ===== Menu de seleção ao clicar (MODAL) =====
function abrirMenuSelecao(adicionar = false) {
  modoAdicionar = adicionar;

  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 9998;
    animation: fadeIn 0.2s ease;
  `;

  const menu = document.createElement("div");
  menu.id = "modal-menu";
  menu.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--bg-secondary);
    backdrop-filter: blur(10px);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3rem;
    z-index: 9999;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    text-align: center;
    min-width: 320px;
    max-width: 90vw;
  `;

  const titulo = document.createElement("h3");
  titulo.textContent = adicionar ? "Adicionar mais imagens?" : "Como deseja adicionar imagens?";
  titulo.style.cssText = `
    margin: 0 0 2rem 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-primary);
  `;

  const btnFotos = document.createElement("button");
  btnFotos.textContent = "📸  Fotos Individuais";
  btnFotos.className = "botao-primario";
  btnFotos.style.cssText = "width: 100%; margin-bottom: 1rem; justify-content: center;";
  btnFotos.onclick = () => {
    inputFotos.click();
    document.body.removeChild(backdrop);
    document.body.removeChild(menu);
  };

  const btnPasta = document.createElement("button");
  btnPasta.textContent = "📁  Pasta Inteira";
  btnPasta.className = "botao-primario";
  btnPasta.style.cssText = "width: 100%; margin-bottom: 1rem; justify-content: center;";
  btnPasta.onclick = () => {
    inputPasta.click();
    document.body.removeChild(backdrop);
    document.body.removeChild(menu);
  };

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "✕  Cancelar";
  btnCancelar.className = "botao-secundario";
  btnCancelar.style.cssText = "width: 100%;";
  btnCancelar.onclick = () => {
    document.body.removeChild(backdrop);
    document.body.removeChild(menu);
    modoAdicionar = false;
  };

  menu.appendChild(titulo);
  menu.appendChild(btnFotos);
  menu.appendChild(btnPasta);
  menu.appendChild(btnCancelar);
  document.body.appendChild(backdrop);
  document.body.appendChild(menu);

  backdrop.onclick = () => {
    document.body.removeChild(backdrop);
    document.body.removeChild(menu);
    modoAdicionar = false;
  };
}

zonaArraste.addEventListener("click", () => abrirMenuSelecao(false));
zonaArraste.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    abrirMenuSelecao(false);
  }
});

// ===== ADICIONAR MAIS IMAGENS (BOTÃO +) =====
if (btnAdicionarMais) {
  btnAdicionarMais.addEventListener("click", () => abrirMenuSelecao(true));
}

// ===== NOVA SESSÃO =====
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
    zonaArraste.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ===== PROCESSAR ARQUIVOS (COM DETECÇÃO DE DUPLICATAS) =====
async function processarArquivos(arquivos, adicionar = false) {
  mensagemErro.textContent = "";

  if (!arquivos.length) {
    mensagemErro.textContent = "Nenhuma imagem encontrada.";
    return;
  }

  // Se estamos adicionando, não limpar imagensAtuais
  if (!adicionar) {
    arquivosAtuais = [];
    imagensAtuais = [];
    hashImagensAdicionadas.clear();
  }

  const arquivosAdicionados = [];
  const arquivosDuplicados = [];

  for (const arquivo of arquivos) {
    // Gerar hash do arquivo para detectar duplicatas
    const hashArquivo = await gerarHashArquivo(arquivo);

    // Verificar se já foi adicionado
    if (hashImagensAdicionadas.has(hashArquivo)) {
      arquivosDuplicados.push(arquivo.name);
      continue;
    }

    let largura = 0, altura = 0;
    try {
      const bitmap = await createImageBitmap(arquivo);
      largura = bitmap.width;
      altura = bitmap.height;
      bitmap.close();
    } catch {
      continue;
    }

    // Adicionar arquivo e seu hash
    hashImagensAdicionadas.add(hashArquivo);
    arquivosAtuais.push(arquivo);
    
    imagensAtuais.push({
      file: arquivo,
      nome: arquivo.name,
      extensao: extensaoDoArquivo(arquivo.name),
      largura,
      altura,
      tamanhoKB: Math.round((arquivo.size / 1024) * 10) / 10,
      urlMiniatura: URL.createObjectURL(arquivo),
      formatoOriginal: extensaoDoArquivo(arquivo.name).toUpperCase() === "JPG" ? "JPEG" : extensaoDoArquivo(arquivo.name).toUpperCase(),
      hash: hashArquivo,
    });

    arquivosAdicionados.push(arquivo.name);
  }

  // Mostrar mensagem de duplicatas (se houver)
  if (arquivosDuplicados.length > 0) {
    const mensagem = `⚠️ ${arquivosDuplicados.length} imagem(ns) já adicionada(s) e ignorada(s): ${arquivosDuplicados.join(", ")}`;
    
    // Criar notificação temporária
    const notificacao = document.createElement("div");
    notificacao.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--warning);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 400px;
      animation: slideInRight 0.3s ease;
      font-weight: 500;
    `;
    notificacao.textContent = mensagem;
    document.body.appendChild(notificacao);
    
    // Remover após 5 segundos
    setTimeout(() => {
      notificacao.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => document.body.removeChild(notificacao), 300);
    }, 5000);
  }

  if (!imagensAtuais.length) {
    if (arquivos.length === arquivosDuplicados.length) {
      mensagemErro.textContent = "Todas as imagens já foram adicionadas. Nenhuma nova imagem para adicionar.";
    } else {
      mensagemErro.textContent = "Nenhuma imagem válida encontrada.";
    }
    return;
  }

  montarGrade();
  painelLote.hidden = false;
  painelAcao.hidden = false;
  painelResultado.hidden = true;
  
  const quantidade = imagensAtuais.length;
  const plural = quantidade > 1 ? "s" : "";
  const zipInfo = usarZip.checked ? " em ZIP" : "";
  
  mensagemDestino.textContent = `${quantidade} imagem${plural} selecionada${plural}. Clique para revelar${zipInfo}.`;
  tiraFilme.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ===== MONTAR GRADE =====
function montarGrade() {
  tiraFilme.innerHTML = "";
  imagensAtuais.forEach((img, indice) => {
    const quadro = document.createElement("article");
    quadro.className = "quadro";
    quadro.dataset.indice = indice;
    quadro.style.animationDelay = `${Math.min(indice * 0.05, 0.5)}s`;

    const opcoesFormato = ["PNG", "JPEG", "WEBP", "BMP", "GIF", "TIFF"]
      .map((f) => `<option value="${f}" ${f === img.formatoOriginal ? "selected" : ""}>${f}</option>`)
      .join("");

    quadro.innerHTML = `
      <div class="miniatura-caixa">
        <img loading="lazy" src="${img.urlMiniatura}" alt="${img.nome}">
      </div>
      <div class="info-quadro">
        <p class="nome-arquivo">${img.nome}</p>
        <p class="meta-arquivo">${img.largura}×${img.altura}px · ${img.tamanhoKB}KB</p>
      </div>
      <div class="controles-quadro">
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

// ===== APLICAR LOTE =====
function aplicarLoteATodos() {
  const formato = document.getElementById("lote-formato").value;
  const largura = document.getElementById("lote-largura").value;
  const altura = document.getElementById("lote-altura").value;
  const qualidade = document.getElementById("lote-qualidade").value;

  document.querySelectorAll(".quadro").forEach((quadro) => {
    if (formato) quadro.querySelector(".input-formato").value = formato;
    if (largura) quadro.querySelector(".input-largura").value = largura;
    if (altura) quadro.querySelector(".input-altura").value = altura;
    if (qualidade) quadro.querySelector(".input-qualidade").value = qualidade;
  });
}

// ===== CONVERTER IMAGENS =====
async function converterImagens() {
  btnConverter.disabled = true;
  btnConverter.textContent = "Revelando...";

  const formData = new FormData();
  const config = {};

  document.querySelectorAll(".quadro").forEach((quadro) => {
    const indice = Number(quadro.dataset.indice);
    const img = imagensAtuais[indice];
    formData.append("arquivos", img.file, img.nome);
    config[img.nome] = {
      formato: quadro.querySelector(".input-formato").value,
      largura: quadro.querySelector(".input-largura").value || null,
      altura: quadro.querySelector(".input-altura").value || null,
      qualidade: Number(quadro.querySelector(".input-qualidade").value) || 90,
      manter_proporcao: quadro.querySelector(".input-proporcao").checked,
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
    mensagemErro.textContent = "Erro de conexão.";
    console.error(erro);
  } finally {
    btnConverter.disabled = false;
    btnConverter.textContent = "Revelar";
  }
}

// ===== EXIBIR RESULTADO =====
function exibirResultado(resultados) {
  painelResultado.hidden = false;
  const plural = resultados.length > 1 ? "s" : "";
  document.getElementById("resumo-resultado").textContent =
    `${resultados.length} imagem${plural} convertida${plural} com sucesso!`;

  const lista = document.getElementById("lista-resultado");
  lista.innerHTML = "";
  resultados.forEach((r) => {
    const li = document.createElement("li");
    if (r.status === "ok") {
      li.innerHTML = `<span>${r.nome}</span><span class="status-ok">✓ ${r.dimensoes}</span>`;
    } else {
      li.innerHTML = `<span>${r.nome}</span><span class="status-erro">✕ Erro</span>`;
    }
    lista.appendChild(li);
  });

  painelResultado.scrollIntoView({ behavior: "smooth" });
}

// ===== EVENT LISTENERS =====
btnAplicarLote.addEventListener("click", aplicarLoteATodos);
btnConverter.addEventListener("click", converterImagens);