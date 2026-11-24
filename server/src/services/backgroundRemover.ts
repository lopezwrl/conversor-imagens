import sharp from "sharp";

export type ModoRemocao = "automatico" | "inteligente" | "manual";

export interface OpcoesRemocaoFundo {
  modo?: ModoRemocao;
  /** Sensibilidade de 0 (conservador) a 100 (agressivo). Padrão: 50. */
  sensibilidade?: number;
}

export interface ResultadoRemocaoFundo {
  rgba: Buffer;
  width: number;
  height: number;
  aviso: string | null;
}

interface LabColor {
  L: number;
  a: number;
  b: number;
}

// ---------- Conversão rápida sRGB -> CIELAB (D65) ----------
const SRGB_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function fLab(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function rgbToLab(r: number, g: number, b: number): LabColor {
  const rl = SRGB_LUT[r];
  const gl = SRGB_LUT[g];
  const bl = SRGB_LUT[b];

  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;

  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Distância perceptual ponderada em CIELAB (reduz peso de luminância para tolerar sombras suaves). */
function deltaE(
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number,
  pesoL = 0.72
): number {
  const dL = (L1 - L2) * pesoL;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** Pré-calcula canais LAB e magnitude de gradiente Sobel (para barrar vazamento nas bordas do produto). */
function calcularLabEGradiente(rgb: Buffer, w: number, h: number) {
  const n = w * h;
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const lab = rgbToLab(rgb[idx], rgb[idx + 1], rgb[idx + 2]);
    L[i] = lab.L;
    A[i] = lab.a;
    B[i] = lab.b;
  }

  // Sobel na luminância + croma para encontrar bordas reais do objeto
  const grad = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      const gxL =
        -L[i - w - 1] +
        L[i - w + 1] -
        2 * L[i - 1] +
        2 * L[i + 1] -
        L[i + w - 1] +
        L[i + w + 1];
      const gyL =
        -L[i - w - 1] -
        2 * L[i - w] -
        L[i - w + 1] +
        L[i + w - 1] +
        2 * L[i + w] +
        L[i + w + 1];

      const gxA = -A[i - 1] + A[i + 1];
      const gyA = -A[i - w] + A[i + w];
      const gxB = -B[i - 1] + B[i + 1];
      const gyB = -B[i - w] + B[i + w];

      grad[i] = Math.hypot(gxL, gyL) * 0.25 + Math.hypot(gxA, gyA) + Math.hypot(gxB, gyB);
    }
  }

  return { L, A, B, grad };
}

/** Extrai até 4 protótipos de cor de fundo ao longo das 4 bordas da imagem + desvio natural. */
function analisarBordas(L: Float32Array, A: Float32Array, B: Float32Array, w: number, h: number) {
  const amostras: LabColor[] = [];
  const passo = Math.max(1, Math.floor(Math.min(w, h) / 60));

  for (let x = 0; x < w; x += passo) {
    amostras.push({ L: L[x], a: A[x], b: B[x] });
    const bot = (h - 1) * w + x;
    amostras.push({ L: L[bot], a: A[bot], b: B[bot] });
  }
  for (let y = 0; y < h; y += passo) {
    const left = y * w;
    const right = left + (w - 1);
    amostras.push({ L: L[left], a: A[left], b: B[left] });
    amostras.push({ L: L[right], a: A[right], b: B[right] });
  }

  // Agrupamento guloso rápido (até 4 clusters principais de fundo)
  const clusters: Array<{ L: number; a: number; b: number; count: number }> = [];
  const raioCluster = 16;

  for (const s of amostras) {
    let melhorIdx = -1;
    let melhorDist = Infinity;
    for (let c = 0; c < clusters.length; c++) {
      const d = deltaE(s.L, s.a, s.b, clusters[c].L, clusters[c].a, clusters[c].b, 0.85);
      if (d < melhorDist) {
        melhorDist = d;
        melhorIdx = c;
      }
    }
    if (melhorIdx !== -1 && melhorDist < raioCluster) {
      const cl = clusters[melhorIdx];
      const total = cl.count + 1;
      cl.L = (cl.L * cl.count + s.L) / total;
      cl.a = (cl.a * cl.count + s.a) / total;
      cl.b = (cl.b * cl.count + s.b) / total;
      cl.count = total;
    } else if (clusters.length < 6) {
      clusters.push({ L: s.L, a: s.a, b: s.b, count: 1 });
    }
  }

  clusters.sort((x, y) => y.count - x.count);
  const principais = clusters.slice(0, 3).filter((c) => c.count >= Math.max(2, amostras.length * 0.08));
  if (!principais.length && clusters.length) principais.push(clusters[0]);

  // Calcula dispersão natural do fundo (para tolerância adaptativa em gradientes/sombras)
  let somaDist = 0;
  let validos = 0;
  for (const s of amostras) {
    let minD = Infinity;
    for (const c of principais) {
      const d = deltaE(s.L, s.a, s.b, c.L, c.a, c.b, 0.72);
      if (d < minD) minD = d;
    }
    if (minD < 35) {
      somaDist += minD;
      validos++;
    }
  }
  const dispersao = validos > 0 ? somaDist / validos : 5;

  return { clusters: principais, dispersao };
}

/** Flood-fill multi-semente em CIELAB barrado por gradiente Sobel. */
function floodFillFundoLab(
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  grad: Float32Array,
  w: number,
  h: number,
  clusters: Array<{ L: number; a: number; b: number }>,
  toleranciaBase: number,
  limiarBorda: number
): Uint8Array {
  const n = w * h;
  const fundo = new Uint8Array(n); // 1 = fundo, 0 = objeto
  const visitado = new Uint8Array(n);
  const queue = new Int32Array(n);
  const seedRef = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const distParaCluster = (idx: number) => {
    let best = Infinity;
    for (const c of clusters) {
      const d = deltaE(L[idx], A[idx], B[idx], c.L, c.a, c.b, 0.72);
      if (d < best) best = d;
    }
    return best;
  };

  // Semeia toda a moldura cujas cores pertençam aos clusters de fundo
  const tentarSemear = (x: number, y: number) => {
    const idx = y * w + x;
    if (visitado[idx]) return;
    if (distParaCluster(idx) <= toleranciaBase * 1.25) {
      visitado[idx] = 1;
      fundo[idx] = 1;
      seedRef[idx] = idx;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    tentarSemear(x, 0);
    tentarSemear(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tentarSemear(0, y);
    tentarSemear(w - 1, y);
  }

  // Fallback se nada na borda foi semeado (produto muito perto da borda): semeia os 4 cantos
  if (tail === 0) {
    const cantos = [0, w - 1, (h - 1) * w, h * w - 1];
    for (const idx of cantos) {
      visitado[idx] = 1;
      fundo[idx] = 1;
      seedRef[idx] = idx;
      queue[tail++] = idx;
    }
  }

  const tolVizinho = Math.max(6, toleranciaBase * 0.55);

  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const ref = seedRef[cur];

    const vizinhos: number[] = [];
    if (cx > 0) vizinhos.push(cur - 1);
    if (cx < w - 1) vizinhos.push(cur + 1);
    if (cy > 0) vizinhos.push(cur - w);
    if (cy < h - 1) vizinhos.push(cur + w);

    for (const nxt of vizinhos) {
      if (visitado[nxt]) continue;

      const dCluster = distParaCluster(nxt);
      const dSeed = deltaE(L[nxt], A[nxt], B[nxt], L[ref], A[ref], B[ref], 0.72);
      const dLocal = deltaE(L[nxt], A[nxt], B[nxt], L[cur], A[cur], B[cur], 0.8);

      // Se houver borda forte (Sobel alto), exige similaridade muito mais estrita
      const bordaForte = grad[nxt] > limiarBorda;
      const limite = bordaForte ? toleranciaBase * 0.45 : toleranciaBase;

      if ((dCluster <= limite || dSeed <= limite) && dLocal <= tolVizinho) {
        visitado[nxt] = 1;
        fundo[nxt] = 1;
        seedRef[nxt] = ref;
        queue[tail++] = nxt;
      }
    }
  }

  return fundo;
}

/** Mantém o maior componente conectado (ou todos acima de minRatio do maior). */
function filtrarComponentesPrincipais(
  mascaraObj: Uint8Array,
  w: number,
  h: number,
  apenasMaior: boolean
): Uint8Array {
  const n = w * h;
  const labels = new Int32Array(n);
  const queue = new Int32Array(n);
  const areas: number[] = [0];
  let currentLabel = 0;

  for (let i = 0; i < n; i++) {
    if (mascaraObj[i] === 0 || labels[i] !== 0) continue;
    currentLabel++;
    let head = 0;
    let tail = 0;
    labels[i] = currentLabel;
    queue[tail++] = i;
    let area = 0;

    while (head < tail) {
      const cur = queue[head++];
      area++;
      const cx = cur % w;
      const cy = (cur - cx) / w;

      if (cx > 0 && mascaraObj[cur - 1] && !labels[cur - 1]) {
        labels[cur - 1] = currentLabel;
        queue[tail++] = cur - 1;
      }
      if (cx < w - 1 && mascaraObj[cur + 1] && !labels[cur + 1]) {
        labels[cur + 1] = currentLabel;
        queue[tail++] = cur + 1;
      }
      if (cy > 0 && mascaraObj[cur - w] && !labels[cur - w]) {
        labels[cur - w] = currentLabel;
        queue[tail++] = cur - w;
      }
      if (cy < h - 1 && mascaraObj[cur + w] && !labels[cur + w]) {
        labels[cur + w] = currentLabel;
        queue[tail++] = cur + w;
      }
    }
    areas.push(area);
  }

  if (currentLabel <= 1) return mascaraObj;

  let maiorArea = 0;
  let maiorLabel = 1;
  for (let l = 1; l <= currentLabel; l++) {
    if (areas[l] > maiorArea) {
      maiorArea = areas[l];
      maiorLabel = l;
    }
  }

  const out = new Uint8Array(n);
  const minArea = apenasMaior ? maiorArea : Math.max(25, maiorArea * 0.05);
  for (let i = 0; i < n; i++) {
    const lb = labels[i];
    if (lb === maiorLabel || (!apenasMaior && lb > 0 && areas[lb] >= minArea)) {
      out[i] = 255;
    }
  }
  return out;
}

/** Preenche buracos internos de fundo que não têm caminho até a moldura da foto. */
function preencherBuracosInternos(mascaraObj: Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const alcancavel = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const pushIfBg = (idx: number) => {
    if (mascaraObj[idx] === 0 && !alcancavel[idx]) {
      alcancavel[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    pushIfBg(x);
    pushIfBg((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(y * w);
    pushIfBg(y * w + (w - 1));
  }

  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    if (cx > 0) pushIfBg(cur - 1);
    if (cx < w - 1) pushIfBg(cur + 1);
    if (cy > 0) pushIfBg(cur - w);
    if (cy < h - 1) pushIfBg(cur + w);
  }

  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = alcancavel[i] ? 0 : 255;
  }
  return out;
}

function erodirBinario(mask: Uint8Array, w: number, h: number, raio: number): Uint8Array {
  // Erosão separável aproximada (muito rápida)
  const temp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let ok = 255;
      const x0 = Math.max(0, x - raio);
      const x1 = Math.min(w - 1, x + raio);
      for (let k = x0; k <= x1; k++) {
        if (mask[row + k] === 0) {
          ok = 0;
          break;
        }
      }
      temp[row + x] = ok;
    }
  }

  for (let y = 0; y < h; y++) {
    const row = y * w;
    const y0 = Math.max(0, y - raio);
    const y1 = Math.min(h - 1, y + raio);
    for (let x = 0; x < w; x++) {
      let ok = 255;
      for (let k = y0; k <= y1; k++) {
        if (temp[k * w + x] === 0) {
          ok = 0;
          break;
        }
      }
      out[row + x] = ok;
    }
  }
  return out;
}

function dilatarBinario(mask: Uint8Array, w: number, h: number, raio: number): Uint8Array {
  const temp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let any = 0;
      const x0 = Math.max(0, x - raio);
      const x1 = Math.min(w - 1, x + raio);
      for (let k = x0; k <= x1; k++) {
        if (mask[row + k] > 0) {
          any = 255;
          break;
        }
      }
      temp[row + x] = any;
    }
  }

  for (let y = 0; y < h; y++) {
    const row = y * w;
    const y0 = Math.max(0, y - raio);
    const y1 = Math.min(h - 1, y + raio);
    for (let x = 0; x < w; x++) {
      let any = 0;
      for (let k = y0; k <= y1; k++) {
        if (temp[k * w + x] > 0) {
          any = 255;
          break;
        }
      }
      out[row + x] = any;
    }
  }
  return out;
}

/** Camada 2 (Modo Inteligente): limpa bolsos internos de fundo + separa objetos anexos por "pescoço fino". */
function refinarInteligente(
  mascaraBase: Uint8Array,
  L: Float32Array,
  A: Float32Array,
  B: Float32Array,
  grad: Float32Array,
  w: number,
  h: number,
  clusters: Array<{ L: number; a: number; b: number }>,
  tolerancia: number
): { mascara: Uint8Array; aviso: string | null } {
  const n = w * h;
  let atual: Uint8Array = new Uint8Array(mascaraBase);
  let aviso: string | null = null;

  // 1) Detectar vazamentos/bolsos internos de cor quase idêntica ao fundo (ex.: alça de xícara/bolsa)
  let areaBase = 0;
  for (let i = 0; i < n; i++) if (atual[i]) areaBase++;
  if (areaBase === 0) return { mascara: atual, aviso: null };

  const semBolsos = new Uint8Array(atual);
  let removidosBolso = 0;
  const tolEstrita = tolerancia * 0.65;
  for (let i = 0; i < n; i++) {
    if (!atual[i] || grad[i] > 14) continue;
    let minD = Infinity;
    for (const c of clusters) {
      const d = deltaE(L[i], A[i], B[i], c.L, c.a, c.b, 0.85);
      if (d < minD) minD = d;
    }
    if (minD < tolEstrita) {
      semBolsos[i] = 0;
      removidosBolso++;
    }
  }

  // Só aceita remoção de bolsos se for moderada (não comer o produto inteiro branco)
  const fracaoRemovida = removidosBolso / areaBase;
  if (fracaoRemovida > 0.008 && fracaoRemovida < 0.35) {
    atual = filtrarComponentesPrincipais(semBolsos, w, h, true);
    aviso = "Modo Inteligente: áreas vazadas de fundo foram refinadas automaticamente.";
  }

  // 2) Isolamento topológico por "pescoço fino" (etiquetas/tags encostadas no produto)
  let areaAtual = 0;
  for (let i = 0; i < n; i++) if (atual[i]) areaAtual++;

  const maxRaio = Math.min(18, Math.max(4, Math.floor(Math.min(w, h) * 0.03)));
  for (let r = 2; r <= maxRaio; r += 2) {
    const erodida = erodirBinario(atual, w, h, r);
    const maiorNucleo = filtrarComponentesPrincipais(erodida, w, h, true);

    let areaErodida = 0;
    let areaMaior = 0;
    for (let i = 0; i < n; i++) {
      if (erodida[i]) areaErodida++;
      if (maiorNucleo[i]) areaMaior++;
    }

    // Se a erosão partiu o blob em 2+ partes relevantes
    if (areaErodida > 0 && areaMaior < areaErodida * 0.92 && areaMaior > areaErodida * 0.35) {
      // Reconstrução morfológica do núcleo principal contida na máscara `atual`
      let recon: Uint8Array = maiorNucleo;
      for (let step = 0; step < r + 6; step++) {
        const dil = dilatarBinario(recon, w, h, 2);
        let mudou = false;
        for (let i = 0; i < n; i++) {
          const v = dil[i] && atual[i] ? 255 : 0;
          if (v !== recon[i]) mudou = true;
          dil[i] = v;
        }
        recon = dil;
        if (!mudou) break;
      }

      let areaRecon = 0;
      for (let i = 0; i < n; i++) if (recon[i]) areaRecon++;
      const mantido = areaRecon / areaAtual;

      // Sistema de confiança: só aceita se mantiver >= 65% do objeto principal
      if (mantido >= 0.65 && mantido <= 0.97) {
        atual = recon;
        aviso =
          "Modo Inteligente: um objeto secundário conectado por uma borda fina foi separado do produto principal.";
      }
      break;
    }
  }

  return { mascara: atual, aviso };
}

/** Suavização rápida separável (box blur 2 passadas -> aproxima Gaussian sigma ~1.5). */
function suavizarAlpha(alpha: Uint8Array, w: number, h: number, raio = 2): Uint8Array {
  const n = w * h;
  let src = new Uint8Array(alpha);
  let dst = new Uint8Array(n);

  for (let pass = 0; pass < 2; pass++) {
    // Horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let soma = 0;
      const win = raio * 2 + 1;
      for (let k = -raio; k <= raio; k++) {
        soma += src[row + Math.min(w - 1, Math.max(0, k))];
      }
      for (let x = 0; x < w; x++) {
        dst[row + x] = Math.round(soma / win);
        const sai = Math.max(0, x - raio);
        const entra = Math.min(w - 1, x + raio + 1);
        soma += src[row + entra] - src[row + sai];
      }
    }
    // Vertical
    for (let x = 0; x < w; x++) {
      let soma = 0;
      const win = raio * 2 + 1;
      for (let k = -raio; k <= raio; k++) {
        soma += dst[Math.min(h - 1, Math.max(0, k)) * w + x];
      }
      for (let y = 0; y < h; y++) {
        src[y * w + x] = Math.round(soma / win);
        const sai = Math.max(0, y - raio);
        const entra = Math.min(h - 1, y + raio + 1);
        soma += dst[entra * w + x] - dst[sai * w + x];
      }
    }
  }
  return src;
}

/** Remove halo/color spill nos pixels semi-transparentes estendendo a cor opaca do objeto para fora. */
function despoluirBordas(
  rgb: Buffer,
  alpha: Uint8Array,
  w: number,
  h: number,
  preservarRgbFundo: boolean,
  passos = 5
): Buffer {
  const n = w * h;
  const rgba = Buffer.allocUnsafe(n * 4);

  // Copia original primeiro
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
  }

  // No modo manual, preservamos RGB onde alpha=0 para o pincel "Restaurar", mas ainda despoluímos a franja semi-transparente!
  const known = new Uint8Array(n);
  const workR = new Uint8Array(n);
  const workG = new Uint8Array(n);
  const workB = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    workR[i] = rgb[i * 3];
    workG[i] = rgb[i * 3 + 1];
    workB[i] = rgb[i * 3 + 2];
    if (alpha[i] >= 242) known[i] = 1;
  }

  for (let p = 0; p < passos; p++) {
    const nextKnown = new Uint8Array(known);
    let algum = false;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        if (known[i]) continue;
        // Se for manual, só despolui pixels com alpha > 0 (mantém fundo 0 com RGB intacto)
        if (preservarRgbFundo && alpha[i] === 0) continue;

        let sr = 0,
          sg = 0,
          sb = 0,
          cnt = 0;
        const nbs = [i - 1, i + 1, i - w, i + w];
        for (const nb of nbs) {
          if (known[nb]) {
            sr += workR[nb];
            sg += workG[nb];
            sb += workB[nb];
            cnt++;
          }
        }
        if (cnt > 0) {
          workR[i] = Math.round(sr / cnt);
          workG[i] = Math.round(sg / cnt);
          workB[i] = Math.round(sb / cnt);
          nextKnown[i] = 1;
          algum = true;
        }
      }
    }
    known.set(nextKnown);
    if (!algum) break;
  }

  for (let i = 0; i < n; i++) {
    if (alpha[i] < 242 && (!preservarRgbFundo || alpha[i] > 0)) {
      rgba[i * 4] = workR[i];
      rgba[i * 4 + 1] = workG[i];
      rgba[i * 4 + 2] = workB[i];
    }
  }

  return rgba;
}

export async function removerFundoImagem(
  inputBuffer: Buffer,
  opcoes: OpcoesRemocaoFundo = {}
): Promise<ResultadoRemocaoFundo> {
  const modo: ModoRemocao = opcoes.modo ?? "automatico";
  const sensibilidade = Math.max(0, Math.min(100, opcoes.sensibilidade ?? 50));

  // Normaliza orientação EXIF e obtém RGB original
  const baseImg = sharp(inputBuffer).rotate().removeAlpha();
  const { data: origRgb, info: origInfo } = await baseImg.raw().toBuffer({ resolveWithObject: true });
  const origW = origInfo.width;
  const origH = origInfo.height;

  // Trabalha em resolução controlada (máx 720px no lado maior) para alta performance em lote
  const ladoMax = 720;
  const escala = Math.min(1, ladoMax / Math.max(origW, origH));
  const workW = Math.max(1, Math.round(origW * escala));
  const workH = Math.max(1, Math.round(origH * escala));

  const workRgb =
    escala < 1
      ? await sharp(origRgb, { raw: { width: origW, height: origH, channels: 3 } })
          .resize(workW, workH, { kernel: "lanczos3" })
          .raw()
          .toBuffer()
      : origRgb;

  const { L, A, B, grad } = calcularLabEGradiente(workRgb, workW, workH);
  const { clusters, dispersao } = analisarBordas(L, A, B, workW, workH);

  // Tolerância adaptativa: sensibilidade 50 -> ~14-24 ΔE conforme variância natural da borda
  const fatorSens = 0.55 + (sensibilidade / 100) * 1.1; // 0.55x a 1.65x
  const toleranciaBase = Math.min(46, Math.max(9, (13 + dispersao * 1.15) * fatorSens));
  const limiarBorda = Math.max(12, 24 - (sensibilidade - 50) * 0.14);

  const fundoMask = floodFillFundoLab(L, A, B, grad, workW, workH, clusters, toleranciaBase, limiarBorda);

  // Converte para máscara de objeto (255 = objeto, 0 = fundo)
  const n = workW * workH;
  let objMask: Uint8Array = new Uint8Array(n);
  let pixelsObj = 0;
  for (let i = 0; i < n; i++) {
    if (fundoMask[i] === 0) {
      objMask[i] = 255;
      pixelsObj++;
    }
  }

  let aviso: string | null = null;

  // Proteção: se a remoção apagou praticamente toda a foto (< 1% sobrando), recua com tolerância menor
  if (pixelsObj < n * 0.01) {
    const fundoSeguro = floodFillFundoLab(L, A, B, grad, workW, workH, clusters, toleranciaBase * 0.45, limiarBorda * 0.7);
    objMask = new Uint8Array(n);
    for (let i = 0; i < n; i++) objMask[i] = fundoSeguro[i] === 0 ? 255 : 0;
    aviso = "Fundo muito próximo da cor do objeto — aplicamos recorte conservador para preservar o produto.";
  }

  // Limpa fragmentos isolados e fecha buracos internos (ex.: interior de letras no rótulo)
  objMask = filtrarComponentesPrincipais(objMask, workW, workH, modo === "inteligente");
  objMask = preencherBuracosInternos(objMask, workW, workH);

  // Fechamento morfológico leve (dilata 1 -> erodir 1) para selar micro-falhas
  objMask = erodirBinario(dilatarBinario(objMask, workW, workH, 1), workW, workH, 1);

  if (modo === "inteligente") {
    const resInt = refinarInteligente(objMask, L, A, B, grad, workW, workH, clusters, toleranciaBase);
    objMask = resInt.mascara;
    if (resInt.aviso) aviso = aviso ? `${aviso} ${resInt.aviso}` : resInt.aviso;
  }

  // Suavização da borda do alpha
  const alphaWork = suavizarAlpha(objMask, workW, workH, 1);

  // Escala máscara alpha de volta à resolução original
  let alphaFinal: Uint8Array;
  if (escala < 1) {
    const resizedAlpha = await sharp(Buffer.from(alphaWork), {
      raw: { width: workW, height: workH, channels: 1 },
    })
      .resize(origW, origH, { kernel: "lanczos3" })
      .raw()
      .toBuffer();
    alphaFinal = new Uint8Array(resizedAlpha.buffer, resizedAlpha.byteOffset, resizedAlpha.byteLength);
  } else {
    alphaFinal = alphaWork;
  }

  // Despoluição de cor / remoção de halo nas bordas
  const rgba = despoluirBordas(origRgb, alphaFinal, origW, origH, modo === "manual", 5);

  return { rgba, width: origW, height: origH, aviso };
}
