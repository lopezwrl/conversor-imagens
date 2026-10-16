# Revela — Conversor de Imagens

Aplicação web (Flask + JavaScript puro) para **converter, redimensionar, renomear em lote e remover fundo** de imagens direto do navegador. Foi pensada para lotes grandes (dezenas/centenas de arquivos), com progresso real por etapa, download em ZIP e uma remoção de fundo feita **sem IA/modelo de machine learning** — só visão computacional clássica com OpenCV.

---

## Índice

- [Principais funcionalidades](#principais-funcionalidades)
- [Como a remoção de fundo funciona](#como-a-remoção-de-fundo-funciona)
- [Arquitetura e fluxo de processamento](#arquitetura-e-fluxo-de-processamento)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Stack utilizada](#stack-utilizada)
- [Como rodar localmente](#como-rodar-localmente)
- [API](#api)
- [Formatos suportados](#formatos-suportados)
- [Compatibilidade de navegador](#compatibilidade-de-navegador)
- [Limitações conhecidas](#limitações-conhecidas)

---

## Principais funcionalidades

- **Upload flexível**: arrastar e soltar, seleção de múltiplos arquivos ou de uma **pasta inteira** (via `webkitdirectory`), com deduplicação por hash (SHA‑256 dos primeiros bytes) para não adicionar a mesma imagem duas vezes.
- **Conversão de formato**: PNG, JPEG, WEBP, BMP, GIF e TIFF.
- **Redimensionamento** com ou sem manutenção de proporção (largura/altura configuráveis por imagem ou em lote).
- **Controle de qualidade/compressão** para JPEG e WEBP.
- **Renomeação em lote inteligente**: define um prefixo e a ferramenta numera automaticamente (`_1`, `_2`, `_3`...), resolvendo colisões de nome automaticamente.
- **Remoção de fundo em 3 modos**: Automático, Inteligente e Manual (editor de máscara com pincel direto no navegador) — ver seção dedicada abaixo.
- **Cor de fundo customizável**: ao converter para um formato sem suporte a transparência (JPEG/BMP/GIF) com remoção de fundo ativada, o usuário escolhe a cor sólida que substituirá o fundo removido.
- **Ajustes por imagem ou em lote**: cada card de imagem pode ter configuração própria, ou o usuário aplica um ajuste (dimensão, proporção, remover fundo) a todas de uma vez.
- **Progresso real em streaming**: o backend emite eventos NDJSON por etapa (`removendo_fundo`, `redimensionando`, `convertendo`) por imagem, então a barra de progresso reflete o que está realmente acontecendo, não uma simulação.
- **Fila de processamento visual**: lista o status de cada arquivo (aguardando / processando / concluído / erro) durante o lote.
- **Resultado final**: comparador "antes/depois" com slider por imagem, estatísticas do lote e download individual ou em **ZIP** único.
- **Tema claro/escuro** com alternância manual.
- **Tratamento de erros amigável**: uma imagem corrompida ou com formato não suportado não derruba o lote inteiro — o erro é isolado e reportado só para aquele item.

---

## Como a remoção de fundo funciona

Todo o algoritmo está em `background_remover.py` e é **100% visão computacional clássica** (sem baixar nem carregar nenhum modelo de rede neural). Funciona em camadas incrementais:

### Camada 1 — base (modos "Automático" e "Manual")
1. **Flood fill a partir das bordas**: parte de vários pontos ao longo da moldura da foto e "anda" por regiões de cor parecida, marcando como fundo garantido tudo que está conectado à borda por similaridade de cor (cobre fundos uniformes, com leve gradiente/sombra de estúdio, e elementos soltos encostados na borda).
2. **GrabCut guiado por máscara (OpenCV)**: usa o mapa do passo 1 como ponto de partida (em vez de um retângulo genérico) e refina o contorno com estatística de cor (misturas gaussianas).
3. **Maior componente conectado + preenchimento de buracos internos**: mantém só o maior "blob" contínuo como objeto principal e recupera buracos (ex.: o miolo de letras de um rótulo) que não têm conexão real com a borda.

### Camada 2 — refinamento "Inteligente"
Roda por cima da Camada 1, sem substituí-la:

4. **Isolamento por "pescoço fino"**: detecta topologicamente quando um objeto secundário (etiqueta, cartão, suporte) está fundido ao produto principal por uma conexão estreita — usa erosão progressiva até a máscara se partir em componentes e reconstrói só o núcleo do maior.
5. **Reforço por silhueta poligonal**: quando o contorno já é bem convexo/poligonal (produto retangular, por exemplo), usa esse polígono como heurística extra para aparar resíduos fora da silhueta — nunca é a única fonte de decisão.
6. **Sistema de confiança**: cada corte da Camada 2 recebe uma pontuação; se a confiança for baixa, o resultado mais conservador da Camada 1 é usado no lugar. Regra do projeto: **prefere sobrar um resquício de fundo a arriscar destruir parte do produto**.

### Modo Manual
Usa a mesma base rápida do modo Automático como ponto de partida; a correção fina é feita depois pelo próprio usuário, no navegador, através de um **editor de máscara com pincel** (canvas HTML5, com zoom, desfazer e pintura de "manter"/"apagar").

### Correção de halo de cor nas bordas
Depois de gerar a máscara, `_remover_contaminacao_de_cor_nas_bordas` corrige o "vazamento" de cor do fundo original nos pixels semitransparentes da borda (efeito clássico de halo/franja ao compor sobre um novo fundo), estendendo a cor do próprio objeto para essa faixa fina — sem nunca alterar o canal alpha.

> Trade-off assumido no código: essa abordagem não iguala a precisão de modelos de IA em cabelo/pelos muito finos, mas é mais fiel que um recorte retangular, especialmente em fotos de produto.

---

## Arquitetura e fluxo de processamento

O backend expõe uma única rota de processamento (`POST /api/converter-lote`) que recebe todos os arquivos do lote de uma vez e processa **um por um**, em um gerador Python que faz *streaming* de eventos NDJSON (um JSON por linha) para o front-end conforme cada etapa termina.

Pipeline de cada imagem (`processar_imagem_stream` em `app.py`), sempre nesta ordem:

1. **Abrir e normalizar** — `Image.open` + `.load()` (valida integridade cedo) e conversão para RGBA.
2. **Remover fundo** (se solicitado) — antes do redimensionamento, para preservar o canal alpha corretamente.
3. **Redimensionar** — respeitando proporção quando ativado.
4. **Converter formato + aplicar qualidade** — formatos sem suporte a alpha (JPEG/BMP/GIF) nunca descartam a transparência silenciosamente: ela é composta sobre uma cor de fundo sólida (branca por padrão ou escolhida pelo usuário) e um aviso é retornado.

Decisões de design que valem destacar:

- **Arquivos temporários em disco, não em memória**: cada upload é salvo em uma pasta temporária (`tempfile.mkdtemp`) e removido assim que processado, para suportar lotes de centenas de imagens sem estourar RAM.
- **Configuração por índice de envio, não por nome de arquivo**: evita que dois arquivos com o mesmo nome (ex.: duas fotos "IMG_0001.jpg" de pastas diferentes) compartilhem configuração por colisão de chave.
- **Resiliência parcial do ZIP**: mesmo em modo "baixar como ZIP", os bytes de cada imagem processada também vão no evento individual — assim, se o lote for interrompido antes do ZIP final ser fechado, o front-end ainda consegue entregar o que já havia sido concluído.
- **`X-Accel-Buffering: no`**: evita que um proxy reverso (ex.: em um PaaS como o Render) segure a resposta em buffer inteira antes de repassar ao cliente, o que quebraria o progresso em tempo real.
- **Mensagens de erro amigáveis**: exceções técnicas (arquivo corrompido, estouro de memória, formato não reconhecido) são traduzidas para mensagens curtas e sem traceback antes de chegar ao usuário.

---

## Estrutura do projeto

```
conversor-imagens-main/
├── app.py                     # Servidor Flask: rotas, pipeline de conversão, streaming NDJSON
├── background_remover.py      # Algoritmo de remoção de fundo (visão computacional clássica)
├── requirements.txt           # Dependências Python
├── static/
│   ├── app.js                 # Toda a lógica do front-end (upload, grade de imagens,
│   │                          #   fila, progresso, editor de máscara manual, resultado)
│   ├── style.css               # Estilos (inclui tema claro/escuro)
│   └── favicon/                 # Ícones do site
├── templates/
│   └── index.html              # Página única (SPA simples, sem framework front-end)
└── .gitignore
```

---

## Stack utilizada

**Backend**
- [Flask](https://flask.palletsprojects.com/) — servidor web e roteamento
- [Pillow](https://python-pillow.org/) — abertura, redimensionamento, conversão e salvamento de imagens
- [OpenCV (`opencv-python-headless`)](https://opencv.org/) — flood fill, GrabCut, operações morfológicas (remoção de fundo)
- [NumPy](https://numpy.org/) — manipulação de arrays/máscaras
- [Gunicorn](https://gunicorn.org/) — servidor WSGI para produção

**Frontend**
- HTML + CSS + **JavaScript puro** (sem frameworks/bundlers) — inclui Canvas API para o editor de máscara manual, Drag-and-Drop API, `webkitdirectory` para upload de pastas e `crypto.subtle` para hash de deduplicação.

---

## Como rodar localmente

### Pré-requisitos
- Python 3.9+ (recomendado)
- `pip`

### Passos

```bash
# 1. Clonar/entrar na pasta do projeto
cd conversor-imagens-main

# 2. Criar e ativar um ambiente virtual (recomendado)
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Rodar em modo desenvolvimento
python app.py
```

A aplicação sobe por padrão em `http://localhost:5000` (modo debug ativado em `app.py`).

### Rodando em produção (com Gunicorn)

```bash
gunicorn app:app
```

> O projeto já contém comentários no código voltados a deploy em uma plataforma como o **Render** (ex.: cabeçalho `X-Accel-Buffering` para evitar buffering do proxy reverso), mas não há um `Procfile`/`render.yaml` incluído — adicione conforme a plataforma escolhida.

---

## API

### `GET /`
Renderiza a página principal (`templates/index.html`).

### `POST /api/converter-lote`
Recebe um lote de imagens e devolve um **stream NDJSON** (um objeto JSON por linha, `Content-Type: application/x-ndjson`) com o progresso e o resultado de cada imagem.

**Corpo da requisição** (`multipart/form-data`):

| Campo       | Tipo            | Descrição                                                                 |
|-------------|-----------------|----------------------------------------------------------------------------|
| `arquivos`  | file[]          | Um ou mais arquivos de imagem.                                             |
| `config`    | JSON (string)   | Objeto com a configuração de cada imagem, indexado pela posição de envio (`"0"`, `"1"`, ...) ou pelo nome original. Aceita: `formato`, `largura`, `altura`, `qualidade`, `manter_proporcao`, `novo_nome`, `remover_fundo`, `cor_fundo`, `modo_remocao` (`automatico`/`inteligente`/`manual`). |
| `usar_zip`  | `"true"`/`"false"` | Se `true` (padrão), agrupa todo o resultado em um único ZIP ao final.  |

**Eventos emitidos (uma linha JSON por evento):**

- `{"tipo": "progresso", "indice", "total", "nome", "etapa"}` — emitido antes de cada etapa pesada (`removendo_fundo`, `redimensionando`, `convertendo`).
- `{"tipo": "resultado", "nome", "status": "ok", "salvo_como", "dimensoes", "aviso", "dados" (base64), "mime"}` — resultado de uma imagem processada com sucesso.
- `{"tipo": "resultado", "nome", "status": "erro", "mensagem"}` — erro isolado nessa imagem (o lote continua).
- `{"tipo": "concluido", "zip_base64", "nome_zip"}` — ao final do lote, se `usar_zip=true` (senão apenas `{"tipo": "concluido"}`).

---

## Formatos suportados

| Formato | Leitura | Escrita | Suporta transparência |
|---------|:-------:|:-------:|:----------------------:|
| PNG     | ✅      | ✅      | ✅                      |
| JPEG    | ✅      | ✅      | ❌ (composto sobre cor sólida) |
| WEBP    | ✅      | ✅      | ✅                      |
| BMP     | ✅      | ✅      | ❌ (composto sobre cor sólida) |
| GIF     | ✅      | ✅      | ❌ (composto sobre cor sólida) |
| TIFF    | ✅      | ✅      | ✅                      |

Extensões de entrada aceitas: `png`, `jpg`, `jpeg`, `webp`, `bmp`, `gif`, `tiff`, `tif`.

---

## Compatibilidade de navegador

A interface avisa explicitamente que funciona melhor em **Chrome, Edge e Brave** — navegadores baseados em Chromium, por causa do uso de `webkitdirectory` (upload de pasta inteira) e das APIs de Drag-and-Drop usadas na zona de upload.

---

## Limitações conhecidas

- A remoção de fundo é baseada em heurísticas de visão computacional clássica (flood fill + GrabCut), não em um modelo de IA treinado — funciona muito bem em fotos de produto com fundo relativamente controlado, mas não iguala a precisão de modelos de deep learning em casos como cabelo/pelos muito finos.
- Em imagens **GIF animadas**, a remoção de fundo é aplicada apenas ao primeiro quadro; a animação original não é preservada nesse caso (um aviso é retornado ao usuário).
- O limite de upload está configurado em `app.py` como **300 MB** por requisição (`MAX_CONTENT_LENGTH`).
- Não há persistência: nada é salvo em banco de dados — arquivos temporários são gravados em disco apenas durante o processamento e removidos logo em seguida.
