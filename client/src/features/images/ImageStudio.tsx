import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Plus } from "lucide-react";
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
import { Input, Label } from "../../components/ui/Field";
import { BatchRename } from "../../components/shared/BatchRename";
import { ProcessingPanel } from "../../components/shared/ProcessingPanel";
import { ImageCard } from "./ImageCard";
import { BeforeAfter } from "./BeforeAfter";
import { MaskEditor } from "./MaskEditor";
import { Lightbox } from "./Lightbox";

const STAGES = [
  { id: "removendo_fundo", label: "Remover fundo" },
  { id: "redimensionando", label: "Redimensionar" },
  { id: "convertendo", label: "Converter" },
];

const STAGE_TEXT: Record<string, string> = {
  removendo_fundo: "Removendo fundo",
  redimensionando: "Redimensionando",
  convertendo: "Convertendo formato",
};

const STAGE_WEIGHT: Record<string, number> = {
  removendo_fundo: 0.2,
  redimensionando: 0.6,
  convertendo: 0.88,
};

type SizePreset = "original" | "half" | "catalogo" | "quadrado" | "custom";

export function ImageStudio() {
  const {
    items: images,
    folderName,
    useZip,
    batchFormat,
    setBatchFormat,
    setRowFormat,
    setUseZip,
    addFiles,
    updateItem,
    updateAll,
    removeItem,
    clearAll,
  } = useImages();
  const { addFiles: addDocs } = useDocuments();
  const { activeRouteAction, navigate } = useSection();
  const { notify } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const finishedTimerRef = useRef<number | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [justFinished, setJustFinished] = useState(false);

  const [renameRule, setRenameRule] = useState<BatchRenameRule>({
    prefix: "",
    suffix: "",
    startNumber: 1,
    padDigits: 2,
    separator: "_",
  });

  const [sizePreset, setSizePreset] = useState<SizePreset>("original");
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [globalCutout, setGlobalCutout] = useState<false | CutoutMode>(false);

  useEffect(() => {
    if (activeRouteAction === "recorte") {
      setGlobalCutout("inteligente");
      setBatchFormat("PNG");
      updateAll(() => ({ removerFundo: true, modoRemocao: "inteligente" }));
    } else if (activeRouteAction === "redimensionar") {
      setSizePreset("catalogo");
      updateAll(() => ({ largura: "1200", altura: "1200", manterProporcao: true }));
    } else if (activeRouteAction === "converter") {
      setBatchFormat("WEBP");
      updateAll(() => ({ qualidade: 85 }));
    }
  }, [activeRouteAction, setBatchFormat, updateAll]);

  useEffect(() => {
    return () => {
      if (finishedTimerRef.current) window.clearTimeout(finishedTimerRef.current);
    };
  }, []);

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

  const totalInputBytes = useMemo(
    () => images.reduce((acc, it) => acc + it.tamanhoBytes, 0),
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
      await addFiles(imgs, fn, hasFolder);
      return;
    }

    if (docs.length > 0) {
      await addDocs(docs, fn, hasFolder);
      navigate("docs");
      return;
    }

    notify("Nenhuma imagem compatível encontrada.", "err");
  };

  // Seleções sem toasts (o próprio controle segmentado mostra o estado)
  const handleSelectBatchFormat = (fmt: ImageOutputFormat) => {
    setBatchFormat(fmt);
  };

  const handleSelectSizePreset = (preset: SizePreset) => {
    setSizePreset(preset);
    if (preset === "original") {
      updateAll(() => ({ largura: "", altura: "", manterProporcao: true, modoAjuste: "inside" }));
    } else if (preset === "half") {
      updateAll((img) => ({
        largura: String(Math.max(1, Math.round(img.larguraOriginal / 2))),
        altura: String(Math.max(1, Math.round(img.alturaOriginal / 2))),
        manterProporcao: true,
        modoAjuste: "inside",
      }));
    } else if (preset === "catalogo") {
      updateAll(() => ({
        largura: "1200",
        altura: "1200",
        manterProporcao: true,
        modoAjuste: "inside",
      }));
    } else if (preset === "quadrado") {
      updateAll(() => ({
        largura: "1080",
        altura: "1080",
        manterProporcao: true,
        modoAjuste: "cover",
      }));
    }
  };

  const handleApplyCustomDimensions = (w: string, h: string) => {
    setCustomW(w);
    setCustomH(h);
    updateAll(() => ({ largura: w, altura: h }));
  };

  const handleSelectGlobalCutout = (mode: false | CutoutMode) => {
    setGlobalCutout(mode);
    if (mode === false) {
      updateAll(() => ({ removerFundo: false }));
    } else {
      if (batchFormat === "JPEG") setBatchFormat("PNG");
      updateAll((img) => ({
        removerFundo: true,
        modoRemocao: mode,
        formato: img.formato === "JPEG" ? "PNG" : img.formato,
      }));
    }
  };

  const downloadAllResults = () => {
    if (lastZip) {
      triggerDownload(base64ToBlob(lastZip.base64, "application/zip"), lastZip.nome);
      return;
    }
    results.forEach((r) => {
      if (r.status === "ok" && r.dados) {
        triggerDownload(
          base64ToBlob(r.dados, r.mime || "image/png"),
          r.salvo_como || r.nome
        );
      }
    });
  };

  const runBatch = async () => {
    if (!images.length || processing) return;
    if (justFinished && results.length > 0) {
      downloadAllResults();
      return;
    }

    setProcessing(true);
    setJustFinished(false);
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
      await consumeNdjsonStream<ImageStreamEvent>(response, (evt) => {
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
          setProgressText("Concluído.");
          if (activeZip && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_imagens.zip" };
            setLastZip(z);
            triggerDownload(base64ToBlob(z.base64, "application/zip"), z.nome);
          }
        }
      });

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        setJustFinished(true);
        if (finishedTimerRef.current) window.clearTimeout(finishedTimerRef.current);
        finishedTimerRef.current = window.setTimeout(() => setJustFinished(false), 4500);
        notify(
          okCount === 1 ? "1 foto concluída." : `${okCount} fotos concluídas.`,
          "ok"
        );
        window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 160);
      }
    } catch {
      notify("Erro de comunicação com o servidor.", "err");
    } finally {
      setProcessing(false);
    }
  };

  // Botão curto ("Revelar 12 fotos") + linha de resumo ao lado ("WEBP · 1200 px · fundo mantido")
  const { buttonLabel, summaryLine } = useMemo(() => {
    const countText = images.length === 1 ? "1 foto" : `${images.length} fotos`;
    const exceptions = images.filter((i) => i.formatoIndividual !== null);
    const fmtText =
      exceptions.length === 0
        ? batchFormat
        : `${batchFormat} (${exceptions.length} ${
            exceptions.length === 1 ? "exceção" : "exceções"
          })`;
    const sizeText =
      sizePreset === "half"
        ? "50%"
        : sizePreset === "catalogo"
        ? "1200 px"
        : sizePreset === "quadrado"
        ? "1080 px"
        : sizePreset === "custom" && (customW || customH)
        ? `${customW || "auto"}×${customH || "auto"} px`
        : "tamanho original";
    const anyCutout = images.some((i) => i.removerFundo);
    const bgText = anyCutout ? "sem fundo" : "fundo mantido";
    return {
      buttonLabel: `Revelar ${countText}`,
      summaryLine: `${fmtText} · ${sizeText} · ${bgText}`,
    };
  }, [images, batchFormat, sizePreset, customW, customH]);

  const stats = useMemo(() => {
    const ok = results.filter((r) => r.status === "ok");
    const origBytes = ok.reduce((acc, r) => acc + (r.tamanhoOriginalBytes || 0), 0);
    const finalBytes = ok.reduce((acc, r) => acc + (r.tamanho_bytes || 0), 0);
    const deltaPct = origBytes > 0 ? Math.round((1 - finalBytes / origBytes) * 1000) / 10 : 0;
    return { total: results.length, ok: ok.length, origBytes, finalBytes, deltaPct };
  }, [results]);

  const countHeaderLabel =
    images.length === 0
      ? "Nenhuma foto na fila"
      : `${images.length === 1 ? "1 foto" : `${images.length} fotos`} · ${formatBytes(totalInputBytes)}`;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragActive) setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setDragActive(false);
        const { files, folderName: fn, hasFolder } = await readDroppedItems(e.dataTransfer);
        if (files.length) await handleIncomingFiles(files, fn, hasFolder);
      }}
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8"
    >
      {/* Folha centralizada em Fotos */}
      <motion.div
        initial={{ opacity: 0.94, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.94, transition: { duration: 0.08 } }}
        transition={{
          y: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.12, ease: "easeOut" },
        }}
        className={`mx-auto w-full rounded-[6px] border border-[#BC9200] border-l-4 border-l-[#60011D] bg-[#FDE2B9] p-6 text-[#60011D] transition-transform duration-200 sm:p-8 ${
          dragActive ? "-translate-y-1" : ""
        }`}
      >
        {/* Cabeçalho simples: título serifado + estado + Adicionar, Pasta e Limpar fila na mesma linha */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-3xl font-semibold text-[#60011D] sm:text-4xl">
              {dragActive ? "Solte para adicionar" : "Fotos"}
            </h1>
            <span className="text-[13px] font-medium text-[#3B0011]">{countHeaderLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => folderInputRef.current?.click()}>
              Pasta
            </Button>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearAll();
                  setResults([]);
                  setLastZip(null);
                  setJustFinished(false);
                }}
                className="rounded-[6px] px-2.5 py-1.5 text-[13px] font-semibold text-[#60011D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
              >
                Limpar fila
              </button>
            )}
          </div>
        </div>

        {/* Estado vazio */}
        {images.length === 0 ? (
          <div className="rounded-[6px] bg-[#F4D09A]/50 px-6 py-14 text-center">
            <h2 className="font-display text-2xl font-semibold text-[#60011D] sm:text-3xl">
              {dragActive
                ? "Solte para adicionar"
                : "Converta e redimensione centenas de fotos de uma vez."}
            </h2>
            <p className="mx-auto mt-2 max-w-md font-sans text-[13px] text-[#3B0011]">
              Arraste arquivos ou pastas para esta folha. Formatos aceitos: PNG, JPG, WEBP, AVIF, GIF, TIFF e BMP.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#60011D] text-[#FDE2B9]"
              >
                <Plus className="h-4 w-4" />
                Escolher fotos
              </Button>
              <Button variant="secondary" onClick={() => folderInputRef.current?.click()}>
                Escolher pasta
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Grupos do Lote separados por leve tom mais escuro de creme, sem bordas */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* Grupo 1: Formato em controle segmentado */}
              <div className="rounded-[6px] bg-[#F4D09A]/55 p-3.5">
                <Label>Formato</Label>
                <div className="mt-1.5 flex overflow-hidden rounded-[6px] bg-[#FDE2B9]">
                  {IMAGE_FORMATS.map((fmt) => {
                    const active = batchFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleSelectBatchFormat(fmt)}
                        className={`flex-1 py-1.5 font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                          active
                            ? "bg-[#60011D] font-semibold text-[#FDE2B9] ring-1 ring-inset ring-[#BC9200]"
                            : "text-[#3B0011] hover:bg-[#F4D09A]"
                        }`}
                      >
                        {fmt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grupo 2: Tamanho em controle segmentado */}
              <div className="rounded-[6px] bg-[#F4D09A]/55 p-3.5">
                <Label>Tamanho</Label>
                <div className="mt-1.5 flex overflow-hidden rounded-[6px] bg-[#FDE2B9]">
                  {(
                    [
                      { id: "original", label: "Original" },
                      { id: "half", label: "50%" },
                      { id: "catalogo", label: "1200 px" },
                      { id: "quadrado", label: "1080 px" },
                      { id: "custom", label: "Exato" },
                    ] as const
                  ).map((p) => {
                    const active = sizePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectSizePreset(p.id)}
                        className={`flex-1 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                          active
                            ? "bg-[#60011D] font-semibold text-[#FDE2B9] ring-1 ring-inset ring-[#BC9200]"
                            : "text-[#3B0011] hover:bg-[#F4D09A]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {sizePreset === "custom" && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Largura (px)"
                      value={customW}
                      onChange={(e) => handleApplyCustomDimensions(e.target.value, customH)}
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Altura (px)"
                      value={customH}
                      onChange={(e) => handleApplyCustomDimensions(customW, e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Grupo 3: Fundo em controle segmentado */}
              <div className="rounded-[6px] bg-[#F4D09A]/55 p-3.5">
                <Label>Fundo</Label>
                <div className="mt-1.5 flex overflow-hidden rounded-[6px] bg-[#FDE2B9]">
                  {(
                    [
                      { id: false as const, label: "Manter" },
                      { id: "automatico" as const, label: "Rápido" },
                      { id: "inteligente" as const, label: "Refinado" },
                      { id: "manual" as const, label: "Pincel" },
                    ]
                  ).map((opt) => {
                    const active = globalCutout === opt.id;
                    return (
                      <button
                        key={String(opt.id)}
                        type="button"
                        onClick={() => handleSelectGlobalCutout(opt.id)}
                        className={`flex-1 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                          active
                            ? "bg-[#0B3B46] font-semibold text-[#FDE2B9] ring-1 ring-inset ring-[#BC9200]"
                            : "text-[#3B0011] hover:bg-[#F4D09A]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Grupo 4: Nome do lote */}
            <BatchRename
              rule={renameRule}
              onChange={setRenameRule}
              sampleExtension={IMAGE_FORMAT_EXT[images[0]?.formato || batchFormat]}
              sampleOriginalBase={images[0]?.nomeBase || "foto"}
              hasCustomNames={hasCustomNames}
              onResetCustomNames={() => updateAll(() => ({ nomePersonalizado: null }))}
            />

            {/* Fila de arquivos em linhas compactas */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] font-semibold text-[#3B0011]">Fila</span>
              </div>
              {images.map((item, index) => (
                <ImageCard
                  key={item.id}
                  item={item}
                  index={index}
                  renameRule={renameRule}
                  onSelectFormat={setRowFormat}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onZoom={(src, title, meta) => setLightbox({ src, title, meta })}
                />
              ))}
            </div>

            <ProcessingPanel
              visible={processing}
              percent={progressPct}
              statusText={progressText}
              stages={STAGES}
              activeStage={activeStage}
              queue={queue}
            />

            {/* Único botão principal curto + linha de resumo ao lado */}
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-4 rounded-[6px] bg-[#F4D09A] px-4 py-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#3B0011] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useZip}
                    onChange={(e) => setUseZip(e.target.checked)}
                    className="h-4 w-4 accent-[#60011D]"
                  />
                  Agrupar em ZIP
                </label>
                <span className="text-[13px] font-medium text-[#3B0011]">{summaryLine}</span>
              </div>

              <Button
                size="lg"
                disabled={processing}
                onClick={runBatch}
                className="bg-[#60011D] text-[#FDE2B9]"
              >
                {processing
                  ? "Revelando..."
                  : justFinished
                  ? "Pronto · baixar tudo"
                  : buttonLabel}
              </Button>
            </div>
          </div>
        )}

        {/* Resultados dentro da mesma folha principal */}
        {results.length > 0 && (
          <div ref={resultsRef} className="mt-8 border-t border-[#60011D]/20 pt-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-2xl font-semibold text-[#60011D]">
                  Resultado
                </h2>
                <span className="text-[13px] font-medium text-[#3B0011]">
                  {stats.ok === 1 ? "1 foto concluída" : `${stats.ok} fotos concluídas`} ·{" "}
                  {formatBytes(stats.origBytes)} → {formatBytes(stats.finalBytes)}
                  {stats.deltaPct > 0 ? ` (-${stats.deltaPct}%)` : ""}
                </span>
              </div>

              {lastZip && (
                <Button
                  size="sm"
                  onClick={() =>
                    triggerDownload(base64ToBlob(lastZip.base64, "application/zip"), lastZip.nome)
                  }
                  className="bg-[#60011D] text-[#FDE2B9]"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Baixar ZIP
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r, i) => {
                const resUrl = r.dados && r.mime ? `data:${r.mime};base64,${r.dados}` : "";
                return (
                  <div
                    key={`${r.nome}-${i}`}
                    className="overflow-hidden rounded-[6px] bg-[#F4D09A]/55 p-3"
                  >
                    {r.status === "ok" ? (
                      <>
                        <div className="aspect-[16/10] w-full overflow-hidden rounded-[6px] bg-[#FFF3DE]">
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

                        <div className="mt-2.5 flex items-baseline justify-between gap-2">
                          <span className="truncate font-mono text-[13px] font-semibold text-[#3B0011]">
                            {r.salvo_como}
                          </span>
                          <span className="shrink-0 text-[13px] text-[#3B0011]">
                            {r.dimensoes} · {r.tamanho_bytes ? formatBytes(r.tamanho_bytes) : ""}
                          </span>
                        </div>

                        {r.aviso && (
                          <p className="mt-1.5 text-[13px] text-[#3B0011]">{r.aviso}</p>
                        )}

                        <div className="mt-2.5 flex items-center justify-end gap-2">
                          {r.modoRemocao === "manual" && r.dados && (
                            <Button
                              size="sm"
                              variant="opposite"
                              onClick={() =>
                                setEditingMask({
                                  dadosBase64: r.dados!,
                                  mime: r.mime || "image/png",
                                  nomeArquivo: r.salvo_como || "imagem.png",
                                })
                              }
                            >
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
                              className="bg-[#60011D] text-[#FDE2B9]"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                              Baixar
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="font-mono text-[13px] font-semibold text-[#60011D]">
                          {r.nome}
                        </p>
                        <p className="mt-1 text-[13px] text-[#3B0011]">{r.mensagem}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

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
    </div>
  );
}
