import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useSection } from "../../state/section";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import { useToast } from "../../state/toasts";
import { getExtension, readDroppedItems } from "../../lib/files";
import { DOC_ACCEPTED_EXTENSIONS, DOC_ONLY_EXTENSIONS, IMAGE_EXTENSIONS } from "../../lib/formats";
import { Button } from "../../components/ui/Button";

export function Portal() {
  const { navigate, setPortalHover, portalDrag, setPortalDrag } = useSection();
  const { items: images, addFiles: addImages } = useImages();
  const { items: docs, addFiles: addDocs } = useDocuments();
  const { notify } = useToast();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFiles = async (
    files: File[],
    folderName?: string | null,
    hasFolder?: boolean
  ) => {
    await addImages(files, folderName, hasFolder);
    navigate("photos");
  };

  const handleDocFiles = async (
    files: File[],
    folderName?: string | null,
    hasFolder?: boolean
  ) => {
    await addDocs(files, folderName, hasFolder);
    navigate("docs");
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
        notify("Formato de arquivo não suportado.", "err");
      }
      return;
    }

    if (docCompat.length > 0) {
      await handleDocFiles(docCompat, folderName, hasFolder);
    } else {
      notify("Formato de arquivo não suportado.", "err");
    }
  };

  const photoCountLabel =
    images.length === 1 ? "Continuar com 1 foto" : `Continuar com ${images.length} fotos`;
  const docCountLabel =
    docs.length === 1 ? "Continuar com 1 documento" : `Continuar com ${docs.length} documentos`;

  const waterTextShadow = "0 2px 14px rgba(0, 0, 0, 0.55)";

  return (
    <motion.section
      initial={{ opacity: 0.94, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0.94, transition: { duration: 0.08 } }}
      transition={{
        y: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.12, ease: "easeOut" },
      }}
      className="relative mx-auto flex min-h-[calc(100vh-76px)] max-w-6xl flex-col justify-center gap-6 px-4 py-4 sm:px-8 lg:gap-8 lg:py-6"
    >
      {/* Título "Revela" grande, sem caixa, em serifada, com sombra suave escura em ambos os lados */}
      <div className="relative z-20 mx-auto flex flex-col items-center text-center">
        <h1
          className="select-none font-display text-6xl font-bold tracking-tight sm:text-7xl lg:text-8xl leading-none"
          style={{ textShadow: waterTextShadow }}
        >
          <span className="text-[#FDE2B9]" style={{ textShadow: waterTextShadow }}>
            Re
          </span>
          <span className="text-[#BC9200]" style={{ textShadow: waterTextShadow }}>
            vela
          </span>
        </h1>
        <p
          className="mt-2 text-sm font-medium text-[#FDE2B9]"
          style={{ textShadow: waterTextShadow }}
        >
          Solte arquivos em qualquer lado.
        </p>
      </div>

      {/* Dois painéis alinhados lado a lado na mesma altura */}
      <div className="relative z-10 grid w-full grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Painel Esquerdo: Fotos */}
        <div
          onMouseEnter={() => setPortalHover("photos")}
          onMouseLeave={() => setPortalHover(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (portalDrag !== "photos") setPortalDrag("photos");
          }}
          onDragLeave={() => setPortalDrag(null)}
          onDrop={(e) => onDropHalf("photos", e)}
          className={`flex flex-col justify-between rounded-[6px] border border-[#BC9200] border-l-4 border-l-[#60011D] bg-[#FDE2B9] p-6 text-[#60011D] transition-transform duration-200 sm:p-8 ${
            portalDrag === "photos" ? "-translate-y-1" : ""
          }`}
        >
          <div>
            <h2 className="font-display text-3xl font-semibold text-[#60011D] sm:text-4xl">
              {portalDrag === "photos" ? "Solte para adicionar" : "Fotos"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3B0011]">
              Converta e redimensione centenas de fotos de uma vez.
            </p>

            {/* Ações em linhas com seta à direita */}
            <div className="my-5 divide-y divide-[#60011D]/20 border-y border-[#60011D]/20">
              <button
                type="button"
                onClick={() => navigate("photos", "converter")}
                className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold text-[#60011D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
              >
                <span>Converter formato</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("photos", "redimensionar")}
                className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold text-[#60011D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
              >
                <span>Redimensionar</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("photos", "recorte")}
                className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold text-[#60011D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
              >
                <span>Remover fundo</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div>
            {/* Formatos em texto corrido sem serifa logo acima do botão */}
            <p className="mb-3 font-sans text-[13px] font-medium text-[#3B0011]">
              Formatos: PNG, JPG, WEBP, AVIF, GIF, TIFF
            </p>

            {/* Botão em Bordô com texto em Creme */}
            <Button
              size="lg"
              onClick={() =>
                images.length > 0 ? navigate("photos") : photoInputRef.current?.click()
              }
              className="w-full bg-[#60011D] text-[#FDE2B9]"
            >
              {images.length > 0 ? photoCountLabel : "Escolher fotos"}
            </Button>
          </div>
        </div>

        {/* Painel Direito: Documentos (alinhado lado a lado na mesma altura) */}
        <div
          onMouseEnter={() => setPortalHover("docs")}
          onMouseLeave={() => setPortalHover(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (portalDrag !== "docs") setPortalDrag("docs");
          }}
          onDragLeave={() => setPortalDrag(null)}
          onDrop={(e) => onDropHalf("docs", e)}
          className={`flex flex-col justify-between rounded-[6px] border border-[#BC9200] border-l-4 border-l-[#0B3B46] bg-[#FDE2B9] p-6 text-[#0B3B46] transition-transform duration-200 sm:p-8 ${
            portalDrag === "docs" ? "-translate-y-1" : ""
          }`}
        >
          <div>
            <h2 className="font-display text-3xl font-semibold text-[#0B3B46] sm:text-4xl">
              {portalDrag === "docs" ? "Solte para adicionar" : "Documentos"}
            </h2>

            {/* Formatos em texto corrido sem serifa logo abaixo do título */}
            <p className="mt-2 font-sans text-[13px] font-medium text-[#06252C]">
              PDF, DOCX, XLSX, CSV, JSON, MD, HTML, TXT
            </p>

            {/* Ações em linhas com uma frase curta de descrição abaixo de cada uma */}
            <div className="my-5 divide-y divide-[#0B3B46]/20 border-y border-[#0B3B46]/20">
              <button
                type="button"
                onClick={() => navigate("docs", "unificar")}
                className="block w-full py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] group cursor-pointer"
              >
                <span className="block text-sm font-semibold text-[#0B3B46] underline-offset-4 group-hover:underline">
                  Juntar em um único PDF
                </span>
                <span className="mt-0.5 block text-[13px] text-[#06252C]">
                  Unifique vários arquivos e defina a ordem das páginas.
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("docs", "pdf")}
                className="block w-full py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] group cursor-pointer"
              >
                <span className="block text-sm font-semibold text-[#0B3B46] underline-offset-4 group-hover:underline">
                  Converter ou dividir páginas
                </span>
                <span className="mt-0.5 block text-[13px] text-[#06252C]">
                  Transforme entre PDF, Word, texto ou separe páginas.
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate("docs", "planilhas")}
                className="block w-full py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] group cursor-pointer"
              >
                <span className="block text-sm font-semibold text-[#0B3B46] underline-offset-4 group-hover:underline">
                  Converter planilhas e dados
                </span>
                <span className="mt-0.5 block text-[13px] text-[#06252C]">
                  Passe tabelas entre XLSX, CSV e JSON mantendo as colunas.
                </span>
              </button>
            </div>
          </div>

          {/* Botão com largura total, em Petróleo com texto em Creme */}
          <Button
            size="lg"
            onClick={() =>
              docs.length > 0 ? navigate("docs") : docInputRef.current?.click()
            }
            className="w-full bg-[#0B3B46] text-[#FDE2B9]"
          >
            {docs.length > 0 ? docCountLabel : "Escolher documentos"}
          </Button>
        </div>
      </div>

      <div />

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
