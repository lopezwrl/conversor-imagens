import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Moon,
  Scissors,
  Sparkles,
  Sun,
  Upload,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import {
  DOC_EXTENSIONS,
  IMAGE_EXTENSIONS,
  extractFilesFromDataTransfer,
  getExtension,
} from "../../services/api";

interface SplitPortalProps {
  onSelectPhotos: (files: File[], folderName?: string | null, hasFolder?: boolean) => void;
  onSelectDocs: (files: File[], folderName?: string | null, hasFolder?: boolean) => void;
  photoCount: number;
  docCount: number;
}

export function SplitPortal({
  onSelectPhotos,
  onSelectDocs,
  photoCount,
  docCount,
}: SplitPortalProps) {
  const { setSection, photoMode, docMode, toggleModeFor, pushToast } = useTheme();
  const [hovered, setHovered] = useState<"photos" | "docs" | null>(null);
  const [dragSide, setDragSide] = useState<"photos" | "docs" | null>(null);

  const photoFileRef = useRef<HTMLInputElement>(null);
  const photoFolderRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  const handleDropOnSide = async (side: "photos" | "docs", e: React.DragEvent) => {
    e.preventDefault();
    setDragSide(null);

    const { files, folderName, hasFolder } = await extractFilesFromDataTransfer(e.dataTransfer);
    if (!files.length) return;

    const imgs = files.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
    const docs = files.filter((f) => DOC_EXTENSIONS.has(getExtension(f.name)));

    // Detecção inteligente zero-fricção: se soltou PDF/DOCX no lado de fotos, abre Documentos automaticamente!
    if (side === "photos") {
      if (imgs.length > 0) {
        onSelectPhotos(imgs, folderName, hasFolder);
      } else if (docs.length > 0) {
        pushToast("Documento detectado — abrindo o estúdio de Documentos automaticamente.", "info");
        onSelectDocs(docs, folderName, hasFolder);
      } else {
        pushToast("Nenhum arquivo compatível encontrado neste envio.", "warning");
      }
      return;
    }

    // Lado Documentos aceita documentos E imagens (para converter imagens -> PDF!)
    const validDocs = files.filter(
      (f) => DOC_EXTENSIONS.has(getExtension(f.name)) || ["png", "jpg", "jpeg", "webp"].includes(getExtension(f.name))
    );
    if (validDocs.length > 0) {
      onSelectDocs(validDocs, folderName, hasFolder);
    } else {
      pushToast("Nenhum documento compatível encontrado neste envio.", "warning");
    }
  };

  const photoFlex = dragSide === "photos" || hovered === "photos" ? 1.24 : hovered === "docs" || dragSide === "docs" ? 0.82 : 1;
  const docFlex = dragSide === "docs" || hovered === "docs" ? 1.24 : hovered === "photos" || dragSide === "photos" ? 0.82 : 1;

  return (
    <motion.section
      key="split-portal"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex min-h-[calc(100vh-84px)] max-w-7xl flex-col justify-center px-4 py-6 sm:px-6 lg:py-8"
    >
      {/* Headline enxuta e sem fricção */}
      <div className="mb-6 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
            <Sparkles className="h-3 w-3" />
            Sem conta · Sem créditos · Direto ao ponto
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
            Solte seus arquivos.{" "}
            <span className="italic text-[var(--accent-text)]">O Revela se transforma.</span>
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
          Escolha um dos estúdios ou arraste fotos e documentos diretamente abaixo — a tela inteira e a paleta se adaptam ao que você está trabalhando.
        </p>
      </div>

      {/* Portal Duplo 50/50 com expansão animada por spring */}
      <div className="flex flex-1 flex-col gap-5 lg:min-h-[520px] lg:flex-row">
        {/* ========== PAINEL ESQUERDO: FOTOS (BORDÔ + DOURADO + CREME) ========== */}
        <motion.div
          layout
          animate={{ flexGrow: photoFlex }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          onMouseEnter={() => setHovered("photos")}
          onMouseLeave={() => setHovered(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragSide("photos");
          }}
          onDragLeave={() => setDragSide((cur) => (cur === "photos" ? null : cur))}
          onDrop={(e) => handleDropOnSide("photos", e)}
          data-section="photos"
          data-mode={photoMode}
          className="revela-beam-wrap group relative flex min-h-[340px] flex-1 basis-0 flex-col rounded-[28px] p-[2px] transition-shadow duration-300"
          data-active={dragSide === "photos" ? "true" : "false"}
          style={{
            background:
              photoMode === "dark"
                ? "linear-gradient(145deg, rgba(188,146,0,0.45), rgba(96,1,29,0.55))"
                : "linear-gradient(145deg, rgba(96,1,29,0.3), rgba(188,146,0,0.38))",
            boxShadow: dragSide === "photos" ? "0 24px 60px -16px rgba(96,1,29,0.55)" : "var(--shadow-lg)",
          }}
        >
          <div
            className="revela-beam-inner relative flex h-full flex-col justify-between overflow-hidden rounded-[26px] p-6 sm:p-8"
            style={{
              background:
                photoMode === "dark"
                  ? "radial-gradient(95% 85% at 10% 0%, rgba(96,1,29,0.72), #16060B 72%)"
                  : "radial-gradient(95% 85% at 10% 0%, rgba(253,226,185,0.85), #FFF8EE 75%)",
              color: photoMode === "dark" ? "#FDE2B9" : "#2D0812",
            }}
          >
            {/* Topo do Card Fotos */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md"
                  style={{ background: "#60011D", color: "#FDE2B9", border: "1px solid rgba(188,146,0,0.55)" }}
                >
                  <ImageIcon className="h-5 w-5" />
                </span>
                <div>
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest opacity-75">
                    Estúdio 01 · {photoMode === "dark" ? "Câmara Escura" : "Ateliê Claro"}
                  </span>
                  <h2 className="font-display text-2xl font-bold sm:text-3xl">Fotos & Imagens</h2>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleModeFor("photos");
                }}
                title="Alternar tema de Fotos (Claro / Escuro)"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/20 bg-current/5 transition-transform hover:scale-105 cursor-pointer"
              >
                {photoMode === "dark" ? <Sun className="h-4 w-4 text-[#E4BA2C]" /> : <Moon className="h-4 w-4 text-[#60011D]" />}
              </button>
            </div>

            {/* Centro Dropzone */}
            <div
              onClick={() => photoFileRef.current?.click()}
              className="my-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-all duration-300 cursor-pointer hover:scale-[1.01]"
              style={{
                borderColor: dragSide === "photos" ? "#BC9200" : photoMode === "dark" ? "rgba(253,226,185,0.28)" : "rgba(96,1,29,0.28)",
                background:
                  dragSide === "photos"
                    ? "rgba(188,146,0,0.14)"
                    : photoMode === "dark"
                    ? "rgba(253,226,185,0.04)"
                    : "rgba(96,1,29,0.035)",
              }}
            >
              <motion.div
                animate={{ y: dragSide === "photos" ? -6 : [0, -5, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: photoMode === "dark" ? "rgba(188,146,0,0.16)" : "rgba(96,1,29,0.1)",
                  color: photoMode === "dark" ? "#E4BA2C" : "#60011D",
                }}
              >
                <Upload className="h-6 w-6" />
              </motion.div>
              <p className="text-base font-bold">
                {dragSide === "photos" ? "Solte suas fotos agora" : "Solte fotos ou pastas aqui"}
              </p>
              <p className="mt-1 text-xs opacity-75">
                PNG, JPG, WEBP, AVIF, GIF, TIFF, BMP · Até 300 MB em lote
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    photoFileRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-transform hover:scale-105 cursor-pointer"
                  style={{ background: "#60011D", color: "#FDE2B9" }}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Escolher fotos
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    photoFolderRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-current/25 px-3.5 py-2 text-xs font-semibold hover:bg-current/10 cursor-pointer"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Pasta inteira
                </button>
              </div>
            </div>

            {/* Rodapé do Card Fotos */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1 rounded-full border border-current/15 bg-current/5 px-2.5 py-1">
                  <Scissors className="h-3 w-3 text-[#BC9200]" />
                  Remover fundo v2
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-current/15 bg-current/5 px-2.5 py-1">
                  <Layers className="h-3 w-3 text-[#BC9200]" />
                  Redimensionar & Renomear
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSection("photos")}
                className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline cursor-pointer"
                style={{ color: photoMode === "dark" ? "#E4BA2C" : "#60011D" }}
              >
                {photoCount > 0 ? `Continuar (${photoCount} fotos)` : "Abrir estúdio"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ========== PAINEL DIREITO: DOCUMENTOS (PETRÓLEO #0B3B46 + DOURADO + CREME) ========== */}
        <motion.div
          layout
          animate={{ flexGrow: docFlex }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          onMouseEnter={() => setHovered("docs")}
          onMouseLeave={() => setHovered(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragSide("docs");
          }}
          onDragLeave={() => setDragSide((cur) => (cur === "docs" ? null : cur))}
          onDrop={(e) => handleDropOnSide("docs", e)}
          data-section="docs"
          data-mode={docMode}
          className="revela-beam-wrap group relative flex min-h-[340px] flex-1 basis-0 flex-col rounded-[28px] p-[2px] transition-shadow duration-300"
          data-active={dragSide === "docs" ? "true" : "false"}
          style={{
            background:
              docMode === "dark"
                ? "linear-gradient(145deg, rgba(188,146,0,0.45), rgba(11,59,70,0.65))"
                : "linear-gradient(145deg, rgba(11,59,70,0.35), rgba(188,146,0,0.38))",
            boxShadow: dragSide === "docs" ? "0 24px 60px -16px rgba(11,59,70,0.55)" : "var(--shadow-lg)",
          }}
        >
          <div
            className="revela-beam-inner relative flex h-full flex-col justify-between overflow-hidden rounded-[26px] p-6 sm:p-8"
            style={{
              background:
                docMode === "dark"
                  ? "radial-gradient(95% 85% at 90% 0%, rgba(11,59,70,0.78), #061519 72%)"
                  : "radial-gradient(95% 85% at 90% 0%, rgba(227,239,239,0.95), #F8FBFB 75%)",
              color: docMode === "dark" ? "#FDE2B9" : "#07232A",
            }}
          >
            {/* Topo do Card Documentos */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md"
                  style={{ background: "#0B3B46", color: "#FDE2B9", border: "1px solid rgba(188,146,0,0.55)" }}
                >
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-widest opacity-75">
                    Estúdio 02 · {docMode === "dark" ? "Estúdio Noturno" : "Papelaria Clara"}
                  </span>
                  <h2 className="font-display text-2xl font-bold sm:text-3xl">Documentos & PDFs</h2>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleModeFor("docs");
                }}
                title="Alternar tema de Documentos (Claro / Escuro)"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/20 bg-current/5 transition-transform hover:scale-105 cursor-pointer"
              >
                {docMode === "dark" ? <Sun className="h-4 w-4 text-[#E4BA2C]" /> : <Moon className="h-4 w-4 text-[#0B3B46]" />}
              </button>
            </div>

            {/* Centro Dropzone Documentos */}
            <div
              onClick={() => docFileRef.current?.click()}
              className="my-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-all duration-300 cursor-pointer hover:scale-[1.01]"
              style={{
                borderColor: dragSide === "docs" ? "#BC9200" : docMode === "dark" ? "rgba(253,226,185,0.28)" : "rgba(11,59,70,0.28)",
                background:
                  dragSide === "docs"
                    ? "rgba(188,146,0,0.14)"
                    : docMode === "dark"
                    ? "rgba(253,226,185,0.04)"
                    : "rgba(11,59,70,0.04)",
              }}
            >
              <motion.div
                animate={{ y: dragSide === "docs" ? -6 : [0, -5, 0] }}
                transition={{ duration: 2.8, delay: 0.4, repeat: Infinity, ease: "easeInOut" }}
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: docMode === "dark" ? "rgba(188,146,0,0.16)" : "rgba(11,59,70,0.1)",
                  color: docMode === "dark" ? "#E4BA2C" : "#0B3B46",
                }}
              >
                <FileText className="h-6 w-6" />
              </motion.div>
              <p className="text-base font-bold">
                {dragSide === "docs" ? "Solte seus documentos agora" : "Solte PDFs, Word, planilhas ou texto"}
              </p>
              <p className="mt-1 text-xs opacity-75">
                PDF, DOCX, XLSX, CSV, JSON, Markdown, HTML, TXT e Fotos → PDF
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    docFileRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-transform hover:scale-105 cursor-pointer"
                  style={{ background: "#0B3B46", color: "#FDE2B9" }}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Escolher documentos
                </button>
              </div>
            </div>

            {/* Rodapé do Card Documentos */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1 rounded-full border border-current/15 bg-current/5 px-2.5 py-1">
                  <FileText className="h-3 w-3 text-[#BC9200]" />
                  Juntar / Dividir PDF
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-current/15 bg-current/5 px-2.5 py-1">
                  <FileSpreadsheet className="h-3 w-3 text-[#BC9200]" />
                  XLSX ↔ CSV ↔ JSON
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSection("docs")}
                className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline cursor-pointer"
                style={{ color: docMode === "dark" ? "#E4BA2C" : "#0B3B46" }}
              >
                {docCount > 0 ? `Continuar (${docCount} docs)` : "Abrir estúdio"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Inputs Ocultos */}
      <input
        ref={photoFileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) onSelectPhotos(list, "fotos_selecionadas", false);
          e.target.value = "";
        }}
      />
      <input
        ref={photoFolderRef}
        type="file"
        // @ts-expect-error webkitdirectory é padrão Chromium
        webkitdirectory=""
        directory=""
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) {
            const folder = (list[0].webkitRelativePath || list[0].name).split("/")[0];
            onSelectPhotos(list, folder, true);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={docFileRef}
        type="file"
        accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm,.xlsx,.csv,.json,image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) onSelectDocs(list, "documentos", false);
          e.target.value = "";
        }}
      />
    </motion.section>
  );
}
