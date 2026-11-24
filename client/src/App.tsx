import { useCallback, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { Header } from "./components/layout/Header";
import { SplitPortal } from "./components/layout/SplitPortal";
import { ImageWorkspace } from "./components/images/ImageWorkspace";
import { DocumentWorkspace } from "./components/documents/DocumentWorkspace";
import { ToastContainer } from "./components/ui/MotionPrimitives";
import type { DocItem, ImageItem } from "./types/revela";
import {
  DOC_ACCEPTED_EXTENSIONS,
  IMAGE_EXTENSIONS,
  generateFileHash,
  getBaseName,
  getDocTargetFormats,
  getExtension,
  normalizeImageFormat,
} from "./services/api";

function RevelaAppShell() {
  const { section, setSection, toasts, dismissToast, pushToast } = useTheme();

  // Estado global de Fotos (persiste ao trocar de aba!)
  const [images, setImages] = useState<ImageItem[]>([]);
  const [photoFolder, setPhotoFolder] = useState("revela");
  const [photoZip, setPhotoZip] = useState(true);

  // Estado global de Documentos (persiste ao trocar de aba!)
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docFolder, setDocFolder] = useState("documentos");
  const [docZip, setDocZip] = useState(true);

  const addPhotoFiles = useCallback(
    async (rawFiles: File[], folderName?: string | null, hasFolder?: boolean) => {
      const valid = rawFiles.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
      if (!valid.length) {
        pushToast("Nenhuma imagem válida encontrada.", "warning");
        return;
      }

      const existingHashes = new Set(images.map((i) => i.hash));
      const newItems: ImageItem[] = [];

      for (const file of valid) {
        const hash = await generateFileHash(file);
        if (existingHashes.has(hash)) continue;
        existingHashes.add(hash);

        let w = 0;
        let h = 0;
        try {
          const bmp = await createImageBitmap(file);
          w = bmp.width;
          h = bmp.height;
          bmp.close();
        } catch {
          // Alguns formatos (TIFF/BMP/SVG) podem não abrir em createImageBitmap, mas o sharp processa!
        }

        const formatoOrig = normalizeImageFormat(getExtension(file.name));
        newItems.push({
          id: `${hash.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
          hash,
          file,
          nome: file.name,
          nomeBase: getBaseName(file.name),
          larguraOriginal: w,
          alturaOriginal: h,
          tamanhoBytes: file.size,
          urlMiniatura: URL.createObjectURL(file),
          formatoOriginal: formatoOrig,
          formato: formatoOrig,
          largura: "",
          altura: "",
          qualidade: 90,
          manterProporcao: true,
          modoAjuste: "inside",
          removerFundo: false,
          modoRemocao: "automatico",
          sensibilidadeFundo: 50,
          corFundo: "#ffffff",
          nomePersonalizado: null,
        });
      }

      if (!newItems.length) {
        pushToast("Essas imagens já estavam na fila (duplicadas ignoradas).", "info");
        setSection("photos");
        return;
      }

      if (folderName) setPhotoFolder(folderName);
      if (hasFolder || images.length + newItems.length >= 3) setPhotoZip(true);

      setImages((prev) => [...prev, ...newItems]);
      // Transição cinematográfica: ao adicionar foto, Fotos assume tela inteira!
      setSection("photos");
      pushToast(`${newItems.length} foto(s) adicionada(s) ao estúdio!`, "success");
    },
    [images, pushToast, setSection]
  );

  const addDocFiles = useCallback(
    async (rawFiles: File[], folderName?: string | null, hasFolder?: boolean) => {
      const valid = rawFiles.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));
      if (!valid.length) {
        pushToast("Nenhum documento compatível encontrado.", "warning");
        return;
      }

      const existingHashes = new Set(docs.map((d) => d.hash));
      const newDocs: DocItem[] = [];

      for (const file of valid) {
        const hash = await generateFileHash(file);
        if (existingHashes.has(hash)) continue;
        existingHashes.add(hash);

        const ext = getExtension(file.name);
        const targets = getDocTargetFormats(ext);
        const isImg = ["png", "jpg", "jpeg", "webp"].includes(ext);

        newDocs.push({
          id: `${hash.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
          hash,
          file,
          nome: file.name,
          nomeBase: getBaseName(file.name),
          extensao: ext,
          tamanhoBytes: file.size,
          previewUrl: isImg ? URL.createObjectURL(file) : undefined,
          formato: targets[0],
          rotacao: 0,
          intervaloPaginas: "",
          tamanhoPagina: isImg ? "A4" : "A4",
          orientacao: "portrait",
          delimitadorCsv: ";",
          nomePersonalizado: null,
        });
      }

      if (!newDocs.length) {
        pushToast("Esses documentos já estavam na fila.", "info");
        setSection("docs");
        return;
      }

      if (folderName) setDocFolder(folderName);
      if (hasFolder || docs.length + newDocs.length >= 2) setDocZip(true);

      setDocs((prev) => [...prev, ...newDocs]);
      // Transição cinematográfica: ao adicionar documento, Fotos some e Documentos ocupa tela inteira!
      setSection("docs");
      pushToast(`${newDocs.length} documento(s) pronto(s) para transformação!`, "success");
    },
    [docs, pushToast, setSection]
  );

  const updateImage = useCallback((id: string, patch: Partial<ImageItem>) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }, []);

  const updateAllImages = useCallback((updater: (img: ImageItem) => Partial<ImageItem>) => {
    setImages((prev) => prev.map((img) => ({ ...img, ...updater(img) })));
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.urlMiniatura);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const clearAllImages = useCallback(() => {
    setImages((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.urlMiniatura));
      return [];
    });
  }, []);

  const updateDoc = useCallback((id: string, patch: Partial<DocItem>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const updateAllDocs = useCallback((updater: (doc: DocItem) => Partial<DocItem>) => {
    setDocs((prev) => prev.map((d) => ({ ...d, ...updater(d) })));
  }, []);

  const moveDoc = useCallback((index: number, delta: -1 | 1) => {
    setDocs((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }, []);

  const removeDoc = useCallback((id: string) => {
    setDocs((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const clearAllDocs = useCallback(() => {
    setDocs((prev) => {
      prev.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
      return [];
    });
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="revela-backdrop" aria-hidden="true" />
      <div className="revela-grain" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header photoCount={images.length} docCount={docs.length} />

        <main className="flex-1">
          <AnimatePresence mode="wait">
            {section === "portal" && (
              <SplitPortal
                onSelectPhotos={addPhotoFiles}
                onSelectDocs={addDocFiles}
                photoCount={images.length}
                docCount={docs.length}
              />
            )}

            {section === "photos" && (
              <ImageWorkspace
                images={images}
                folderName={photoFolder}
                usarZip={photoZip}
                setUsarZip={setPhotoZip}
                onAddFiles={addPhotoFiles}
                onRedirectDocs={(files) => addDocFiles(files)}
                onUpdateImage={updateImage}
                onUpdateAllImages={updateAllImages}
                onRemoveImage={removeImage}
                onClearAll={clearAllImages}
              />
            )}

            {section === "docs" && (
              <DocumentWorkspace
                docs={docs}
                folderName={docFolder}
                usarZip={docZip}
                setUsarZip={setDocZip}
                onAddFiles={addDocFiles}
                onUpdateDoc={updateDoc}
                onUpdateAllDocs={updateAllDocs}
                onMoveDoc={moveDoc}
                onRemoveDoc={removeDoc}
                onClearAll={clearAllDocs}
              />
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t border-[var(--border)] py-4 text-center font-mono text-[11px] text-[var(--text-muted)]">
          Revela v2 · Sem login, sem créditos, sem barreiras · Imagens & Documentos em lote
        </footer>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <RevelaAppShell />
      </ThemeProvider>
    </MotionConfig>
  );
}
