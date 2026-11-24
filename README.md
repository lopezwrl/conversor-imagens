# Revela

Ferramenta web em Node.js (Fastify) e React (TypeScript) para redimensionamento, conversão e recorte de fundo de imagens em lote, além de conversão e unificação de documentos.

---

## Identidade e Paleta

O projeto trabalha com duas águas cromáticas que se encontram na tela inicial:

| Elemento | Cor | Hex | Papel |
| :--- | :--- | :--- | :--- |
| Água 01 (Fotos) | Bordô | `#60011D` | Superfície e atmosfera do laboratório de imagens |
| Água 02 (Documentos) | Azul-Petróleo | `#0B3B46` | Superfície e atmosfera da mesa de documentos |
| Correnteza e Foco | Dourado | `#BC9200` | Filamentos de encontro, indicadores e foco |
| Tipografia e Ação | Creme | `#FDE2B9` | Leitura principal e botões de execução |

Tipografia self-hosted:
- **Bodoni Moda Variable** nos títulos e marca.
- **Schibsted Grotesk Variable** na interface.
- **IBM Plex Mono** em nomes de arquivo, dimensões e contadores.

---

## Funcionalidades

### 01 / Fotos
- Conversão e redimensionamento via `sharp`: PNG, JPEG, WEBP, AVIF, GIF e TIFF (entrada aceita também BMP e SVG).
- Renomeação em lote reativa com prefixo, sufixo, numeração inicial, quantidade de casas decimais e separador, válida tanto no download individual quanto no pacote ZIP.
- Recorte de fundo em espaço perceptual CIELAB (Rápido, Refinado e Manual com editor de máscara em canvas).
- Comparador antes/depois arrastável e visualização ampliada.

### 02 / Documentos
- Conversão em lote entre PDF, DOCX, XLSX, CSV, JSON, Markdown, HTML e TXT, além de imagens para PDF.
- Unificação (merge) de múltiplos PDFs, documentos e imagens em um único PDF com reordenação por arraste.
- Divisão de PDF (uma página por arquivo), extração de intervalos e rotação de páginas.
- Pré-visualização integrada de PDF, HTML, texto e JSON no navegador.

---

## Execução

### Desenvolvimento
```bash
npm run install:all
npm run dev
```
- Front-end: `http://localhost:5173`
- Servidor API: `http://localhost:3001`

### Produção
```bash
npm run build
npm start
```
Disponível em `http://localhost:3001`.
