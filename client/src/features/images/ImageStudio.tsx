import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Download,
  FolderOpen,
  Paintbrush,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
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
  { id: "removendo_fundo", label: "Recorte de fundo" },
  { id: "redimensionando", label: "Redimensionamento" },
  { id: "convertendo", label: "Codificação" },
];

const STAGE_TEXT: Record<string, string> = {
  removendo_fundo: "Recortando fundo",
  redimensionando: "Redimensionando",
  convertendo: "Convertendo formato",
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

  const [dragActive, setDragActive] = useState(false);

  const [renameRule, setRenameRule] = useState<BatchRenameRule>({
    prefix: "",
    suffix: "",
    startNumber: 1,
    padDigits: 2,
    separator: "_",
  });

  // Controles em lote
  const [bulkFormat, setBulkFormat] = useState<"" | ImageOutputFormat>("");
  const [bulkWidth, setBulkWidth] = useState("");
  const [bulkHeight, setBulkHeight] = useState("");
  const [bulkQuality, setBulkQuality] = useState("90");
  const [bulkRatio, setBulkRatio] = useState<"" | "on" | "off">("");
  const [bulkCutout, setBulkCutout] = useState<"" | "on" | "off">("");
  const [bulkCutoutMode, setBulkCutoutMode] = useState<"" | CutoutMode>("");

  // Processamento
  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [results, setResults] = useState<ImageResultRecord[]>([]);
  const [lastZip, setLastZip] = useState<{ base64: string; nome: string } | null>(null);

  // Modais
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
        notify(`${added} ${added === 1 ? "imagem adicionada" : "imagens adicionadas"}.`, "ok");
      } else {
        notify("Arquivos já presentes na fila.", "neutral");
      }
      return;
    }

    if (docs.length > 0) {
      await addDocs(docs, fn, hasFolder);
      setSection("docs");
      notify("Documento transferido para a seção Documentos.", "neutral");
      return;
    }

    notify("Nenhuma imagem compatível encontrada.", "warn");
  };

  const applyPreset = (
    preset: "webp" | "catalogo" | "quadrado" | "metade" | "png" | "recorte"
  ) => {
    if (!images.length) return;
    if (preset === "webp") {
      updateAll(() => ({ formato: "WEBP", qualidade: 82, manterProporcao: true }));
      notify("Configuração Web (WEBP 82%) aplicada.", "ok");
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
      notify("Configuração Catálogo (1200×1200 JPEG) aplicada.", "ok");
    } else if (preset === "quadrado") {
      updateAll(() => ({
        formato: "JPEG",
        largura: "1080",
        altura: "1080",
        qualidade: 90,
        manterProporcao: true,
        modoAjuste: "cover",
      }));
      notify("Configuração Quadrado (1080×1080 preenchido) aplicada.", "ok");
    } else if (preset === "metade") {
      updateAll((img) => ({
        largura: String(Math.max(1, Math.round(img.larguraOriginal / 2))),
        altura: String(Math.max(1, Math.round(img.alturaOriginal / 2))),
        qualidade: 85,
        manterProporcao: true,
      }));
      notify("Redução de 50% nas dimensões aplicada.", "ok");
    } else if (preset === "png") {
      updateAll(() => ({ formato: "PNG", qualidade: 100, manterProporcao: true }));
      notify("Configuração PNG sem perda aplicada.", "ok");
    } else if (preset === "recorte") {
      updateAll(() => ({
        formato: "PNG",
        removerFundo: true,
        modoRemocao: "inteligente",
      }));
      notify("Recorte de fundo refinado em PNG aplicado.", "ok");
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
    notify("Parâmetros aplicados ao lote.", "ok");
  };

  const runBatch = async () => {
    if (!images.length || processing) return;

    setProcessing(true);
    setProgressPct(2);
    setProgressText("Enviando arquivos...");
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
      notify("Modo manual ativo: arquivos entregues individualmente para ajuste com pincel.", "neutral");
    }

    formData.append("config", JSON.stringify(config));
    formData.append("usar_zip", String(activeZip));
    formData.append("nome_zip", `${folderName || "revela"}_imagens.zip`);

    const collected: ImageResultRecord[] = [];

    try {
      const response = await fetch("/api/images/batch", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ erro: "Falha ao processar imagens." }));
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
          setProgressText("Processamento concluído.");
          if (activeZip && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_imagens.zip" };
            setLastZip(z);
            triggerDownload(base64ToBlob(z.base64, "application/zip"), z.nome);
          }
        }
      });

      if (!completed && collected.length > 0) {
        notify(
          `Processamento interrompido: ${collected.length} de ${images.length} concluídas.`,
          "warn"
        );
      }

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        notify(`${okCount} ${okCount === 1 ? "imagem processada" : "imagens processadas"}.`, "ok");
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
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
    >
      {/* Cabeçalho editorial da seção Fotos */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <span className="font-mono text-xs tracking-[0.14em] text-[var(--water-opposite-tint)]">
            01 / FOTOS
          </span>
          <h1 className="mt-1 font-display text-4xl font-medium text-[var(--fg-primary)] sm:text-5xl">
            Laboratório de imagens
          </h1>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-[var(--fg-secondary)]">
          Redimensione, converta formatos, padronize nomes em lote e recorte fundos.
        </p>
      </div>

      {/* Área de entrada de arquivos */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragActive(false);
          const { files, folderName: fn, hasFolder } = await readDroppedItems(e.dataTransfer);
          if (files.length) await handleIncomingFiles(files, fn, hasFolder);
        }}
        className={`mb-7 flex flex-col items-center justify-between gap-4 rounded-[6px] border border-dashed px-6 py-6 transition-colors sm:flex-row ${
          dragActive
            ? "border-[var(--accent)] bg-[var(--bg-field)]"
            : "border-[var(--line-strong)] bg-[var(--bg-panel)]"
        }`}
      >
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-1 items-center gap-3.5 cursor-pointer"
        >
          <Upload className="h-5 w-5 shrink-0 text-[var(--accent-bright)]" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-medium text-[var(--fg-primary)]">
              {images.length > 0
                ? "Arraste mais fotos ou pastas para acrescentar à fila"
                : "Arraste fotos ou uma pasta inteira para começar"}
            </p>
            <p className="font-mono text-[11px] text-[var(--fg-muted)]">
              PNG, JPEG, WEBP, AVIF, GIF, TIFF e BMP · Arquivos idênticos são ignorados automaticamente
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            Selecionar fotos
          </Button>
          <Button size="sm" variant="secondary" onClick={() => folderInputRef.current?.click()}>
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
            Pasta
          </Button>
        </div>
      </div>

      {/* Painel de controle em lote */}
      {images.length > 0 && (
        <section className="mb-8 space-y-5 rounded-[6px] border border-[var(--line)] bg-[var(--bg-panel)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3.5">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-xl font-medium text-[var(--fg-primary)]">
                Parâmetros do lote
              </h2>
              <span className="font-mono text-xs text-[var(--fg-muted)]">
                {images.length} {images.length === 1 ? "arquivo" : "arquivos"}
              </span>
            </div>

            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                clearAll();
                setResults([]);
                setLastZip(null);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Esvaziar fila
            </Button>
          </div>

          {/* Presets discretos em barra */}
          <div>
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
              Predefinições rápidas
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { id: "webp" as const, title: "Web WEBP", meta: "WEBP · 82%" },
                { id: "catalogo" as const, title: "Catálogo", meta: "1200×1200 · JPEG" },
                { id: "quadrado" as const, title: "Quadrado", meta: "1080×1080 · Cover" },
                { id: "metade" as const, title: "Reduzir 50%", meta: "Metade da escala" },
                { id: "png" as const, title: "PNG sem perda", meta: "PNG · 100%" },
                { id: "recorte" as const, title: "Recortar fundo", meta: "PNG · Refinado" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="flex flex-col items-start rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] px-3 py-2 text-left transition-colors hover:border-[var(--accent)] cursor-pointer"
                >
                  <span className="text-xs font-semibold text-[var(--fg-primary)]">{p.title}</span>
                  <span className="font-mono text-[10px] text-[var(--fg-muted)]">{p.meta}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Controles dimensionais em lote */}
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-4 lg:grid-cols-8 items-end">
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
                <option value="on">Preservar</option>
                <option value="off">Livre</option>
              </Select>
            </div>
            <div>
              <Label>Remover fundo</Label>
              <Select
                value={bulkCutout}
                onChange={(e) => setBulkCutout(e.target.value as "" | "on" | "off")}
              >
                <option value="">Manter</option>
                <option value="on">Ativar em todas</option>
                <option value="off">Desativar</option>
              </Select>
            </div>
            <div>
              <Label>Modo de recorte</Label>
              <Select
                value={bulkCutoutMode}
                onChange={(e) => setBulkCutoutMode(e.target.value as "" | CutoutMode)}
              >
                <option value="">Manter</option>
                <option value="automatico">Rápido</option>
                <option value="inteligente">Refinado</option>
                <option value="manual">Manual</option>
              </Select>
            </div>
            <Button variant="secondary" onClick={applyBulk} className="w-full">
              Aplicar ao lote
            </Button>
          </div>

          {/* Renomeação em lote */}
          <BatchRename
            rule={renameRule}
            onChange={setRenameRule}
            sampleExtension={IMAGE_FORMAT_EXT[images[0]?.formato || "PNG"]}
            sampleOriginalBase={images[0]?.nomeBase || "imagem"}
            hasCustomNames={hasCustomNames}
            onResetCustomNames={() => updateAll(() => ({ nomePersonalizado: null }))}
          />

          <div className="border-t border-[var(--line)] pt-3">
            <label className="inline-flex items-center gap-2.5 text-xs text-[var(--fg-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useZip}
                onChange={(e) => setUseZip(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Agrupar arquivos convertidos em um pacote ZIP ao concluir
            </label>
          </div>
        </section>
      )}

      {/* Grade de cartões */}
      {images.length > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Barra de execução */}
      {images.length > 0 && (
        <section className="mb-10 rounded-[6px] border border-[var(--line-strong)] bg-[var(--bg-panel)] p-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              disabled={processing}
              onClick={runBatch}
              className="min-w-[220px]"
            >
              {processing
                ? "Revelando lote..."
                : `Revelar ${images.length} ${images.length === 1 ? "imagem" : "imagens"}`}
            </Button>

            <Button
              size="lg"
              variant="secondary"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              title="Acrescentar mais imagens"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Adicionar
            </Button>
          </div>

          <ProcessingPanel
            visible={processing}
            percent={progressPct}
            statusText={progressText}
            stages={STAGES}
            activeStage={activeStage}
            queue={queue}
          />
        </section>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <section
          ref={resultsRef}
          className="rounded-[6px] border border-[var(--line-strong)] bg-[var(--bg-panel)] p-5"
        >
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div>
              <h2 className="font-display text-2xl font-medium text-[var(--fg-primary)]">
                Resultados
              </h2>
              <p className="text-xs text-[var(--fg-secondary)]">
                Arraste a linha divisória sobre a miniatura para comparar o original com o arquivo convertido.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                Nova sessão
              </Button>
            </div>
          </div>

          {/* Resumo numérico */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] p-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                Total
              </span>
              <p className="mt-1 font-mono text-lg text-[var(--fg-primary)]">{stats.total}</p>
            </div>
            <div className="rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] p-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                Concluídas
              </span>
              <p className="mt-1 font-mono text-lg text-[var(--status-ok)]">{stats.ok}</p>
            </div>
            <div className="rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] p-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                Falhas
              </span>
              <p className="mt-1 font-mono text-lg text-[var(--status-err)]">{stats.err}</p>
            </div>
            <div className="rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] p-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                Volume
              </span>
              <p className="mt-1 font-mono text-xs text-[var(--fg-primary)]">
                {formatBytes(stats.origBytes)} para {formatBytes(stats.finalBytes)}
              </p>
              <span className="font-mono text-[10px] text-[var(--accent-bright)]">
                {stats.deltaPct > 0
                  ? `${stats.deltaPct}% de redução`
                  : stats.deltaPct < 0
                  ? `${Math.abs(stats.deltaPct)}% de acréscimo`
                  : "mesmo tamanho"}
              </span>
            </div>
          </div>

          {/* Grade de cartões de resultado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => {
              const resUrl = r.dados && r.mime ? `data:${r.mime};base64,${r.dados}` : "";
              return (
                <article
                  key={`${r.nome}-${i}`}
                  className={`overflow-hidden rounded-[6px] border bg-[var(--bg-field)] ${
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
                        <p className="truncate font-mono text-xs text-[var(--fg-primary)]">
                          {r.salvo_como}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-muted)]">
                          {r.dimensoes || ""}
                          {r.dimensoes && r.tamanho_bytes ? " · " : ""}
                          {r.tamanho_bytes ? formatBytes(r.tamanho_bytes) : ""}
                        </p>

                        {r.aviso && (
                          <p className="mt-2 rounded-[4px] border border-[var(--line-gold)] bg-[var(--bg-deep)]/60 p-2 font-mono text-[10px] leading-relaxed text-[var(--accent-bright)]">
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
                              Máscara
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

      {/* Modais */}
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

      {/* Inputs ocultos */}
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
