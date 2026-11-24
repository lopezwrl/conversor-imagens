export const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;

void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/**
 * Fragment shader do Estuário Revela:
 * - Simula o encontro vivo entre duas águas:
 *   Água 01 (Fotos): Bordô #60011D (#1C030A nas profundezas)
 *   Água 02 (Documentos): Petróleo #0B3B46 (#031519 nas profundezas)
 * - No centro (u_split), domain-warped FBM gera correntes entrelaçadas (marmorizado)
 *   e filamentos sutis em Dourado (#BC9200) e Creme (#FDE2B9).
 * - Amostra a textura do título "Revela" (u_titleTex) e pinta cada pixel da palavra
 *   com a cor da água oposta usando exatamente o mesmo campo fluido (waterMix),
 *   de forma que a correnteza corta as letras do título ao vivo.
 */
export const FRAGMENT_SHADER = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_split;        // 0.5 no portal, 1.35 em Fotos, -0.35 em Documentos
uniform float u_band;         // largura da zona de mistura
uniform vec2 u_pointer;       // cursor normalizado [0..1]
uniform float u_pointerForce; // intensidade da ondulação do cursor
uniform float u_isMobile;     // 0.0 = corte vertical (esq/dir), 1.0 = corte horizontal (topo/base)
uniform float u_showTitle;    // 1.0 no portal, 0.0 nos estúdios
uniform vec4 u_titleRect;     // (x, y, w, h) em coordenadas UV da tela
uniform sampler2D u_titleTex;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.04 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  // UV com Y crescendo para baixo (igual ao DOM)
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  float aspect = u_res.x / max(1.0, u_res.y);
  vec2 p = vec2(uv.x * aspect, uv.y);

  float t = u_time * 0.16;

  // Perturbação suave do cursor na água
  vec2 ptr = vec2(u_pointer.x * aspect, u_pointer.y);
  vec2 toPtr = p - ptr;
  float distPtr = length(toPtr);
  float ripple = exp(-distPtr * 5.5) * sin(distPtr * 22.0 - u_time * 3.2) * 0.032 * u_pointerForce;

  // Domain warping de duas camadas (correntes de água doce e salgada se misturando)
  vec2 q = vec2(
    fbm(p * 2.1 + vec2(0.0, t * 0.9)),
    fbm(p * 2.1 + vec2(5.2, -t * 0.75))
  );

  vec2 r = vec2(
    fbm(p * 3.4 + 2.2 * q + vec2(1.7, t * 1.15)),
    fbm(p * 3.4 + 2.2 * q + vec2(8.3, -t * 1.05))
  );

  float flow = fbm(p * 2.6 + 1.85 * r);

  // Coordenada principal do corte (X no desktop, Y no mobile)
  float axisCoord = mix(uv.x, uv.y, u_isMobile);
  float alongCoord = mix(uv.y, uv.x, u_isMobile);

  // Ondulação orgânica da linha de encontro do estuário
  float meander =
    (q.x - 0.5) * 0.16 +
    (r.y - 0.5) * 0.14 +
    sin(alongCoord * 4.5 + t * 1.4) * 0.025 +
    ripple;

  float signedDist = (axisCoord - u_split) + meander;

  // waterMix: 0.0 = Água Bordô (Fotos), 1.0 = Água Petróleo (Documentos)
  float primaryMix = smoothstep(-u_band, u_band, signedDist);

  // Línguas secundárias dentro da faixa de encontro (efeito estuário / marmorizado)
  float eddyZone = 1.0 - smoothstep(0.0, u_band * 1.35, abs(signedDist));
  float tongues = smoothstep(0.36, 0.64, flow + signedDist * 2.1);
  float waterMix = mix(primaryMix, tongues, eddyZone * 0.68);

  // Paleta das duas águas
  vec3 bordoDeep = vec3(0.110, 0.012, 0.039);   // #1C030A
  vec3 bordoRich = vec3(0.376, 0.004, 0.114);   // #60011D
  vec3 petrolDeep = vec3(0.012, 0.082, 0.098);  // #031519
  vec3 petrolRich = vec3(0.043, 0.231, 0.275);  // #0B3B46
  vec3 gold = vec3(0.737, 0.573, 0.000);        // #BC9200
  vec3 cream = vec3(0.992, 0.886, 0.725);       // #FDE2B9

  // Profundidade interna de cada água
  float depthShade = smoothstep(0.15, 0.88, flow);
  vec3 bordoWater = mix(bordoDeep, bordoRich, 0.42 + 0.48 * depthShade);
  vec3 petrolWater = mix(petrolDeep, petrolRich, 0.42 + 0.50 * (1.0 - depthShade * 0.7));

  vec3 waterColor = mix(bordoWater, petrolWater, waterMix);

  // Veios dourados e creme onde as duas correntes se tocam (waterMix ~ 0.5)
  float interfaceLine = exp(-pow((waterMix - 0.5) * 7.5, 2.0)) * eddyZone;
  float secondaryVein = exp(-pow((flow - 0.52) * 14.0, 2.0)) * eddyZone;
  waterColor = mix(waterColor, gold, interfaceLine * 0.34 + secondaryVein * 0.16);
  waterColor = mix(waterColor, cream, pow(interfaceLine, 3.0) * 0.18);

  // Vinheta sutil nas bordas externas para dar legibilidade aos painéis
  float vig = smoothstep(0.92, 0.2, length((uv - 0.5) * vec2(1.1, 1.1)));
  waterColor *= 0.78 + 0.22 * vig;

  // Título "Revela" cortado pela mesma correnteza:
  // Na água Bordô (waterMix -> 0), o título assume a cor Petróleo (#0B3B46 iluminado + #9EDEE5).
  // Na água Petróleo (waterMix -> 1), o título assume a cor Bordô (#60011D iluminado + #F4BFC2).
  if (u_showTitle > 0.01 && u_titleRect.z > 0.001 && u_titleRect.w > 0.001) {
    vec2 tUv = (uv - u_titleRect.xy) / u_titleRect.zw;
    if (tUv.x >= 0.0 && tUv.x <= 1.0 && tUv.y >= 0.0 && tUv.y <= 1.0) {
      float mask = texture2D(u_titleTex, tUv).a * u_showTitle;
      if (mask > 0.005) {
        // Cor do título sobre o lado Bordô: Petróleo vivo com reflexo mineral claro
        vec3 petrolOnBordo = mix(vec3(0.08, 0.42, 0.49), vec3(0.620, 0.871, 0.898), 0.72 + 0.22 * flow);
        // Cor do título sobre o lado Petróleo: Bordô vivo com reflexo vinho claro
        vec3 bordoOnPetrol = mix(vec3(0.58, 0.05, 0.20), vec3(0.957, 0.749, 0.761), 0.70 + 0.24 * (1.0 - flow));

        float titleSplit = smoothstep(0.32, 0.68, waterMix);
        vec3 titleColor = mix(petrolOnBordo, bordoOnPetrol, titleSplit);

        // Fio dourado/creme onde a linha do rio atravessa as letras do título
        float titleSeam = exp(-pow((waterMix - 0.5) * 9.0, 2.0));
        titleColor = mix(titleColor, mix(gold, cream, 0.55), titleSeam * 0.75);

        waterColor = mix(waterColor, titleColor, mask);
      }
    }
  }

  gl_FragColor = vec4(waterColor, 1.0);
}
`;
