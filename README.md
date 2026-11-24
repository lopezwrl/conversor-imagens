# Revela v2 — Estúdio de Imagens & Documentos em Lote

Aplicação web (**Node.js + Fastify + React + TypeScript + Framer Motion**) feita para **redimensionar, converter, remover fundo de imagens e transformar documentos em massa**, sem criar conta, sem login, sem créditos e sem tokens.

---

## Identidade Visual (4 Cores · 4 Temas)

| Papel | Cor | Hex | Uso |
| :--- | :--- | :--- | :--- |
| **Bordô** | Vinho Profundo | `#60011D` | Protagonista do estúdio de **Fotos** |
| **Dourado** | Ouro Envelhecido | `#BC9200` | Fio condutor metálico (bordas, brilhos, acentos e progresso) |
| **Creme** | Pergaminho Quente | `#FDE2B9` | Superfície clara quente e texto principal nos modos escuros |
| **Azul-Petróleo** | Deep Petrol *(4ª cor)* | `#0B3B46` | Protagonista do estúdio de **Documentos** |

Cada estúdio possui **modo Claro e modo Escuro próprios e independentes**:
- **Fotos:** *Câmara Escura* (dark) e *Ateliê Claro* (light)
- **Documentos:** *Estúdio Noturno* (dark) e *Papelaria Clara* (light)

---

## Principais Funcionalidades

### Navegação & UX
- **Portal Duplo (Split-Screen 50/50):** fotos à esquerda, documentos à direita; ao arrastar ou selecionar um arquivo, o lado oposto recolhe com animação elástica e o estúdio escolhido ocupa 100% da tela com sua própria paleta.
- **Detecção automática zero-fricção:** soltar um documento na área de fotos redireciona automaticamente para Documentos.
- **Respeito a `prefers-reduced-motion`** em todas as animações (`MotionConfig reducedMotion="user"` + CSS).

### Estúdio de Fotos
- **Conversão & Redimensionamento ultrarrápido (`sharp`):** PNG, JPEG, WEBP, AVIF, GIF e TIFF (entrada também suporta BMP e SVG), com auto-rotação EXIF e ajuste LANCZOS3.
- **Presets Rápidos (1 clique):** Web Otimizado, E-commerce 1200×1200, Instagram 1080×1080, Reduzir 50%, Alta Nitidez (PNG) e Sem Fundo.
- **Renomeação em Lote Reativa:** prefixo, sufixo, início da numeração, quantidade de dígitos (`01`/`001`), separador e prévia ao vivo em cada card — sincronizada no download individual e no ZIP.
- **Remoção de Fundo v2 (100% Node · espaço perceptual CIELAB):**
  - *Automático* (flood-fill CIELAB barrado por gradiente Sobel + preenchimento de buracos internos + remoção de halo/color spill).
  - *Inteligente* (limpeza de áreas vazadas internas + separação topológica de objetos anexos por "pescoço fino" com proteção conservadora).
  - *Manual* (abre o **Editor de Máscara Canvas v2** com cursor circular real, dureza/suavidade do pincel, preview de fundo em 4 cores, zoom, mover com Espaço/botão do meio e desfazer/refazer `Ctrl+Z`/`Ctrl+Y`).
- **Comparador Antes/Depois**, **Lightbox de Zoom**, **Streaming real NDJSON**, fila de progresso e download individual ou em ZIP.

### Estúdio de Documentos
- **Conversões em lote (100% Node puro, sem binários externos obrigatórios):**
  - `DOCX` → PDF, HTML, Markdown, TXT
  - `Markdown / HTML / TXT` ↔ PDF, DOCX, HTML, Markdown, TXT
  - `XLSX ↔ CSV ↔ JSON` → também exportáveis para PDF (tabela paginada), HTML e Markdown
  - `PDF` → extração de texto (TXT/MD/HTML/DOCX), rotação (90°/180°/270°), extração de intervalo de páginas (`1-3, 5`) e **Dividir PDF** (1 página por arquivo)
  - `Imagens (PNG/JPG/WEBP)` → PDF (A4, Carta ou ajustado à imagem)
- **Unificar em 1 PDF (Merge):** junte PDFs, documentos e imagens em um único PDF na ordem escolhida.
- **Renomeação em lote**, **Quick Preview inline** (PDF/HTML/TXT/JSON) e download individual ou em ZIP.

---

## Como Rodar

### Pré-requisitos
- Node.js 20+ (testado em Node v24)

### Desenvolvimento (API + React com hot reload)
```bash
npm run install:all
npm run dev
```
- Front-end (Vite): `http://localhost:5173`
- API (Fastify): `http://localhost:3001`

### Produção (build único servido pelo Node)
```bash
npm run build
npm start
```
Acesse diretamente em `http://localhost:3001`.
