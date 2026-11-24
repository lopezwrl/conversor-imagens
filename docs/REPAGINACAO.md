# Revela: plano de repaginação

Documento de referência para qualquer pessoa ou IA que continue este trabalho.
Leia inteiro antes de mexer no código. Atualize a seção "Status" ao final de cada fase.

Branch de trabalho: `v2-react-node`. A versão Flask antiga continua intacta em `main` e `backup-local-revelar`.

---

## 1. Objetivo

Tirar do Revela toda aparência de site gerado por IA e dar a ele uma identidade própria,
mantendo a proposta original: colocar arquivos, ajustar, baixar. Sem cadastro.

O que o dono do projeto pediu, em resumo:

1. Nada de cara de IA: fontes genéricas, caixinhas arredondadas com ícone colorido, slogans
   ("sem crédito", "sem login", "direto ao ponto"), travessões (—) nas frases e nos títulos.
2. React e TypeScript com organização profissional.
3. Animações profissionais e interativas.
4. Navegação Início / Fotos / Documentos centralizada.
5. Sem botão global de modo claro/escuro. O site tem duas águas: Fotos (bordô) e Documentos (petróleo).
6. Tela de início cortada ao meio. As duas cores se misturam no centro como um estuário,
   onde a água doce encontra a salgada.
7. O título atravessa o corte e cada metade assume a cor do lado oposto.
8. A troca entre Fotos e Documentos não pode "dar bugadinha". Precisa ser fluida.
9. Responsivo e ergonômico, com foco no desktop.

---

## 2. Regras de identidade (obrigatórias)

### 2.1 Linguagem
- Proibido o travessão `—` em qualquer texto visível, título, toast, aviso do servidor ou README.
  Use vírgula, dois pontos ou ponto final.
- Proibido slogan de marketing: "sem login", "sem créditos", "sem barreiras", "direto ao ponto",
  "mágico", "turbo", "revolucionário", "com IA".
- Toasts e avisos em tom neutro, frase curta, sem exclamação.
- Evitar o ponto médio `·` como separador decorativo. Preferir quebra de linha ou espaço.
- Nomes dos modos de recorte: **Rápido**, **Refinado**, **Manual**
  (valores de API continuam `automatico`, `inteligente`, `manual`).

### 2.2 Tipografia (self-hosted via @fontsource, sem Google Fonts)
| Papel | Fonte | Motivo |
| :--- | :--- | :--- |
| Títulos e marca | **Bodoni Moda** (variável, opsz) | Didone de moda e editorial. Combina com bordô e dourado, conversa com fotografia de produto e e-commerce. Pouco usada em sites gerados. |
| Interface e texto | **Schibsted Grotesk** (variável) | Grotesca de jornal, com personalidade. Substitui Inter, Plus Jakarta e similares. |
| Dados técnicos | **IBM Plex Mono** | Nomes de arquivo, dimensões, tamanhos e contadores. |

Proibido voltar para Inter, Plus Jakarta Sans, Geist, Fraunces, Space Grotesk ou Poppins.

### 2.3 Forma
- Raios pequenos: 2px (tags), 4px (campos e botões), 6px (cartões), 10px (modais). Nada acima disso.
- Linhas finas (hairline) em vez de sombras grandes. Sem glassmorphism, sem gradiente em botão.
- Ícones Lucide com traço 1.5, sempre inline com texto. Nunca ícone dentro de quadrado colorido.
- Numeração editorial discreta (01, 02) em mono, quando fizer sentido.

### 2.4 Cores
| Token | Valor | Uso |
| :--- | :--- | :--- |
| Bordô | `#60011D` | Água de Fotos |
| Dourado | `#BC9200` | Fio condutor: foco, progresso, filamentos do estuário |
| Creme | `#FDE2B9` | Texto principal e botão de ação |
| Petróleo | `#0B3B46` | Água de Documentos |
| Tom claro de petróleo | `#A3D9DE` | Título sobre o lado bordô |
| Tom claro de bordô | `#F4BFC2` | Título sobre o lado petróleo |

Dois temas, ambos escuros, aplicados por `html[data-theme="photos" | "docs"]`:
- **Fotos**: superfícies `#1C030A`, `#24050E`, `#2F0A16`, `#3D1220`.
- **Documentos**: superfícies `#031519`, `#051C22`, `#0A2830`, `#11353F`.
- Texto em creme nos dois. Botão de ação: fundo creme, texto na cor da água.

Contrastes verificados (WCAG): texto creme sobre painéis acima de 12:1, texto secundário acima de 8:1,
texto terciário acima de 4.8:1, botão creme com texto bordô 11:1 e com texto petróleo 9.7:1,
títulos tingidos acima de 7.4:1.

---

## 3. Arquitetura do front-end

```
client/src/
  main.tsx                    entrada
  app/App.tsx                 casca: providers, header, estuário, rotas por seção
  design/tokens.css           tokens dos dois temas
  design/global.css           Tailwind v4 (@theme inline), base, utilitários
  types/                      shared.ts, image.ts, document.ts (eventos NDJSON tipados)
  lib/                        funções puras: files, naming, format, download, ndjson,
                              imageFormats, docFormats
  state/                      section.tsx (rota por hash + foco do portal + estado do WebGL)
                              toasts.tsx, images.tsx, documents.tsx (useReducer)
  components/ui/              Button, Field (Input/Select/Label), Switch, Segmented,
                              Dropzone, Panel, Toasts
  components/layout/          Header (navegação centralizada)
  components/shared/          BatchRename, ProcessingPanel
  features/estuary/           shader.ts + EstuaryCanvas.tsx (WebGL)
  features/portal/            Portal.tsx
  features/images/            ImageStudio, ImageCard, ImageBulkControls, ImageResults,
                              BeforeAfter, MaskEditor, Lightbox, presets, useImageProcessing
  features/documents/         DocumentStudio, DocumentRow (arrastar para reordenar),
                              DocumentResults, DocumentPreview, presets, useDocumentProcessing
```

Princípios:
- Estado de domínio fora dos componentes visuais (reducers em `state/`, lógica de envio em hooks).
- Nenhum `any` em eventos de rede: tipos discriminados por `tipo`.
- Componentes de UI sem conhecimento de domínio.
- Arquivos com responsabilidade única. Componente acima de ~300 linhas deve ser dividido.

### 3.1 Estuário (WebGL)
- Um único `<canvas>` fixo atrás de tudo, desenhado por shader de fragmento.
- Ruído fbm com domain warping define uma fronteira viva entre as duas águas.
- Na faixa de mistura: línguas de cor entrelaçadas (marmorizado) e filamentos dourados finos.
- O título "Revela" é rasterizado num canvas 2D e enviado como textura. O shader pinta cada pixel
  do título com o tom do lado oposto, usando a mesma fronteira, então o corte do título segue o rio.
- Um `<h1>` real fica no DOM (transparente) para acessibilidade e para medir a posição do título.
- Interações: o lado sob o cursor avança (mola), arrastar arquivo avança mais, o cursor gera
  ondulação leve, escolher um lado faz a água daquele lado inundar a tela (transição entre seções).
- Desempenho: DPR limitado a 1.25, 30 fps nos estúdios, pausa com aba oculta.
- `prefers-reduced-motion`: tempo congelado, sem ondulação, transições instantâneas.
- Sem WebGL: gradiente CSS de reserva e título em creme no DOM.

### 3.2 Transição entre seções
- O fundo é contínuo (o mesmo canvas). Só o conteúdo troca, com fade curto.
- O estado das filas fica nos providers, então trocar de seção nunca perde arquivos.
- Ao trocar de seção a página volta ao topo.

---

## 4. Fases

Marque `[x]` ao concluir. Cada fase termina com `npm run build` sem erros.

### Fase 0: plano
- [x] Este documento.

### Fase 1: fundação de design
- [x] Fontes self-hosted (Bodoni Moda, Schibsted Grotesk, IBM Plex Mono).
- [x] `design/tokens.css` com os temas Fotos e Documentos.
- [x] `design/global.css` com Tailwind v4 `@theme inline`, base, foco visível, reduced motion.
- [x] Remover modos claro/escuro e o botão de tema.

### Fase 2: arquitetura React/TypeScript
- [x] Tipos separados por domínio, eventos NDJSON discriminados.
- [x] `lib/` com funções puras.
- [x] Providers: seção, toasts, imagens, documentos.
- [x] Primitivos de UI.
- [x] Remover `components/` antigos, `context/`, `services/`, `styles/`, `types/revela.ts`.

### Fase 3: estuário
- [x] Shader com mistura, marmorizado e filamentos dourados.
- [x] Título dividido com a cor do lado oposto.
- [x] Interações (hover, arraste, cursor, inundação).
- [x] Reserva sem WebGL e reduced motion.

### Fase 4: início e navegação
- [x] Header com Início / Fotos / Documentos centralizado e sublinhado deslizante.
- [x] Portal dividido, cada metade é área de soltar arquivos.
- [x] Versão mobile com corte horizontal.

### Fase 5: estúdio de Fotos
- [x] Presets, renomeação em lote, controles em lote, cartões, recorte de fundo.
- [x] Resultados com revelação animada (desfoque e dessaturação até a nitidez).
- [x] Comparador antes/depois, editor de máscara e zoom no novo visual.

### Fase 6: estúdio de Documentos
- [x] Lista de documentos reordenável por arraste (e por botões, para acessibilidade).
- [x] Unificar em um PDF, dividir, converter, renomear em lote.
- [x] Pré-visualização de PDF, HTML, texto e JSON.

### Fase 7: linguagem
- [x] Remover travessões e slogans do cliente, servidor, `index.html` e README.
- [x] Revisar toasts e avisos.

### Fase 8: verificação
- [x] `npm --prefix server run build` e `npm --prefix client run build`.
- [x] Teste ponta a ponta da API (`docs/` não guarda o script; ele recria em scratch).
- [x] Captura de tela headless do início e dos estúdios.
- [x] Busca por `—` em `client/src`, `server/src`, `README.md`, `client/index.html`.

---

## 5. Como verificar

```bash
npm --prefix server run build
npm --prefix client run build
npm start                      # http://localhost:3001
```

Busca de travessões (deve retornar vazio):
```powershell
Select-String -Path client/src/**/*,server/src/**/*,README.md,client/index.html -Pattern "—"
```

Checklist visual:
- Início: duas águas, mistura viva no centro, título cortado seguindo o rio, cada metade com a cor oposta.
- Passar o mouse num lado: aquele lado avança. Arrastar arquivo: avança mais.
- Escolher Fotos ou Documentos: a água inunda a tela e o estúdio aparece sem salto.
- Navegação centralizada, sublinhado desliza.
- Nenhum travessão, nenhum slogan, nenhuma fonte genérica.

---

## 6. Status

| Fase | Situação |
| :--- | :--- |
| 0 a 8 | Concluídas na primeira passada da repaginação |

Próximos passos sugeridos (não iniciados):
- Referências do 21st.dev enviadas pelo dono, integradas uma por vez nos primitivos de UI.
- Ajuste fino da paleta do estuário depois de ver em telas diferentes.
- Testes de componente (Vitest + Testing Library) para `lib/naming.ts` e reducers.
