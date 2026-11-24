import React, { useEffect, useRef, useState } from "react";
import { useSection } from "../../state/section";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

interface EstuaryCanvasProps {
  titleAnchorRef: React.RefObject<HTMLHeadingElement | null>;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function EstuaryCanvas({ titleAnchorRef }: EstuaryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { section, portalHover, portalDrag } = useSection();
  const [webglReady, setWebglReady] = useState(true);

  // Refs mutáveis lidas pelo loop de animação sem recriar o contexto WebGL
  const targetRef = useRef({
    split: 0.5,
    band: 0.16,
    showTitle: 1.0,
  });

  useEffect(() => {
    if (section === "photos") {
      targetRef.current = { split: 1.38, band: 0.22, showTitle: 0.0 };
    } else if (section === "docs") {
      targetRef.current = { split: -0.38, band: 0.22, showTitle: 0.0 };
    } else {
      const active = portalDrag || portalHover;
      const split =
        portalDrag === "photos"
          ? 0.64
          : portalDrag === "docs"
          ? 0.36
          : active === "photos"
          ? 0.56
          : active === "docs"
          ? 0.44
          : 0.5;
      targetRef.current = { split, band: 0.15, showTitle: 1.0 };
    }
  }, [section, portalHover, portalDrag]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });

    if (!gl) {
      setWebglReady(false);
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      setWebglReady(false);
      return;
    }

    const prog = gl.createProgram();
    if (!prog) {
      setWebglReady(false);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setWebglReady(false);
      return;
    }
    gl.useProgram(prog);

    // Quad de tela cheia
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Textura do título "Revela"
    const titleTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, titleTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const titleCanvas = document.createElement("canvas");
    const titleCtx = titleCanvas.getContext("2d");
    let titleRectUv: [number, number, number, number] = [0.3, 0.12, 0.4, 0.14];

    const rasterizeTitle = () => {
      const el = titleAnchorRef.current;
      if (!el || !titleCtx) return;
      const rect = el.getBoundingClientRect();
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);

      if (rect.width < 10 || rect.height < 10) return;

      titleRectUv = [
        rect.left / vw,
        rect.top / vh,
        rect.width / vw,
        rect.height / vh,
      ];

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const tw = Math.max(64, Math.round(rect.width * dpr));
      const th = Math.max(32, Math.round(rect.height * dpr));

      titleCanvas.width = tw;
      titleCanvas.height = th;
      titleCtx.clearRect(0, 0, tw, th);

      const computed = window.getComputedStyle(el);
      const fontSize = parseFloat(computed.fontSize || "72") * dpr;
      const fontFamily = computed.fontFamily || '"Bodoni Moda Variable", Georgia, serif';

      titleCtx.font = `600 ${fontSize}px ${fontFamily}`;
      titleCtx.textAlign = "center";
      titleCtx.textBaseline = "middle";
      titleCtx.fillStyle = "#ffffff";
      titleCtx.fillText("Revela", tw / 2, th * 0.52);

      gl.bindTexture(gl.TEXTURE_2D, titleTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, titleCanvas);
    };

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uSplit = gl.getUniformLocation(prog, "u_split");
    const uBand = gl.getUniformLocation(prog, "u_band");
    const uPointer = gl.getUniformLocation(prog, "u_pointer");
    const uPointerForce = gl.getUniformLocation(prog, "u_pointerForce");
    const uIsMobile = gl.getUniformLocation(prog, "u_isMobile");
    const uShowTitle = gl.getUniformLocation(prog, "u_showTitle");
    const uTitleRect = gl.getUniformLocation(prog, "u_titleRect");
    const uTitleTex = gl.getUniformLocation(prog, "u_titleTex");

    gl.uniform1i(uTitleTex, 0);

    const resize = () => {
      const dpr = Math.min(1.25, window.devicePixelRatio || 1);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      rasterizeTitle();
    };

    resize();
    if (document.fonts?.ready) {
      document.fonts.ready.then(rasterizeTitle).catch(() => {});
    }
    const delayedMeasure = window.setTimeout(rasterizeTitle, 220);

    let pointerX = 0.5;
    let pointerY = 0.5;
    let pointerForce = 0;

    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX / Math.max(1, window.innerWidth);
      pointerY = e.clientY / Math.max(1, window.innerHeight);
      pointerForce = 1.0;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let curSplit = targetRef.current.split;
    let curBand = targetRef.current.band;
    let curTitle = targetRef.current.showTitle;
    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (document.hidden) return;

      const lerp = reducedMotion ? 1.0 : 0.085;
      curSplit += (targetRef.current.split - curSplit) * lerp;
      curBand += (targetRef.current.band - curBand) * lerp;
      curTitle += (targetRef.current.showTitle - curTitle) * 0.14;
      pointerForce *= 0.95;

      // Re-mede a posição do título quando ele está visível
      if (curTitle > 0.05 && titleAnchorRef.current) {
        const r = titleAnchorRef.current.getBoundingClientRect();
        const vw = Math.max(1, window.innerWidth);
        const vh = Math.max(1, window.innerHeight);
        if (
          Math.abs(r.left / vw - titleRectUv[0]) > 0.004 ||
          Math.abs(r.top / vh - titleRectUv[1]) > 0.004 ||
          Math.abs(r.width / vw - titleRectUv[2]) > 0.004
        ) {
          rasterizeTitle();
        }
      }

      const elapsed = reducedMotion ? 0 : (now - startTime) * 0.001;
      const isMobile = window.innerWidth < 1024 ? 1.0 : 0.0;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uSplit, curSplit);
      gl.uniform1f(uBand, curBand);
      gl.uniform2f(uPointer, pointerX, pointerY);
      gl.uniform1f(uPointerForce, reducedMotion ? 0 : pointerForce);
      gl.uniform1f(uIsMobile, isMobile);
      gl.uniform1f(uShowTitle, curTitle);
      gl.uniform4f(uTitleRect, titleRectUv[0], titleRectUv[1], titleRectUv[2], titleRectUv[3]);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, titleTex);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(delayedMeasure);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [titleAnchorRef]);

  return (
    <canvas
      ref={canvasRef}
      data-webgl={webglReady ? "true" : "false"}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={
        webglReady
          ? undefined
          : {
              background:
                section === "docs"
                  ? "#051C22"
                  : section === "photos"
                  ? "#24050E"
                  : "linear-gradient(90deg, #60011D 0%, #3E212B 46%, #BC9200 50%, #1F353A 54%, #0B3B46 100%)",
            }
      }
    />
  );
}
