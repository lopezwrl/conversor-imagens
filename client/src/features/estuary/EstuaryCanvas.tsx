import { useEffect, useRef, useState } from "react";
import { useSection } from "../../state/section";

const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;

void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/**
 * Rio / Estuário WebGL interativo e de alta visibilidade:
 * - Duas águas se encontrando em movimento fluido contínuo:
 *   Bordô (#60011D) e Azul-Petróleo (#0B3B46)
 * - No encontro das águas, correntes vivas de Dourado (#BC9200) e Creme (#FDE2B9)
 *   se misturam como água doce e salgada.
 * - Interage em tempo real com o cursor do usuário (criando redemoinhos dourados
 *   e deslocando suavemente a maré).
 * - Nos estúdios (Fotos e Documentos), o rio permanece visível na margem lateral
 *   para que as 4 cores estejam sempre vivas na tela.
 */
const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_split;
uniform vec2 u_mouse;
uniform float u_mouseEnergy;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.5);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = rot * p * 2.05 + vec2(1.4, 7.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  float aspect = u_res.x / max(1.0, u_res.y);
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Velocidade bem visível e contínua
  float t = u_time * 0.42;

  // Interação do cursor com a água (empurra a correnteza e cria ondulação)
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
  vec2 dMouse = p - m;
  float distMouse = length(dMouse);
  float mouseWave = exp(-distMouse * 4.2) * sin(distMouse * 18.0 - u_time * 4.5) * 0.065 * (0.35 + 0.65 * u_mouseEnergy);
  float mousePush = exp(-distMouse * 3.2) * (u_mouse.x - 0.5) * 0.14;

  // Correntes orgânicas (domain warping leve de 3 oitavas)
  vec2 q = vec2(
    fbm(p * 2.2 + vec2(0.0, -t * 0.85)),
    fbm(p * 2.2 + vec2(4.2, t * 0.75))
  );

  vec2 r = vec2(
    fbm(p * 3.1 + 1.9 * q + vec2(1.7, -t * 1.1)),
    fbm(p * 3.1 + 1.9 * q + vec2(6.4, t * 0.95))
  );

  float flow = fbm(p * 2.5 + 1.7 * r);

  // Linha sinuosa do encontro dos rios
  float riverCurve =
    (q.x - 0.5) * 0.22 +
    (r.y - 0.5) * 0.18 +
    sin(uv.y * 5.0 - t * 1.6) * 0.045 +
    mouseWave -
    mousePush;

  float signedDist = (uv.x - u_split) + riverCurve;

  // Zona de mistura larga e expressiva
  float band = 0.20;
  float baseMix = smoothstep(-band, band, signedDist);
  float confluence = 1.0 - smoothstep(0.0, band * 1.45, abs(signedDist));

  // Línguas de água doce (Bordô) e salgada (Petróleo) se entrelaçando
  float tongues = smoothstep(0.30, 0.70, flow + signedDist * 2.2);
  float waterMix = mix(baseMix, tongues, confluence * 0.78);

  // As 4 cores da paleta com saturação e brilho vivos
  vec3 bordoDark = vec3(0.22, 0.005, 0.068);
  vec3 bordoVivid = vec3(0.46, 0.015, 0.155);  // #60011D iluminado pelas correntes
  vec3 petrolDark = vec3(0.022, 0.135, 0.165);
  vec3 petrolVivid = vec3(0.065, 0.31, 0.37);  // #0B3B46 iluminado pelas correntes
  vec3 gold = vec3(0.78, 0.60, 0.02);          // #BC9200 vivo
  vec3 cream = vec3(0.992, 0.886, 0.725);      // #FDE2B9

  // Textura viva dentro de cada rio (caustics / ondas internas)
  float causticsA = smoothstep(0.22, 0.85, flow);
  float causticsB = smoothstep(0.20, 0.85, r.x);

  vec3 leftRiver = mix(bordoDark, bordoVivid, 0.35 + 0.65 * causticsA);
  leftRiver = mix(leftRiver, gold, pow(causticsB, 3.0) * 0.16);

  vec3 rightRiver = mix(petrolDark, petrolVivid, 0.35 + 0.65 * (1.0 - causticsA * 0.65));
  rightRiver = mix(rightRiver, cream, pow(causticsB, 3.5) * 0.12);

  vec3 color = mix(leftRiver, rightRiver, waterMix);

  // Veios de Ouro (#BC9200) e espuma Creme (#FDE2B9) onde as duas águas se chocam
  float seamA = exp(-pow((waterMix - 0.5) * 6.5, 2.0)) * confluence;
  float seamB = exp(-pow((flow - 0.50) * 11.0, 2.0)) * confluence;
  float mouseGlow = exp(-distMouse * 4.8) * (0.25 + 0.45 * u_mouseEnergy);

  color = mix(color, gold, clamp(seamA * 0.58 + seamB * 0.28 + mouseGlow * 0.35, 0.0, 0.78));
  color = mix(color, cream, clamp(pow(seamA, 2.4) * 0.42 + mouseGlow * 0.18, 0.0, 0.55));

  gl_FragColor = vec4(color, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function EstuaryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { section, portalHover, portalDrag } = useSection();
  const [fallback, setFallback] = useState(false);

  // Posição alvo do encontro dos rios:
  // No Início: 0.50 (e reage ao hover/drag).
  // Em Fotos: 0.82 (Bordô domina, mas o rio Petróleo + Ouro continua correndo vivo na margem direita!).
  // Em Documentos: 0.18 (Petróleo domina, mas o rio Bordô + Ouro continua correndo vivo na margem esquerda!).
  const splitTargetRef = useRef(0.5);

  useEffect(() => {
    if (section === "photos") {
      splitTargetRef.current = 0.84;
    } else if (section === "docs") {
      splitTargetRef.current = 0.16;
    } else {
      const focus = portalDrag || portalHover;
      splitTargetRef.current =
        portalDrag === "photos"
          ? 0.64
          : portalDrag === "docs"
          ? 0.36
          : focus === "photos"
          ? 0.57
          : focus === "docs"
          ? 0.43
          : 0.5;
    }
  }, [section, portalHover, portalDrag]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      setFallback(true);
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      setFallback(true);
      return;
    }

    const prog = gl.createProgram();
    if (!prog) {
      setFallback(true);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uSplit = gl.getUniformLocation(prog, "u_split");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uMouseEnergy = gl.getUniformLocation(prog, "u_mouseEnergy");

    // Escala 0.65x: o shader fluido é suave por natureza, então 0.65x
    // reduz em 60% o número de pixels na GPU mantendo visual idêntico e 60fps cravados!
    const resize = () => {
      const scale = 0.65;
      const w = Math.max(320, Math.floor(window.innerWidth * scale));
      const h = Math.max(200, Math.floor(window.innerHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    let targetMouseX = 0.5;
    let targetMouseY = 0.5;
    let curMouseX = 0.5;
    let curMouseY = 0.5;
    let mouseEnergy = 0.2;

    const onPointerMove = (e: PointerEvent) => {
      targetMouseX = e.clientX / Math.max(1, window.innerWidth);
      targetMouseY = e.clientY / Math.max(1, window.innerHeight);
      mouseEnergy = 1.0;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let curSplit = splitTargetRef.current;
    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (document.hidden) return;

      curSplit += (splitTargetRef.current - curSplit) * 0.06;
      curMouseX += (targetMouseX - curMouseX) * 0.09;
      curMouseY += (targetMouseY - curMouseY) * 0.09;
      mouseEnergy = Math.max(0.18, mouseEnergy * 0.96);

      const elapsed = (now - start) * 0.001;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uSplit, curSplit);
      gl.uniform2f(uMouse, curMouseX, curMouseY);
      gl.uniform1f(uMouseEnergy, mouseEnergy);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={
        fallback
          ? {
              background:
                "linear-gradient(105deg, #60011D 0%, #60011D 42%, #BC9200 50%, #0B3B46 58%, #0B3B46 100%)",
            }
          : undefined
      }
    />
  );
}
