import { useEffect, useRef } from "react";
import { useSection } from "../../state/section";

/**
 * Gera os pontos X (em porcentagem 0..100) da linha central do estuário
 * para um dado tempo `t` e deslocamento `offset`.
 * Usado tanto pelo fundo quanto pelo corte do título "Revela", garantindo
 * sincronia matemática perfeita com custo quase zero de CPU.
 */
export function sampleRiverWaveX(
  yNorm: number,
  t: number,
  baseCenter: number,
  phaseOffset = 0,
  amplitude = 4.2
): number {
  const w1 = Math.sin(yNorm * 4.2 - t * 1.15 + phaseOffset) * amplitude;
  const w2 = Math.cos(yNorm * 7.8 + t * 0.82 - phaseOffset * 1.3) * (amplitude * 0.48);
  const w3 = Math.sin(yNorm * 12.5 - t * 1.65 + phaseOffset * 0.7) * (amplitude * 0.22);
  return baseCenter + w1 + w2 + w3;
}

/**
 * Estuário vetorial em Canvas 2D:
 * - Zero WebGL, zero listener de mouse, zero medição de DOM no loop.
 * - Movimento contínuo, autônomo e leve (< 0.2ms por quadro).
 * - Desenha o encontro entre a água Bordô (#60011D) e a água Petróleo (#0B3B46)
 *   com línguas entrelaçadas e filamentos Dourados (#BC9200) e Creme (#FDE2B9).
 */
export function EstuaryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { section } = useSection();
  const targetCenterRef = useRef(50);

  useEffect(() => {
    if (section === "photos") {
      targetCenterRef.current = 118; // Água Bordô cobre toda a tela
    } else if (section === "docs") {
      targetCenterRef.current = -18; // Água Petróleo cobre toda a tela
    } else {
      targetCenterRef.current = 50; // Encontro das águas no meio
    }
  }, [section]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const updateSize = () => {
      // Escala 0.75x para manter 60fps constantes até em telas 4K com GPU integrada
      const scale = 0.75;
      width = Math.max(320, Math.floor(window.innerWidth * scale));
      height = Math.max(240, Math.floor(window.innerHeight * scale));
      canvas.width = width;
      canvas.height = height;
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let currentCenter = targetCenterRef.current;
    let rafId = 0;
    const start = performance.now();

    const buildRibbonPath = (
      t: number,
      centerPct: number,
      phase: number,
      amp: number,
      fillLeft: boolean
    ) => {
      const steps = 36;
      ctx.beginPath();
      if (fillLeft) {
        ctx.moveTo(0, 0);
      } else {
        ctx.moveTo(width, 0);
      }

      for (let i = 0; i <= steps; i++) {
        const yNorm = i / steps;
        const y = yNorm * height;
        const xPct = sampleRiverWaveX(yNorm, t, centerPct, phase, amp);
        const x = (xPct / 100) * width;
        ctx.lineTo(x, y);
      }

      if (fillLeft) {
        ctx.lineTo(0, height);
      } else {
        ctx.lineTo(width, height);
      }
      ctx.closePath();
    };

    const buildFilamentLine = (t: number, centerPct: number, phase: number, amp: number) => {
      const steps = 42;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const yNorm = i / steps;
        const y = yNorm * height;
        const xPct = sampleRiverWaveX(yNorm, t, centerPct, phase, amp);
        const x = (xPct / 100) * width;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };

    const render = (now: number) => {
      rafId = window.requestAnimationFrame(render);
      if (document.hidden) return;

      const t = reducedMotion ? 0 : (now - start) * 0.001;
      currentCenter += (targetCenterRef.current - currentCenter) * (reducedMotion ? 1 : 0.07);

      // 1. Base direita: Água Petróleo profunda (#0B3B46 -> #04191E)
      const gradPetrol = ctx.createLinearGradient(width * 0.35, 0, width, height);
      gradPetrol.addColorStop(0, "#0B3B46");
      gradPetrol.addColorStop(0.55, "#072931");
      gradPetrol.addColorStop(1, "#031519");
      ctx.fillStyle = gradPetrol;
      ctx.fillRect(0, 0, width, height);

      // 2. Correnteza translúcida de Bordô que avança sobre o Petróleo (água doce entrando na salgada)
      ctx.save();
      buildRibbonPath(t * 0.9, currentCenter + 3.6, 1.4, 5.2, true);
      ctx.fillStyle = "rgba(96, 1, 29, 0.38)";
      ctx.fill();
      ctx.restore();

      // 3.Segunda corrente intermediária (mistura Estuário: vinho + petróleo)
      ctx.save();
      buildRibbonPath(t * 1.15, currentCenter + 1.5, 2.7, 4.6, true);
      ctx.fillStyle = "rgba(68, 16, 34, 0.58)";
      ctx.fill();
      ctx.restore();

      // 4. Corpo principal da Água Bordô (#60011D -> #1C030A)
      ctx.save();
      buildRibbonPath(t, currentCenter, 0, 4.2, true);
      const gradBordo = ctx.createLinearGradient(0, 0, width * 0.65, height);
      gradBordo.addColorStop(0, "#1C030A");
      gradBordo.addColorStop(0.45, "#420214");
      gradBordo.addColorStop(1, "#60011D");
      ctx.fillStyle = gradBordo;
      ctx.fill();
      ctx.restore();

      // 5. Língua translúcida de Petróleo que entra sobre o Bordô (contra-corrente)
      ctx.save();
      buildRibbonPath(t * 1.05, currentCenter - 2.4, 4.1, 4.8, false);
      ctx.fillStyle = "rgba(11, 59, 70, 0.34)";
      ctx.fill();
      ctx.restore();

      // 6. Filamentos vivos de Ouro (#BC9200) e Creme (#FDE2B9) na zona de mistura
      if (currentCenter > -10 && currentCenter < 110) {
        ctx.save();
        buildFilamentLine(t * 1.25, currentCenter + 1.1, 0.9, 4.5);
        ctx.strokeStyle = "rgba(188, 146, 0, 0.34)";
        ctx.lineWidth = 2.2;
        ctx.stroke();

        buildFilamentLine(t * 0.95, currentCenter - 0.9, 2.2, 3.8);
        ctx.strokeStyle = "rgba(188, 146, 0, 0.22)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Fio principal da fronteira (mesma fase 0 que corta o título "Revela")
        buildFilamentLine(t, currentCenter, 0, 4.2);
        ctx.strokeStyle = "rgba(253, 226, 185, 0.42)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
    };

    rafId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
