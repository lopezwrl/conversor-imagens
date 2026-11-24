import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { useSection } from "../../state/section";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import { useToast } from "../../state/toasts";
import { getExtension, readDroppedItems } from "../../lib/files";
import { DOC_ACCEPTED_EXTENSIONS, DOC_ONLY_EXTENSIONS, IMAGE_EXTENSIONS } from "../../lib/formats";
import { sampleRiverWaveX } from "../estuary/EstuaryCanvas";

export function Portal() {
  const { setSection } = useSection();
  const { items: images, addFiles: addImages } = useImages();
  const { items: docs, addFiles: addDocs } = useDocuments();
  const { notify } = useToast();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Refs do SVG do título "Revela" para animar o corte exatamente na mesma onda do rio
  const svgRef = useRef<SVGSVGElement>(null);
  const clipPathPolyRef = useRef<SVGPolygonElement>(null);
  const seamLineRef = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rafId = 0;
    const start = performance.now();

    const updateTitleSplit = (now: number) => {
      rafId = window.requestAnimationFrame(updateTitleSplit);
      if (document.hidden) return;

      const svg = svgRef.current;
      const poly = clipPathPolyRef.current;
      const seam = seamLineRef.current;
      if (!svg || !poly || !seam) return;

      const rect = svg.getBoundingClientRect();
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const t = reducedMotion ? 0 : (now - start) * 0.001;

      // Calcula onde a onda central (50% da tela) passa dentro do retângulo do SVG (viewBox 0..600 x 0..150)
      const samples = 14;
      const rightSidePoints: string[] = [];
      const seamPoints: string[] = [];

      for (let i = 0; i <= samples; i++) {
        const fracY = i / samples;
        const screenY = rect.top + fracY * rect.height;
        const yNorm = Math.max(0, Math.min(1, screenY / vh));

        // Posição X da onda na tela (0..100%)
        const waveScreenXPct = sampleRiverWaveX(yNorm, t, 50, 0, 4.2);
        const waveScreenX = (waveScreenXPct / 100) * vw;

        // Converte para coordenada X interna do SVG (0..600)
        const localX = ((waveScreenX - rect.left) / Math.max(1, rect.width)) * 600;
        const localY = fracY * 150;

        rightSidePoints.push(`${localX.toFixed(1)},${localY.toFixed(1)}`);
        seamPoints.push(`${localX.toFixed(1)},${localY.toFixed(1)}`);
      }

      // Polígono que cobre toda a margem esquerda (do início do SVG até a linha da onda)
      const polygonStr = `0,0 ${rightSidePoints.join(" ")} 0,150`;
      poly.setAttribute("points", polygonStr);
      seam.setAttribute("points", seamPoints.join(" "));
    };

    rafId = window.requestAnimationFrame(updateTitleSplit);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const handlePhotoFiles = async (files: File[], folderName?: string | null, hasFolder?: boolean) => {
    const added = await addImages(files, folderName, hasFolder);
    setSection("photos");
    if (added > 0) {
      notify(`${added} ${added === 1 ? "imagem carregada" : "imagens carregadas"}.`, "ok");
    }
  };

  const handleDocFiles = async (files: File[], folderName?: string | null, hasFolder?: boolean) => {
    const added = await addDocs(files, folderName, hasFolder);
    setSection("docs");
    if (added > 0) {
      notify(`${added} ${added === 1 ? "documento carregado" : "documentos carregados"}.`, "ok");
    }
  };

  const onDropHalf = async (side: "photos" | "docs", e: React.DragEvent) => {
    e.preventDefault();
    const { files, folderName, hasFolder } = await readDroppedItems(e.dataTransfer);
    if (!files.length) return;

    const imgFiles = files.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
    const docOnly = files.filter((f) => DOC_ONLY_EXTENSIONS.has(getExtension(f.name)));
    const docCompat = files.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));

    if (side === "photos") {
      if (imgFiles.length > 0) {
        await handlePhotoFiles(imgFiles, folderName, hasFolder);
      } else if (docOnly.length > 0) {
        notify("Documento identificado. Abrindo mesa de Documentos.", "neutral");
        await handleDocFiles(docOnly, folderName, hasFolder);
      } else {
        notify("Formato não suportado.", "warn");
      }
      return;
    }

    if (docCompat.length > 0) {
      await handleDocFiles(docCompat, folderName, hasFolder);
    } else {
      notify("Formato não suportado.", "warn");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex min-h-[calc(100vh-53px)] flex-col justify-between"
    >
      {/* Título Monumental "Revela" no centro:
          Sempre visível, 100% vetorial, cortado ao vivo pela onda do rio.
          Sobre a água Bordô (esquerda), as letras têm a cor Petróleo (#9EDEE5 / #0B3B46).
          Sobre a água Petróleo (direita), as letras têm a cor Bordô (#F4BFC2 / #60011D). */}
      <div className="pointer-events-none relative z-20 mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-6 sm:pt-10">
        <svg
          ref={svgRef}
          viewBox="0 0 600 150"
          className="h-24 w-full max-w-[560px] overflow-visible sm:h-32 lg:h-36"
          aria-label="Revela"
          role="heading"
          aria-level={1}
        >
          <defs>
            <clipPath id="revela-left-water-clip">
              <polygon ref={clipPathPolyRef} points="0,0 300,0 300,150 0,150" />
            </clipPath>
          </defs>

          {/* Camada base (visível no lado direito, sobre a água Petróleo): cor Bordô luminosa */}
          <text
            x="300"
            y="108"
            textAnchor="middle"
            fill="#F4BFC2"
            stroke="#60011D"
            strokeWidth="1.2"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "118px",
              fontWeight: 600,
              letterSpacing: "-0.03em",
            }}
          >
            Revela
          </text>

          {/* Camada recortada pela onda esquerda (sobre a água Bordô): cor Petróleo luminosa */}
          <g clipPath="url(#revela-left-water-clip)">
            <text
              x="300"
              y="108"
              textAnchor="middle"
              fill="#9EDEE5"
              stroke="#0B3B46"
              strokeWidth="1.2"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "118px",
                fontWeight: 600,
                letterSpacing: "-0.03em",
              }}
            >
              Revela
            </text>
          </g>

          {/* Fio de ouro onde a correnteza corta a palavra */}
          <polyline
            ref={seamLineRef}
            points="300,10 300,140"
            fill="none"
            stroke="#BC9200"
            strokeWidth="1.8"
            strokeOpacity="0.75"
          />
        </svg>
      </div>

      {/* Tela cortada em duas margens editoriais (sem caixas tracejadas de IA) */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 lg:grid-cols-2">
        {/* MARGEM ESQUERDA: I. FOTOGRAFIA (Água Bordô #60011D) */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDropHalf("photos", e)}
          className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:py-12 lg:pr-16"
        >
          <div className="border-t border-[#FDE2B9]/25 pt-4">
            <div className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.18em]">
              <span className="text-[#9EDEE5]">MARGEM I</span>
              <span className="text-[#FDE2B9]/70">CÂMARA DE IMAGEM</span>
            </div>
          </div>

          <div className="my-auto py-8">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-5xl italic text-[#9EDEE5] sm:text-6xl">I.</span>
              <h2 className="font-display text-4xl font-medium tracking-tight text-[#FDE2B9] sm:text-5xl">
                Fotografia
              </h2>
            </div>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#D8BC98]">
              Conversão em massa, escala proporcional ou exata, numeração de catálogo e isolamento de fundo em espaço CIELAB com retoque a pincel.
            </p>

            {/* Ficha técnica de formatos (substitui badges redondos genéricos) */}
            <div className="mt-6 border-y border-[#FDE2B9]/20 py-2.5 font-mono text-[11px] tracking-wider text-[#FDE2B9]/85">
              PNG &nbsp;/&nbsp; JPEG &nbsp;/&nbsp; WEBP &nbsp;/&nbsp; AVIF &nbsp;/&nbsp; TIFF &nbsp;/&nbsp; GIF &nbsp;/&nbsp; BMP
            </div>

            {/* Ações diretas com estética editorial */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="h-10 border border-[#BC9200] bg-[#FDE2B9] px-5 font-mono text-xs font-semibold uppercase tracking-wider text-[#60011D] transition-colors hover:bg-white cursor-pointer"
              >
                + Abrir imagens
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="inline-flex h-10 items-center gap-2 border border-[#FDE2B9]/35 bg-[#1C030A]/45 px-4 font-mono text-xs uppercase tracking-wider text-[#FDE2B9] transition-colors hover:border-[#BC9200] hover:bg-[#1C030A]/75 cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#BC9200]" strokeWidth={1.5} />
                Pasta
              </button>

              <button
                type="button"
                onClick={() => setSection("photos")}
                className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#9EDEE5] hover:underline cursor-pointer"
              >
                <span>{images.length > 0 ? `Bancada (${images.length})` : "Abrir bancada"}</span>
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="border-b border-[#FDE2B9]/15 pb-3 font-mono text-[11px] text-[#D8BC98]/75">
            Solte arquivos ou pastas em qualquer ponto desta margem esquerda.
          </div>
        </div>

        {/* MARGEM DIREITA: II. DOCUMENTOS (Água Petróleo #0B3B46) */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDropHalf("docs", e)}
          className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:py-12 lg:pl-16"
        >
          <div className="border-t border-[#FDE2B9]/25 pt-4">
            <div className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.18em]">
              <span className="text-[#F4BFC2]">MARGEM II</span>
              <span className="text-[#FDE2B9]/70">PRANCHETA EDITORIAL</span>
            </div>
          </div>

          <div className="my-auto py-8">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-5xl italic text-[#F4BFC2] sm:text-6xl">II.</span>
              <h2 className="font-display text-4xl font-medium tracking-tight text-[#FDE2B9] sm:text-5xl">
                Documentos
              </h2>
            </div>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#D4C9AE]">
              Transformação entre cadernos de texto, planilhas de catálogo e PDFs. Extração de páginas, rotação e encadernação de múltiplos arquivos em volume único.
            </p>

            {/* Ficha técnica de formatos */}
            <div className="mt-6 border-y border-[#FDE2B9]/20 py-2.5 font-mono text-[11px] tracking-wider text-[#FDE2B9]/85">
              PDF &nbsp;/&nbsp; DOCX &nbsp;/&nbsp; XLSX &nbsp;/&nbsp; CSV &nbsp;/&nbsp; JSON &nbsp;/&nbsp; MD &nbsp;/&nbsp; HTML &nbsp;/&nbsp; TXT
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="h-10 border border-[#BC9200] bg-[#FDE2B9] px-5 font-mono text-xs font-semibold uppercase tracking-wider text-[#0B3B46] transition-colors hover:bg-white cursor-pointer"
              >
                + Abrir documentos
              </button>

              <button
                type="button"
                onClick={() => setSection("docs")}
                className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#F4BFC2] hover:underline cursor-pointer"
              >
                <span>{docs.length > 0 ? `Prancheta (${docs.length})` : "Abrir prancheta"}</span>
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="border-b border-[#FDE2B9]/15 pb-3 font-mono text-[11px] text-[#D4C9AE]/75">
            Solte PDFs, planilhas, textos ou imagens em qualquer ponto desta margem direita.
          </div>
        </div>
      </div>

      {/* Inputs ocultos */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) handlePhotoFiles(list, "fotos", false);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error atributo Chromium
        webkitdirectory=""
        directory=""
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) {
            const folder = (list[0].webkitRelativePath || list[0].name).split("/")[0];
            handlePhotoFiles(list, folder, true);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm,.xlsx,.csv,.json,image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) handleDocFiles(list, "documentos", false);
          e.target.value = "";
        }}
      />
    </motion.section>
  );
}
