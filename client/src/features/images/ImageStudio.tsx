import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, Download, FolderOpen, Paintbrush, Plus, Trash2 } from "lucide-react";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import { useSection } from "../../state/section";
import { useToast } from "../../state/toasts";
import type {
  CutoutMode,
  ImageOutputFormat,
  ImageResultRecord,
  ImageStreamEvent,
} from "../../types/image";
import type { BatchRenameRule, QueueEntry } from "../../types/shared";
import { getExtension, readDroppedItems } from "../../lib/files";
import {
  DOC_ONLY_EXTENSIONS,
  IMAGE_EXTENSIONS,
  IMAGE_FORMATS,
  IMAGE_FORMAT_EXT,
} from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { base64ToBlob, triggerDownload } from "../../lib/download";
import { consumeNdjsonStream } from "../../lib/ndjson";
import { Button } from "../../components/ui/Button";
import { Input, Label, Select } from "../../components/ui/Field";
import { BatchRename } from "../../components/shared/BatchRename";
import { ProcessingPanel } from "../../components/shared/ProcessingPanel";
import { ImageCard } from "./ImageCard";
import { BeforeAfter } from "./BeforeAfter";
import { MaskEditor } from "./MaskEditor";
import { Lightbox } from "./Lightbox";

const STAGES = [
  { id: "removendo_fundo", label: "Isolamento CIELAB" },
  { id: "redimensionando", label: "Escala LANCZOS3" },
  { id: "convertendo", label: "Codificação" },
];

const STAGE_TEXT: Record<string, string> = {
  removendo_fundo: "Isolando fundo",
  redimensionando: "Redimensionando",
  convertendo: "Codificando formato",
};

const STAGE_WEIGHT: Record<string, number> = {
  removendo_fundo: 0.2,
  redimensionando: 0.6,
  convertendo: 0.88,
};

export function ImageStudio() {
  const {
    items: images,
    folderName,
    useZip,
    setUseZip,
    addFiles,
    updateItem,
    updateAll,
    removeItem,
    clearAll,
  } = useImages();
  const { addFiles: addDocs } = useDocuments();
  const { setSection } = useSection();
  const { notify } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [renameRule, setRenameRule] = useState<BatchRenameRule>({
    prefix: "",
    suffix: "",
    startNumber: 1,
    padDigits: 2,
    separator: "_",
  });

  const [bulkFormat, setBulkFormat] = useState<"" | ImageOutputFormat>("");
  const [bulkWidth, setBulkWidth] = useState("");
  const [bulkHeight, setBulkHeight] = useState("");
  const [bulkQuality, setBulkQuality] = useState("90");
  const [bulkRatio, setBulkRatio] = useState<"" | "on" | "off">("");
  const [bulkCutout, setBulkCutout] = useState<"" | "on" | "off">("");
  const [bulkCutoutMode, setBulkCutoutMode] = useState<"" | CutoutMode>("");

  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [results, setResults] = useState<ImageResultRecord[]>([]);
  const [lastZip, setLastZip] = useState<{ base64: string; nome: string } | null>(null);

  const [editingMask, setEditingMask] = useState<{
    dadosBase64: string;
    mime: string;
    nomeArquivo: string;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string; meta: string } | null>(
    null
  );

  const hasCustomNames = useMemo(
    () => images.some((i) => i.nomePersonalizado !== null && i.nomePersonalizado.trim() !== ""),
    [images]
  );

  const handleIncomingFiles = async (
    rawFiles: File[],
    fn?: string | null,
    hasFolder?: boolean
  ) => {
    const imgs = rawFiles.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
    const docs = rawFiles.filter((f) => DOC_ONLY_EXTENSIONS.has(getExtension(f.name)));

    if (imgs.length > 0) {
      const added = await addFiles(imgs, fn, hasFolder);
      if (added > 0) {
        notify(`${added} ${added === 1 ? "fotograma adicionado" : "fotogramas adicionados"}.`, "ok");
      } else {
        notify("Arquivos já presentes na bancada.", "neutral");
      }
      return;
    }

    if (docs.length > 0) {
      await addDocs(docs, fn, hasFolder);
      setSection("docs");
      notify("Documento transferido para a prancheta de Documentos.", "neutral");
      return;
    }

    notify("Formato de imagem não reconhecido.", "warn");
  };

  const applyPreset = (
    preset: "webp" | "catalogo" | "quadrado" | "metade" | "png" | "recorte"
  ) => {
    if (!images.length) return;
    if (preset === "webp") {
      updateAll(() => ({ formato: "WEBP", qualidade: 82, manterProporcao: true }));
      notify("F1 Web WEBP (82%) aplicado.", "ok");
    } else if (preset === "catalogo") {
      updateAll(() => ({
        formato: "JPEG",
        largura: "1200",
        altura: "1200",
        qualidade: 90,
        manterProporcao: true,
        modoAjuste: "inside",
        corFundo: "#ffffff",
      }));
      notify("F2 Catálogo (1200×1200 JPEG) aplicado.", "ok");
    } else if (preset === "quadrado") {
      updateAll(() => ({
        formato: "JPEG",
        largura: "1080",
        altura: "1080",
        qualidade: 90,
        manterProporcao: true,
        modoAjuste: "cover",
      }));
      notify("F3 Quadrado (1080×1080) aplicado.", "ok");
    } else if (preset === "metade") {
      updateAll((img) => ({
        largura: String(Math.max(1, Math.round(img.larguraOriginal / 2))),
        altura: String(Math.max(1, Math.round(img.alturaOriginal / 2))),
        qualidade: 85,
        manterProporcao: true,
      }));
      notify("F4 Escala 50% aplicada.", "ok");
    } else if (preset === "png") {
      updateAll(() => ({ formato: "PNG", qualidade: 100, manterProporcao: true }));
      notify("F5 PNG sem perda aplicado.", "ok");
    } else if (preset === "recorte") {
      updateAll(() => ({
        formato: "PNG",
        removerFundo: true,
        modoRemocao: "inteligente",
      }));
      notify("F6 Recorte de fundo aplicado.", "ok");
    }
  };

  const applyBulk = () => {
    updateAll((img) => ({
      formato: bulkFormat || img.formato,
      largura: bulkWidth !== "" ? bulkWidth : img.largura,
      altura: bulkHeight !== "" ? bulkHeight : img.altura,
      qualidade: bulkQuality ? Math.max(1, Math.min(100, Number(bulkQuality))) : img.qualidade,
      manterProporcao: bulkRatio ? bulkRatio === "on" : img.manterProporcao,
      removerFundo: bulkCutout ? bulkCutout === "on" : img.removerFundo,
      modoRemocao: bulkCutoutMode || img.modoRemocao,
    }));
    notify("Parâmetros replicados em todos os fotogramas.", "ok");
  };

  const runBatch = async () => {
    if (!images.length || processing) return;

    setProcessing(true);
    setProgressPct(2);
    setProgressText("Iniciando lote...");
    setActiveStage(null);
    setResults([]);
    setLastZip(null);
    setQueue(images.map((img, i) => ({ nome: img.nome, status: i === 0 ? "processando" : "pendente" })));

    const formData = new FormData();
    const config: Record<string, unknown> = {};
    let hasManualCutout = false;

    images.forEach((img, index) => {
      formData.append("arquivos", img.file, img.nome);
      const outBase = resolveOutputBaseName(img.nomeBase, img.nomePersonalizado, index, renameRule);
      if (img.removerFundo && img.modoRemocao === "manual") hasManualCutout = true;

      config[String(index)] = {
        formato: img.formato,
        largura: img.largura || null,
        altura: img.altura || null,
        qualidade: img.qualidade,
        manter_proporcao: img.manterProporcao,
        modo_ajuste: img.modoAjuste,
        remover_fundo: img.removerFundo,
        modo_remocao: img.modoRemocao,
        sensibilidade_fundo: img.sensibilidadeFundo,
        cor_fundo: img.corFundo,
        novo_nome: outBase,
      };
    });

    const activeZip = useZip && !hasManualCutout;
    if (hasManualCutout && useZip) {
      notify("Modo pincel ativo: entrega individual habilitada para edição da máscara.", "neutral");
    }

    formData.append("config", JSON.stringify(config));
    formData.append("usar_zip", String(activeZip));
    formData.append("nome_zip", `${folderName || "revela"}_imagens.zip`);

    const collected: ImageResultRecord[] = [];

    try {
      const response = await fetch("/api/images/batch", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ erro: "Falha ao processar lote." }));
        notify(err.erro || "Falha ao processar lote.", "err");
        return;
      }

      let cursor = 0;
      const completed = await consumeNdjsonStream<ImageStreamEvent>(response, (evt) => {
        if (evt.tipo === "progresso") {
          const base = (evt.indice - 1) / evt.total;
          const frac = (STAGE_WEIGHT[evt.etapa] ?? 0.9) / evt.total;
          setProgressPct(Math.min(99, Math.round((base + frac) * 100)));
          setProgressText(
            `${evt.indice}/${evt.total} · ${STAGE_TEXT[evt.etapa] || "Processando"} (${evt.nome})`
          );
          setActiveStage(evt.etapa);
        } else if (evt.tipo === "resultado") {
          const orig = images[evt.indice ?? cursor];
          const itemRes: ImageResultRecord = {
            ...evt,
            modoRemocao: orig?.removerFundo ? orig.modoRemocao : null,
            urlOriginal: orig?.urlMiniatura,
            tamanhoOriginalBytes: orig?.tamanhoBytes,
          };
          collected.push(itemRes);

          const doneIdx = cursor;
          cursor++;
          setQueue((prev) =>
            prev.map((q, i) =>
              i === doneIdx
                ? { ...q, status: evt.status === "ok" ? "concluida" : "erro" }
                : i === cursor
                ? { ...q, status: "processando" }
                : q
            )
          );

          if (
            evt.status === "ok" &&
            !activeZip &&
            evt.dados &&
            evt.salvo_como &&
            itemRes.modoRemocao !== "manual"
          ) {
            triggerDownload(base64ToBlob(evt.dados, evt.mime || "image/png"), evt.salvo_como);
          }
        } else if (evt.tipo === "concluido") {
          setProgressPct(100);
          setProgressText("Revelação concluída.");
          if (activeZip && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_imagens.zip" };
            setLastZip(z);
            triggerDownload(base64ToBlob(z.base64, "application/zip"), z.nome);
          }
        }
      });

      if (!completed && collected.length > 0) {
        notify(
          `Conexão interrompida: ${collected.length} de ${images.length} concluídas.`,
          "warn"
        );
      }

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        notify(`${okCount} ${okCount === 1 ? "imagem revelada" : "imagens reveladas"}.`, "ok");
        window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 160);
      }
    } catch {
      notify("Erro de comunicação com o servidor.", "err");
    } finally {
      setProcessing(false);
    }
  };

  const stats = useMemo(() => {
    const ok = results.filter((r) => r.status === "ok");
    const err = results.length - ok.length;
    const origBytes = ok.reduce((acc, r) => acc + (r.tamanhoOriginalBytes || 0), 0);
    const finalBytes = ok.reduce((acc, r) => acc + (r.tamanho_bytes || 0), 0);
    const deltaPct = origBytes > 0 ? Math.round((1 - finalBytes / origBytes) * 1000) / 10 : 0;
    return { total: results.length, ok: ok.length, err, origBytes, finalBytes, deltaPct };
  }, [results]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        const { files, folderName: fn, hasFolder } = await readDroppedItems(e.dataTransfer);
        if (files.length) await handleIncomingFiles(files, fn, hasFolder);
      }}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
    >
      {/* Cabeçalho da Câmara de Imagem com ações imediatas */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line-strong)] pb-5">
        <div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#9EDEE5]">
            SEÇÃO II · CÂMARA DE IMAGEM
          </span>
          <h1 className="mt-1 font-display text-4xl font-medium text-[var(--fg-primary)] sm:text-5xl">
            Folha de contato
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 border border-[var(--line-strong)] bg-[#190309] px-4 font-mono text-xs uppercase tracking-wider text-[var(--fg-primary)] hover:border-[var(--accent)] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--accent-bright)]" strokeWidth={1.5} />
            Adicionar fotos
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 border border-[var(--line-strong)] bg-[#190309] px-4 font-mono text-xs uppercase tracking-wider text-[var(--fg-primary)] hover:border-[var(--accent)] cursor-pointer"
          >
            <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-bright)]" strokeWidth={1.5} />
            Pasta
          </button>

          {images.length > 0 && (
            <button
              type="button"
              disabled={processing}
              onClick={runBatch}
              className="h-10 border border-[#BC9200] bg-[#FDE2B9] px-6 font-mono text-xs font-semibold uppercase tracking-wider text-[#60011D] hover:bg-white disabled:opacity-45 cursor-pointer"
            >
              {processing ? "Revelando..." : `Revelar lote [${images.length}]`}
            </button>
          )}
        </div>
      </div>

      {/* Estado vazio com personalidade de mesa de luz (sem dropzone tracejada genérica) */}
      {images.length === 0 && (
        <div className="my-12 border-y border-[var(--line-strong)] bg-[#190309]/80 py-16 px-6 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#9EDEE5]">
            BANCADA VAZIA · 000 FOTOGRAMAS
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium text-[var(--fg-primary)] sm:text-4xl">
            Solte suas imagens ou uma pasta inteira sobre a mesa
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-[var(--fg-secondary)]">
            Aceita PNG, JPEG, WEBP, AVIF, TIFF, GIF e BMP. Arquivos repetidos são filtrados por assinatura SHA-256.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 border border-[#BC9200] bg-[#FDE2B9] px-6 font-mono text-xs font-semibold uppercase tracking-wider text-[#60011D] hover:bg-white cursor-pointer"
            >
              + Selecionar imagens
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex h-10 items-center gap-2 border border-[var(--line-strong)] bg-[#120206] px-5 font-mono text-xs uppercase tracking-wider text-[var(--fg-primary)] hover:border-[var(--accent)] cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-bright)]" strokeWidth={1.5} />
              Carregar pasta
            </button>
          </div>
        </div>
      )}

      {/* Bancada técnica de comando em lote */}
      {images.length > 0 && (
        <section className="mb-8 border border-[var(--line-strong)] bg-[#190309]/92">
          {/* Barra 1: Teclas de função F1..F6 */}
          <div className="flex flex-wrap items-center justify-between border-b border-[var(--line)] bg-[#120206] px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
              TECLAS DE BANCADA · {images.length} FOTOGRAMA(S)
            </span>
            <button
              type="button"
              onClick={() => {
                clearAll();
                setResults([]);
                setLastZip(null);
              }}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--status-err)] hover:underline cursor-pointer"
            >
              <Trash2 className="h-3 w-3" strokeWidth={1.5} />
              Limpar mesa
            </button>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] border-b border-[var(--line)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            {[
              { id: "webp" as const, code: "F1", title: "Web WEBP", spec: "82% · leve" },
              { id: "catalogo" as const, code: "F2", title: "Catálogo", spec: "1200×1200 · JPG" },
              { id: "quadrado" as const, code: "F3", title: "Quadrado", spec: "1080×1080 · Cover" },
              { id: "metade" as const, code: "F4", title: "Escala 50%", spec: "Metade px" },
              { id: "png" as const, code: "F5", title: "PNG Puro", spec: "100% · sem perda" },
              { id: "recorte" as const, code: "F6", title: "Isolar Fundo", spec: "PNG · CIELAB" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className="flex flex-col items-start px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--bg-field)] cursor-pointer"
              >
                <div className="flex w-full items-baseline justify-between font-mono text-[10px]">
                  <span className="text-[var(--accent-bright)] font-semibold">{p.code}</span>
                  <span className="text-[var(--fg-muted)]">{p.spec}</span>
                </div>
                <span className="mt-1 text-xs font-semibold text-[var(--fg-primary)]">{p.title}</span>
              </button>
            ))}
          </div>

          {/* Barra 2: Parâmetros globais + Renomeação */}
          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 items-end">
              <div>
                <Label>Formato</Label>
                <Select
                  value={bulkFormat}
                  onChange={(e) => setBulkFormat(e.target.value as "" | ImageOutputFormat)}
                >
                  <option value="">Manter</option>
                  {IMAGE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Largura (px)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Original"
                  className="font-mono"
                  value={bulkWidth}
                  onChange={(e) => setBulkWidth(e.target.value)}
                />
              </div>
              <div>
                <Label>Altura (px)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Original"
                  className="font-mono"
                  value={bulkHeight}
                  onChange={(e) => setBulkHeight(e.target.value)}
                />
              </div>
              <div>
                <Label>Qualidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="font-mono"
                  value={bulkQuality}
                  onChange={(e) => setBulkQuality(e.target.value)}
                />
              </div>
              <div>
                <Label>Proporção</Label>
                <Select
                  value={bulkRatio}
                  onChange={(e) => setBulkRatio(e.target.value as "" | "on" | "off")}
                >
                  <option value="">Manter</option>
                  <option value="on">Travar</option>
                  <option value="off">Livre</option>
                </Select>
              </div>
              <div>
                <Label>Isolar fundo</Label>
                <Select
                  value={bulkCutout}
                  onChange={(e) => setBulkCutout(e.target.value as "" | "on" | "off")}
                >
                  <option value="">Manter</option>
                  <option value="on">Ativar todas</option>
                  <option value="off">Desativar</option>
                </Select>
              </div>
              <div>
                <Label>Modo recorte</Label>
                <Select
                  value={bulkCutoutMode}
                  onChange={(e) => setBulkCutoutMode(e.target.value as "" | CutoutMode)}
                >
                  <option value="">Manter</option>
                  <option value="automatico">C1 Rápido</option>
                  <option value="inteligente">C2 Refinado</option>
                  <option value="manual">C3 Pincel</option>
                </Select>
              </div>
              <Button variant="secondary" onClick={applyBulk} className="w-full">
                Replicar
              </Button>
            </div>

            <BatchRename
              rule={renameRule}
              onChange={setRenameRule}
              sampleExtension={IMAGE_FORMAT_EXT[images[0]?.formato || "PNG"]}
              sampleOriginalBase={images[0]?.nomeBase || "imagem"}
              hasCustomNames={hasCustomNames}
              onResetCustomNames={() => updateAll(() => ({ nomePersonalizado: null }))}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
              <label className="inline-flex items-center gap-2.5 font-mono text-xs text-[var(--fg-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useZip}
                  onChange={(e) => setUseZip(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Empacotar saída em arquivo único .ZIP
              </label>

              <button
                type="button"
                disabled={processing}
                onClick={runBatch}
                className="h-9 border border-[#BC9200] bg-[#FDE2B9] px-5 font-mono text-xs font-semibold uppercase tracking-wider text-[#60011D] hover:bg-white disabled:opacity-45 cursor-pointer"
              >
                {processing ? "Processando..." : `Revelar ${images.length} fotograma(s)`}
              </button>
            </div>
          </div>

          {processing && (
            <div className="border-t border-[var(--line)] px-5 pb-5">
              <ProcessingPanel
                visible={processing}
                percent={progressPct}
                statusText={progressText}
                stages={STAGES}
                activeStage={activeStage}
                queue={queue}
              />
            </div>
          )}
        </section>
      )}

      {/* Folha de contato: grade de fotogramas */}
      {images.length > 0 && (
        <section className="mb-10">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((item, index) => (
              <ImageCard
                key={item.id}
                item={item}
                index={index}
                renameRule={renameRule}
                onUpdate={updateItem}
                onRemove={removeItem}
                onZoom={(src, title, meta) => setLightbox({ src, title, meta })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Resultados revelados */}
      {results.length > 0 && (
        <section
          ref={resultsRef}
          className="border border-[var(--line-strong)] bg-[#190309]/95 p-5"
        >
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9EDEE5]">
                SAÍDA CONCLUÍDA · {stats.ok} DE {stats.total}
              </span>
              <h2 className="mt-1 font-display text-2xl font-medium text-[var(--fg-primary)]">
                Provas reveladas
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-[var(--accent-bright)]">
                {formatBytes(stats.origBytes)} → {formatBytes(stats.finalBytes)}
                {stats.deltaPct > 0 ? ` (-${stats.deltaPct}%)` : ""}
              </span>
              {lastZip && (
                <Button
                  size="sm"
                  onClick={() =>
                    triggerDownload(base64ToBlob(lastZip.base64, "application/zip"), lastZip.nome)
                  }
                >
                  <Archive className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Baixar ZIP
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  clearAll();
                  setResults([]);
                  setLastZip(null);
                }}
              >
                Nova bancada
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => {
              const resUrl = r.dados && r.mime ? `data:${r.mime};base64,${r.dados}` : "";
              return (
                <article
                  key={`${r.nome}-${i}`}
                  className={`border bg-[#120206] ${
                    r.status === "ok" ? "border-[var(--line)]" : "border-[var(--status-err)]/50"
                  }`}
                >
                  {r.status === "ok" ? (
                    <>
                      <div className="aspect-[16/10] w-full overflow-hidden border-b border-[var(--line)]">
                        {r.urlOriginal && resUrl ? (
                          <BeforeAfter
                            originalUrl={r.urlOriginal}
                            resultUrl={resUrl}
                            alt={r.salvo_como || r.nome}
                          />
                        ) : resUrl ? (
                          <img
                            src={resUrl}
                            alt={r.salvo_como}
                            className="develop-reveal h-full w-full object-contain"
                          />
                        ) : null}
                      </div>

                      <div className="p-3.5">
                        <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
                          <span className="truncate text-[var(--fg-primary)]">{r.salvo_como}</span>
                          <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">
                            {r.dimensoes} · {r.tamanho_bytes ? formatBytes(r.tamanho_bytes) : ""}
                          </span>
                        </div>

                        {r.aviso && (
                          <p className="mt-2 border border-[var(--line-gold)] bg-[#190309] p-2 font-mono text-[10px] text-[var(--accent-bright)]">
                            {r.aviso}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5">
                          {r.modoRemocao === "manual" && r.dados && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setEditingMask({
                                  dadosBase64: r.dados!,
                                  mime: r.mime || "image/png",
                                  nomeArquivo: r.salvo_como || "imagem.png",
                                })
                              }
                            >
                              <Paintbrush className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Retocar máscara
                            </Button>
                          )}
                          {r.dados && (
                            <Button
                              size="sm"
                              onClick={() =>
                                triggerDownload(
                                  base64ToBlob(
                                    r.dados!,
                                    r.mime || "application/octet-stream"
                                  ),
                                  r.salvo_como || r.nome
                                )
                              }
                            >
                              <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Baixar
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-4">
                      <p className="font-mono text-xs text-[var(--status-err)]">{r.nome}</p>
                      <p className="mt-1 text-xs text-[var(--fg-secondary)]">{r.mensagem}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <AnimatePresence>
        {editingMask && (
          <MaskEditor
            dadosBase64={editingMask.dadosBase64}
            mime={editingMask.mime}
            nomeArquivo={editingMask.nomeArquivo}
            onClose={() => setEditingMask(null)}
          />
        )}
        {lightbox && (
          <Lightbox
            src={lightbox.src}
            title={lightbox.title}
            meta={lightbox.meta}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) handleIncomingFiles(list, "fotos", false);
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
            handleIncomingFiles(list, folder, true);
          }
          e.target.value = "";
        }}
      />
    </motion.div>
  );
}
