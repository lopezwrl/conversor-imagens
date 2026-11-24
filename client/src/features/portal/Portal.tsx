import React, { useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Combine,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Maximize,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useSection } from "../../state/section";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import { useToast } from "../../state/toasts";
import { getExtension, readDroppedItems } from "../../lib/files";
import { DOC_ACCEPTED_EXTENSIONS, DOC_ONLY_EXTENSIONS, IMAGE_EXTENSIONS } from "../../lib/formats";

export function Portal() {
  const { navigate, portalHover, setPortalHover, portalDrag, setPortalDrag } = useSection();
  const { items: images, addFiles: addImages } = useImages();
  const { items: docs, addFiles: addDocs } = useDocuments();
  const { notify } = useToast();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFiles = async (
    files: File[],
    folderName?: string | null,
    hasFolder?: boolean,
    action: string | null = null
  ) => {
    const added = await addImages(files, folderName, hasFolder);
    navigate("photos", action);
    if (added > 0) {
      notify(`${added} ${added === 1 ? "foto pronta" : "fotos prontas"} na bancada.`, "ok");
    }
  };

  const handleDocFiles = async (
    files: File[],
    folderName?: string | null,
    hasFolder?: boolean,
    action: string | null = null
  ) => {
    const added = await addDocs(files, folderName, hasFolder);
    navigate("docs", action);
    if (added > 0) {
      notify(`${added} ${added === 1 ? "documento pronto" : "documentos prontos"} na mesa.`, "ok");
    }
  };

  const onDropHalf = async (side: "photos" | "docs", e: React.DragEvent) => {
    e.preventDefault();
    setPortalDrag(null);
    const { files, folderName, hasFolder } = await readDroppedItems(e.dataTransfer);
    if (!files.length) return;

    const imgFiles = files.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
    const docOnly = files.filter((f) => DOC_ONLY_EXTENSIONS.has(getExtension(f.name)));
    const docCompat = files.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));

    if (side === "photos") {
      if (imgFiles.length > 0) {
        await handlePhotoFiles(imgFiles, folderName, hasFolder);
      } else if (docOnly.length > 0) {
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
      className="relative flex min-h-[calc(100vh-76px)] flex-col justify-between px-4 py-4 sm:px-8 lg:py-6"
    >
      {/* Emblema Central Bicolor:
          Metade esquerda Petróleo (#0B3B46) sobre o rio Bordô,
          Metade direita Bordô (#60011D) sobre o rio Petróleo,
          Unidas pelo Creme (#FDE2B9) e Dourado (#BC9200). */}
      <div className="relative z-20 mx-auto flex flex-col items-center text-center">
        <div className="relative inline-flex items-center overflow-hidden rounded-2xl border-2 border-[#BC9200] shadow-2xl">
          <div className="bg-[#0B3B46] px-6 py-2.5 sm:px-8 sm:py-3">
            <span className="font-display text-4xl font-bold tracking-tight text-[#FDE2B9] sm:text-5xl lg:text-6xl">
              Re
            </span>
          </div>
          <div className="w-[3px] self-stretch bg-[#BC9200]" />
          <div className="bg-[#60011D] px-6 py-2.5 sm:px-8 sm:py-3">
            <span className="font-display text-4xl font-bold tracking-tight text-[#FDE2B9] sm:text-5xl lg:text-6xl">
              vela
            </span>
          </div>
        </div>
        <p className="mt-2.5 rounded-full border border-[#BC9200] bg-[#FDE2B9] px-4 py-1 font-mono text-xs font-bold text-[#60011D] shadow-md">
          Escolha uma rota ou solte seus arquivos em qualquer margem do rio
        </p>
      </div>

      {/* Duas Margens de Alto Contraste: Fichas Creme (#FDE2B9) sobre o Rio Vivo */}
      <div className="relative z-10 mx-auto my-auto grid w-full max-w-7xl grid-cols-1 gap-6 py-6 lg:grid-cols-[1fr_90px_1fr] lg:items-stretch">
        {/* ========== LADO ESQUERDO: FOTOS (Ficha Creme + Bordô #60011D + Acentos Petróleo/Ouro) ========== */}
        <motion.div
          whileHover={{ y: -4 }}
          onMouseEnter={() => setPortalHover("photos")}
          onMouseLeave={() => setPortalHover(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (portalDrag !== "photos") setPortalDrag("photos");
          }}
          onDragLeave={() => setPortalDrag(null)}
          onDrop={(e) => onDropHalf("photos", e)}
          className={`flex flex-col justify-between rounded-2xl border-2 bg-[#FDE2B9] p-6 text-[#60011D] shadow-2xl transition-all sm:p-7 ${
            portalDrag === "photos"
              ? "border-[#0B3B46] ring-4 ring-[#BC9200]"
              : portalHover === "photos"
              ? "border-[#BC9200]"
              : "border-[#BC9200]/80"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 border-b-2 border-[#60011D]/15 pb-3">
              <span className="rounded-md bg-[#60011D] px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#FDE2B9]">
                01 · Fotos
              </span>
              <span className="rounded-md bg-[#0B3B46] px-2.5 py-1 font-mono text-[11px] font-bold text-[#FDE2B9]">
                PNG · JPG · WEBP · AVIF
              </span>
            </div>

            <h2 className="mt-4 font-display text-3xl font-bold text-[#60011D] sm:text-4xl">
              Transformar Imagens
            </h2>
            <p className="mt-1.5 text-sm font-medium text-[#60011D]/85">
              Clique em uma função para ir direto à ferramenta ou solte suas fotos aqui:
            </p>

            {/* Rotas funcionais diretas (clicou -> abre já na função!) */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate("photos", "converter")}
                className="flex flex-col items-start rounded-xl border-2 border-[#60011D] bg-[#FFF3DE] p-3 text-left transition-all hover:bg-[#60011D] hover:text-[#FDE2B9] cursor-pointer group"
              >
                <Sparkles className="h-4 w-4 text-[#BC9200]" />
                <span className="mt-1.5 text-xs font-bold">Converter Formato</span>
                <span className="font-mono text-[10px] opacity-75">WEBP, PNG, JPG, AVIF</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("photos", "redimensionar")}
                className="flex flex-col items-start rounded-xl border-2 border-[#60011D] bg-[#FFF3DE] p-3 text-left transition-all hover:bg-[#60011D] hover:text-[#FDE2B9] cursor-pointer group"
              >
                <Maximize className="h-4 w-4 text-[#BC9200]" />
                <span className="mt-1.5 text-xs font-bold">Redimensionar</span>
                <span className="font-mono text-[10px] opacity-75">Catálogo, 50%, Exato</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("photos", "recorte")}
                className="flex flex-col items-start rounded-xl border-2 border-[#0B3B46] bg-[#0B3B46] p-3 text-left text-[#FDE2B9] transition-all hover:brightness-115 cursor-pointer"
              >
                <Scissors className="h-4 w-4 text-[#BC9200]" />
                <span className="mt-1.5 text-xs font-bold">Remover Fundo</span>
                <span className="font-mono text-[10px] text-[#FDE2B9]/80">Automático e Pincel</span>
              </button>
            </div>
          </div>

          {/* Botões de Entrada Rápida */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t-2 border-[#60011D]/15 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-[#BC9200] bg-[#60011D] px-5 text-xs font-bold uppercase tracking-wider text-[#FDE2B9] shadow-md hover:bg-[#7a0327] cursor-pointer"
              >
                <ImageIcon className="h-4 w-4 text-[#BC9200]" />
                Escolher Fotos
              </button>

              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-[#60011D] bg-[#FFF3DE] px-4 text-xs font-bold text-[#60011D] hover:border-[#BC9200] cursor-pointer"
              >
                <FolderOpen className="h-4 w-4 text-[#60011D]" />
                Pasta
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate("photos")}
              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#0B3B46] hover:underline cursor-pointer"
            >
              <span>{images.length > 0 ? `Ver ${images.length} foto(s)` : "Entrar"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>

        {/* Canal central livre onde os rios Bordô, Petróleo e Ouro se encontram */}
        <div className="pointer-events-none hidden lg:flex flex-col items-center justify-center">
          <span className="rounded-full border-2 border-[#BC9200] bg-[#FDE2B9] px-2.5 py-1 font-mono text-[10px] font-bold text-[#60011D] shadow-lg">
            RIO
          </span>
        </div>

        {/* ========== LADO DIREITO: DOCUMENTOS (Ficha Creme + Petróleo #0B3B46 + Acentos Bordô/Ouro) ========== */}
        <motion.div
          whileHover={{ y: -4 }}
          onMouseEnter={() => setPortalHover("docs")}
          onMouseLeave={() => setPortalHover(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (portalDrag !== "docs") setPortalDrag("docs");
          }}
          onDragLeave={() => setPortalDrag(null)}
          onDrop={(e) => onDropHalf("docs", e)}
          className={`flex flex-col justify-between rounded-2xl border-2 bg-[#FDE2B9] p-6 text-[#0B3B46] shadow-2xl transition-all sm:p-7 ${
            portalDrag === "docs"
              ? "border-[#60011D] ring-4 ring-[#BC9200]"
              : portalHover === "docs"
              ? "border-[#BC9200]"
              : "border-[#BC9200]/80"
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 border-b-2 border-[#0B3B46]/15 pb-3">
              <span className="rounded-md bg-[#0B3B46] px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#FDE2B9]">
                02 · Documentos
              </span>
              <span className="rounded-md bg-[#60011D] px-2.5 py-1 font-mono text-[11px] font-bold text-[#FDE2B9]">
                PDF · DOCX · XLSX · CSV
              </span>
            </div>

            <h2 className="mt-4 font-display text-3xl font-bold text-[#0B3B46] sm:text-4xl">
              Transformar Documentos
            </h2>
            <p className="mt-1.5 text-sm font-medium text-[#0B3B46]/85">
              Clique em uma função para abrir a mesa de documentos ou solte arquivos aqui:
            </p>

            {/* Rotas funcionais diretas de Documentos */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate("docs", "pdf")}
                className="flex flex-col items-start rounded-xl border-2 border-[#0B3B46] bg-[#FFF3DE] p-3 text-left transition-all hover:bg-[#0B3B46] hover:text-[#FDE2B9] cursor-pointer"
              >
                <FileText className="h-4 w-4 text-[#BC9200]" />
                <span className="mt-1.5 text-xs font-bold">Gerar / Dividir PDF</span>
                <span className="font-mono text-[10px] opacity-75">Word, Texto, Fotos</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("docs", "unificar")}
                className="flex flex-col items-start rounded-xl border-2 border-[#60011D] bg-[#60011D] p-3 text-left text-[#FDE2B9] transition-all hover:brightness-115 cursor-pointer"
              >
                <Combine className="h-4 w-4 text-[#BC9200]" />
                <span className="mt-1.5 text-xs font-bold">Juntar em 1 PDF</span>
                <span className="font-mono text-[10px] text-[#FDE2B9]/80">Unificar vários arquivos</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("docs", "planilhas")}
                className="flex flex-col items-start rounded-xl border-2 border-[#0B3B46] bg-[#FFF3DE] p-3 text-left transition-all hover:bg-[#0B3B46] hover:text-[#FDE2B9] cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#BC9200]" />
                <span className="mt-1.5 text-xs font-bold">Planilhas & Dados</span>
                <span className="font-mono text-[10px] opacity-75">XLSX, CSV e JSON</span>
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t-2 border-[#0B3B46]/15 pt-4">
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-[#BC9200] bg-[#0B3B46] px-5 text-xs font-bold uppercase tracking-wider text-[#FDE2B9] shadow-md hover:bg-[#0f4d5b] cursor-pointer"
            >
              <FileText className="h-4 w-4 text-[#BC9200]" />
              Escolher Documentos
            </button>

            <button
              type="button"
              onClick={() => navigate("docs")}
              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#60011D] hover:underline cursor-pointer"
            >
              <span>{docs.length > 0 ? `Ver ${docs.length} doc(s)` : "Entrar"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Legenda viva das 4 cores no rodapé */}
      <div className="relative z-10 mx-auto flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-[#BC9200] bg-[#60011D] px-3 py-1 font-mono text-[11px] font-bold text-[#FDE2B9]">
          Bordô #60011D
        </span>
        <span className="rounded-full border border-[#60011D] bg-[#FDE2B9] px-3 py-1 font-mono text-[11px] font-bold text-[#60011D]">
          Creme #FDE2B9
        </span>
        <span className="rounded-full border border-[#FDE2B9] bg-[#BC9200] px-3 py-1 font-mono text-[11px] font-bold text-[#FFF3DE]">
          Dourado #BC9200
        </span>
        <span className="rounded-full border border-[#BC9200] bg-[#0B3B46] px-3 py-1 font-mono text-[11px] font-bold text-[#FDE2B9]">
          Petróleo #0B3B46
        </span>
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
        // @ts-expect-error webkitdirectory
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
