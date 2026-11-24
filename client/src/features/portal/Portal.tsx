import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, FolderOpen, Upload } from "lucide-react";
import { useSection } from "../../state/section";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import { useToast } from "../../state/toasts";
import { getExtension, readDroppedItems } from "../../lib/files";
import { DOC_ACCEPTED_EXTENSIONS, DOC_ONLY_EXTENSIONS, IMAGE_EXTENSIONS } from "../../lib/formats";

interface PortalProps {
  titleAnchorRef: React.RefObject<HTMLHeadingElement | null>;
}

export function Portal({ titleAnchorRef }: PortalProps) {
  const { setSection, portalHover, setPortalHover, portalDrag, setPortalDrag } = useSection();
  const { items: images, addFiles: addImages } = useImages();
  const { items: docs, addFiles: addDocs } = useDocuments();
  const { notify } = useToast();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFiles = async (files: File[], folderName?: string | null, hasFolder?: boolean) => {
    const added = await addImages(files, folderName, hasFolder);
    if (added > 0) {
      setSection("photos");
      notify(`${added} ${added === 1 ? "imagem adicionada" : "imagens adicionadas"}.`, "ok");
    } else {
      setSection("photos");
    }
  };

  const handleDocFiles = async (files: File[], folderName?: string | null, hasFolder?: boolean) => {
    const added = await addDocs(files, folderName, hasFolder);
    if (added > 0) {
      setSection("docs");
      notify(`${added} ${added === 1 ? "documento adicionado" : "documentos adicionados"}.`, "ok");
    } else {
      setSection("docs");
    }
  };

  const onDropSide = async (side: "photos" | "docs", e: React.DragEvent) => {
    e.preventDefault();
    setPortalDrag(null);

    const { files, folderName, hasFolder } = await readDroppedItems(e.dataTransfer);
    if (!files.length) return;

    const imgFiles = files.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
    const docOnlyFiles = files.filter((f) => DOC_ONLY_EXTENSIONS.has(getExtension(f.name)));
    const docCompatible = files.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));

    if (side === "photos") {
      if (imgFiles.length > 0) {
        await handlePhotoFiles(imgFiles, folderName, hasFolder);
      } else if (docOnlyFiles.length > 0) {
        notify("Arquivo de documento identificado. Abrindo Documentos.", "neutral");
        await handleDocFiles(docOnlyFiles, folderName, hasFolder);
      } else {
        notify("Formato de arquivo não reconhecido.", "warn");
      }
      return;
    }

    if (docCompatible.length > 0) {
      await handleDocFiles(docCompatible, folderName, hasFolder);
    } else {
      notify("Formato de documento não reconhecido.", "warn");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      className="relative flex min-h-[calc(100vh-57px)] flex-col justify-between px-4 py-8 sm:px-8 lg:py-12"
    >
      {/* Cabeçalho central onde o título "Revela" atravessa o encontro das duas águas */}
      <div className="pointer-events-none mx-auto flex w-full max-w-5xl flex-col items-center text-center pt-2 sm:pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#FDE2B9]/75">
          Conversão e lote
        </span>

        {/* O WebGL pinta a palavra "Revela" exatamente nesta coordenada,
            cortando cada letra com a cor da água oposta. */}
        <h1
          ref={titleAnchorRef}
          className="mt-1 select-none font-display text-6xl font-semibold tracking-tight text-transparent sm:text-7xl lg:text-[6.75rem] leading-none px-4 py-2"
        >
          Revela
        </h1>

        <p className="mt-2 max-w-md text-xs sm:text-sm text-[#FDE2B9]/80">
          Duas frentes de trabalho. Arraste arquivos para qualquer margem ou escolha uma seção para expandir.
        </p>
      </div>

      {/* Duas margens divididas pelo estuário central */}
      <div className="mx-auto my-auto grid w-full max-w-7xl grid-cols-1 gap-10 py-8 lg:grid-cols-[1fr_140px_1fr] lg:items-stretch lg:gap-0">
        {/* Margem Esquerda: 01 / Fotos (sobre água Bordô #60011D) */}
        <div
          onMouseEnter={() => setPortalHover("photos")}
          onMouseLeave={() => setPortalHover(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (portalDrag !== "photos") setPortalDrag("photos");
          }}
          onDragLeave={() => setPortalDrag(null)}
          onDrop={(e) => onDropSide("photos", e)}
          className={`group flex flex-col justify-between rounded-[6px] border p-6 sm:p-8 transition-colors duration-200 ${
            portalDrag === "photos"
              ? "border-[#BC9200] bg-[#1C030A]/70"
              : portalHover === "photos"
              ? "border-[#FDE2B9]/35 bg-[#1C030A]/50"
              : "border-[#FDE2B9]/18 bg-[#1C030A]/35"
          }`}
        >
          <div>
            <div className="flex items-baseline justify-between border-b border-[#FDE2B9]/15 pb-3">
              <span className="font-mono text-xs tracking-[0.14em] text-[#9EDEE5]">
                01 / FOTOS
              </span>
              <span className="font-mono text-[11px] text-[#FDE2B9]/65">
                PNG · JPEG · WEBP · AVIF · TIFF · GIF
              </span>
            </div>

            <h2 className="mt-5 font-display text-3xl font-medium text-[#FDE2B9] sm:text-4xl">
              Imagens em massa
            </h2>
            <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-[#D8BC98]">
              Redimensionamento proporcional ou exato, conversão de formato, renomeação sequencial e recorte de fundo com ajuste manual em tela.
            </p>
          </div>

          <div
            onClick={() => photoInputRef.current?.click()}
            className="my-7 flex flex-col items-start justify-center rounded-[4px] border border-dashed border-[#FDE2B9]/25 bg-[#1C030A]/40 px-5 py-7 transition-colors hover:border-[#BC9200] cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium text-[#FDE2B9]">
              <Upload className="h-4 w-4 text-[#BC9200]" strokeWidth={1.5} />
              <span>
                {portalDrag === "photos"
                  ? "Solte as imagens para abrir Fotos"
                  : "Solte imagens ou clique para selecionar"}
              </span>
            </div>
            <span className="mt-1.5 font-mono text-[11px] text-[#D8BC98]/75">
              Aceita arquivos avulsos ou pastas completas
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="h-9 rounded-[4px] bg-[#FDE2B9] px-4 text-xs font-semibold text-[#60011D] transition-colors hover:bg-white cursor-pointer"
              >
                Selecionar fotos
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#FDE2B9]/28 px-3.5 text-xs font-medium text-[#FDE2B9] transition-colors hover:border-[#BC9200] hover:bg-[#FDE2B9]/10 cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                Pasta
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSection("photos")}
              className="inline-flex items-center gap-1 font-mono text-xs text-[#9EDEE5] hover:underline cursor-pointer"
            >
              <span>{images.length > 0 ? `Abrir fila (${images.length})` : "Entrar em Fotos"}</span>
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Canal central livre para a mistura das águas do estuário */}
        <div className="pointer-events-none hidden lg:flex flex-col items-center justify-center">
          <div className="h-full w-[1px] bg-gradient-to-b from-transparent via-[#BC9200]/35 to-transparent" />
        </div>

        {/* Margem Direita: 02 / Documentos (sobre água Petróleo #0B3B46) */}
        <div
          onMouseEnter={() => setPortalHover("docs")}
          onMouseLeave={() => setPortalHover(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (portalDrag !== "docs") setPortalDrag("docs");
          }}
          onDragLeave={() => setPortalDrag(null)}
          onDrop={(e) => onDropSide("docs", e)}
          className={`group flex flex-col justify-between rounded-[6px] border p-6 sm:p-8 transition-colors duration-200 ${
            portalDrag === "docs"
              ? "border-[#BC9200] bg-[#031519]/75"
              : portalHover === "docs"
              ? "border-[#FDE2B9]/35 bg-[#031519]/55"
              : "border-[#FDE2B9]/18 bg-[#031519]/38"
          }`}
        >
          <div>
            <div className="flex items-baseline justify-between border-b border-[#FDE2B9]/15 pb-3">
              <span className="font-mono text-xs tracking-[0.14em] text-[#F4BFC2]">
                02 / DOCUMENTOS
              </span>
              <span className="font-mono text-[11px] text-[#FDE2B9]/65">
                PDF · DOCX · XLSX · CSV · JSON · MD · HTML
              </span>
            </div>

            <h2 className="mt-5 font-display text-3xl font-medium text-[#FDE2B9] sm:text-4xl">
              Arquivos e cadernos
            </h2>
            <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-[#D4C9AE]">
              Conversão entre documentos, planilhas e texto, extração ou divisão de páginas, e unificação de múltiplos arquivos em um único PDF.
            </p>
          </div>

          <div
            onClick={() => docInputRef.current?.click()}
            className="my-7 flex flex-col items-start justify-center rounded-[4px] border border-dashed border-[#FDE2B9]/25 bg-[#031519]/45 px-5 py-7 transition-colors hover:border-[#BC9200] cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium text-[#FDE2B9]">
              <Upload className="h-4 w-4 text-[#BC9200]" strokeWidth={1.5} />
              <span>
                {portalDrag === "docs"
                  ? "Solte os documentos para abrir Documentos"
                  : "Solte PDFs, textos, planilhas ou imagens"}
              </span>
            </div>
            <span className="mt-1.5 font-mono text-[11px] text-[#D4C9AE]/75">
              Converta individualmente ou unifique a fila em um PDF
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="h-9 rounded-[4px] bg-[#FDE2B9] px-4 text-xs font-semibold text-[#0B3B46] transition-colors hover:bg-white cursor-pointer"
            >
              Selecionar documentos
            </button>

            <button
              type="button"
              onClick={() => setSection("docs")}
              className="inline-flex items-center gap-1 font-mono text-xs text-[#F4BFC2] hover:underline cursor-pointer"
            >
              <span>{docs.length > 0 ? `Abrir fila (${docs.length})` : "Entrar em Documentos"}</span>
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Rodapé discreto */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between border-t border-[#FDE2B9]/12 pt-4 font-mono text-[11px] text-[#FDE2B9]/55">
        <span>01 Bordô #60011D · Fotos</span>
        <span className="hidden sm:inline">Correnteza #BC9200 · #FDE2B9</span>
        <span>02 Petróleo #0B3B46 · Documentos</span>
      </div>

      {/* Inputs de arquivo ocultos */}
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
        // @ts-expect-error atributo Chromium para diretório
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
