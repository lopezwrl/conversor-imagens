import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Paintbrush,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
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
import { Input, Label } from "../../components/ui/Field";
import { BatchRename } from "../../components/shared/BatchRename";
import { ProcessingPanel } from "../../components/shared/ProcessingPanel";
import { ImageCard } from "./ImageCard";
import { BeforeAfter } from "./BeforeAfter";
import { MaskEditor } from "./MaskEditor";
import { Lightbox } from "./Lightbox";

const STAGES = [
  { id: "removendo_fundo", label: "Remover Fundo" },
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

  const [renameRule, setRenameRule] = useState<BatchRenameRule>({
    prefix: "",
    suffix: "",
    startNumber: 1,
    padDigits: 2,
    separator: "_",
  });

  // Seletores visuais simples em pílulas (sem poluição!)
  const [selectedFormat, setSelectedFormat] = useState<ImageOutputFormat | null>(null);
  const [sizePreset, setSizePreset] = useState<SizePreset>("original");
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const [globalCutout, setGlobalCutout] = useState<false | CutoutMode>(false);

  // Reage à rota clicada no Portal (ex: #/fotos?acao=recorte)
  useEffect(() => {
    if (activeRouteAction === "recorte") {
      setGlobalCutout("inteligente");
      setSelectedFormat("PNG");
      updateAll(() => ({ removerFundo: true, modoRemocao: "inteligente", formato: "PNG" }));
    } else if (activeRouteAction === "redimensionar") {
      setSizePreset("catalogo");
      updateAll(() => ({ largura: "1200", altura: "1200", manterProporcao: true }));
    } else if (activeRouteAction === "converter") {
      setSelectedFormat("WEBP");
      updateAll(() => ({ formato: "WEBP", qualidade: 85 }));
    }
  }, [activeRouteAction, updateAll]);

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
        notify(`${added} ${added === 1 ? "foto adicionada" : "fotos adicionadas"}.`, "ok");
      } else {
        notify("Essas fotos já estão na bancada.", "neutral");
      }
      return;
    }

    if (docs.length > 0) {
      await addDocs(docs, fn, hasFolder);
      navigate("docs");
      notify("Documento enviado para a seção Documentos.", "neutral");
      return;
    }

    notify("Nenhuma imagem compatível encontrada.", "warn");
  };

  // Ações de 1 clique na barra visual
  const handleSelectBatchFormat = (fmt: ImageOutputFormat) => {
    setSelectedFormat(fmt);
    updateAll(() => ({ formato: fmt }));
    notify(`Formato ${fmt} aplicado em todas as fotos.`, "ok");
  };

  const handleSelectSizePreset = (preset: SizePreset) => {
    setSizePreset(preset);
    if (preset === "original") {
      updateAll(() => ({ largura: "", altura: "", manterProporcao: true, modoAjuste: "inside" }));
      notify("Tamanho original mantido.", "ok");
    } else if (preset === "half") {
      updateAll((img) => ({
        largura: String(Math.max(1, Math.round(img.larguraOriginal / 2))),
        altura: String(Math.max(1, Math.round(img.alturaOriginal / 2))),
        manterProporcao: true,
        modoAjuste: "inside",
      }));
      notify("Redução de 50% aplicada em todas as fotos.", "ok");
    } else if (preset === "catalogo") {
      updateAll(() => ({
        largura: "1200",
        altura: "1200",
        manterProporcao: true,
        modoAjuste: "inside",
      }));
      notify("Medida Catálogo (1200×1200) aplicada.", "ok");
    } else if (preset === "quadrado") {
      updateAll(() => ({
        largura: "1080",
        altura: "1080",
        manterProporcao: true,
        modoAjuste: "cover",
      }));
      notify("Medida Quadrado (1080×1080) aplicada.", "ok");
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
      notify("Remoção de fundo desativada no lote.", "neutral");
    } else {
      updateAll((img) => ({
        removerFundo: true,
        modoRemocao: mode,
        formato: img.formato === "JPEG" ? "PNG" : img.formato,
      }));
      notify("Remoção de fundo ativada em todas as fotos.", "ok");
    }
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
      notify("Modo pincel ativo: entrega individual habilitada para retoque.", "neutral");
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
        notify(`${okCount} ${okCount === 1 ? "foto revelada" : "fotos reveladas"}.`, "ok");
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
      className="mx-auto max-w-7xl px-4 py-5 sm:px-8"
    >
      {/* Barra Topo em Creme (#FDE2B9) com Borda Dourada (#BC9200): Tudo super visível! */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] px-6 py-4 text-[#60011D] shadow-2xl">
        <div>
          <span className="rounded bg-[#0B3B46] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#FDE2B9]">
            01 · Estúdio de Fotos
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold text-[#60011D] sm:text-4xl">
            Transformar Imagens
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4" />
            Adicionar Fotos
          </Button>
          <Button variant="secondary" onClick={() => folderInputRef.current?.click()}>
            <FolderOpen className="h-4 w-4" />
            Pasta
          </Button>
          {images.length > 0 && (
            <Button variant="opposite" size="lg" disabled={processing} onClick={runBatch}>
              <Sparkles className="h-4 w-4 text-[#BC9200]" />
              {processing ? "Revelando..." : `Revelar ${images.length} Foto(s)`}
            </Button>
          )}
        </div>
      </div>

      {/* Estado vazio: Ficha Creme grande e luminosa sobre o Rio */}
      {images.length === 0 && (
        <div className="my-8 rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] p-10 text-center text-[#60011D] shadow-2xl sm:p-14">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#BC9200] bg-[#60011D] text-[#FDE2B9] shadow-lg">
            <ImageIcon className="h-8 w-8 text-[#BC9200]" />
          </div>
          <h2 className="font-display text-3xl font-bold text-[#60011D] sm:text-4xl">
            Solte suas fotos ou uma pasta inteira aqui
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-[#60011D]/80">
            Converta entre PNG, JPEG, WEBP, AVIF, GIF e TIFF, redimensione em massa e remova o fundo em segundos.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4 text-[#BC9200]" />
              Escolher Fotos
            </Button>
            <Button size="lg" variant="opposite" onClick={() => folderInputRef.current?.click()}>
              <FolderOpen className="h-4 w-4 text-[#BC9200]" />
              Escolher Pasta Inteira
            </Button>
          </div>
        </div>
      )}

      {/* Painel de Lote Simplificado em Creme (#FDE2B9): Pílulas grandes de 1 clique! */}
      {images.length > 0 && (
        <section className="mb-7 space-y-4 rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] p-5 text-[#60011D] shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#60011D]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-[#60011D] px-3 py-1 font-mono text-xs font-bold text-[#FDE2B9]">
                {images.length} foto(s)
              </span>
              <h2 className="font-display text-xl font-bold text-[#60011D]">
                Ajuste Rápido para Todas
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                clearAll();
                setResults([]);
                setLastZip(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#60011D] px-3 py-1.5 font-mono text-xs font-bold text-[#FDE2B9] hover:bg-[#7d0428] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar Tudo
            </button>
          </div>

          {/* Linha 1: Converter Formato com 1 clique */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] p-3.5">
              <span className="mb-2 block font-mono text-xs font-bold uppercase text-[#60011D]">
                1. Formato de Saída (1 clique)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {IMAGE_FORMATS.map((fmt) => {
                  const active = selectedFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => handleSelectBatchFormat(fmt)}
                      className={`rounded-lg border-2 py-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? "border-[#BC9200] bg-[#60011D] text-[#FDE2B9] shadow-md"
                          : "border-[#60011D]/20 bg-[#FDE2B9] text-[#60011D] hover:border-[#60011D]"
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linha 2: Redimensionar com 1 clique */}
            <div className="rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] p-3.5">
              <span className="mb-2 block font-mono text-xs font-bold uppercase text-[#60011D]">
                2. Tamanho das Fotos
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "original", label: "Original" },
                    { id: "half", label: "Reduzir 50%" },
                    { id: "catalogo", label: "Catálogo 1200" },
                    { id: "quadrado", label: "Quadrado 1080" },
                    { id: "custom", label: "Medida Exata..." },
                  ] as const
                ).map((p) => {
                  const active = sizePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectSizePreset(p.id)}
                      className={`rounded-lg border-2 px-2.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                        p.id === "custom" ? "col-span-2" : ""
                      } ${
                        active
                          ? "border-[#BC9200] bg-[#60011D] text-[#FDE2B9] shadow-md"
                          : "border-[#60011D]/20 bg-[#FDE2B9] text-[#60011D] hover:border-[#60011D]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {sizePreset === "custom" && (
                <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[#BC9200]/40 pt-2.5">
                  <div>
                    <Label>Largura (px)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 800"
                      className="font-mono"
                      value={customW}
                      onChange={(e) => handleApplyCustomDimensions(e.target.value, customH)}
                    />
                  </div>
                  <div>
                    <Label>Altura (px)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 800"
                      className="font-mono"
                      value={customH}
                      onChange={(e) => handleApplyCustomDimensions(customW, e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Linha 3: Remover Fundo com 1 clique (Acende em Petróleo #0B3B46!) */}
            <div className="rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] p-3.5">
              <span className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-[#0B3B46]">
                <Scissors className="h-3.5 w-3.5" />
                3. Fundo da Imagem
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: false as const, label: "Manter Fundo" },
                    { id: "automatico" as const, label: "Remover (Rápido)" },
                    { id: "inteligente" as const, label: "Remover (Refinado)" },
                    { id: "manual" as const, label: "Remover + Pincel" },
                  ]
                ).map((opt) => {
                  const active = globalCutout === opt.id;
                  return (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => handleSelectGlobalCutout(opt.id)}
                      className={`rounded-lg border-2 px-2.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? "border-[#BC9200] bg-[#0B3B46] text-[#FDE2B9] shadow-md"
                          : "border-[#0B3B46]/25 bg-[#FDE2B9] text-[#0B3B46] hover:border-[#0B3B46]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Linha 4: Renomear em Lote + Opção ZIP + Botão Revelar */}
          <BatchRename
            rule={renameRule}
            onChange={setRenameRule}
            sampleExtension={IMAGE_FORMAT_EXT[images[0]?.formato || "PNG"]}
            sampleOriginalBase={images[0]?.nomeBase || "foto"}
            hasCustomNames={hasCustomNames}
            onResetCustomNames={() => updateAll(() => ({ nomePersonalizado: null }))}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2.5 text-xs font-bold text-[#60011D] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useZip}
                onChange={(e) => setUseZip(e.target.checked)}
                className="h-4 w-4 accent-[#60011D]"
              />
              Baixar tudo junto em um arquivo .ZIP (também permite baixar individualmente)
            </label>

            <Button variant="opposite" size="lg" disabled={processing} onClick={runBatch}>
              <Sparkles className="h-4 w-4 text-[#BC9200]" />
              {processing ? "Processando..." : `Revelar ${images.length} Foto(s) Agora`}
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

      {/* Grade de Cartões Creme */}
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

      {/* Resultados Revelados em Ficha Creme */}
      {results.length > 0 && (
        <section
          ref={resultsRef}
          className="rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] p-6 text-[#60011D] shadow-2xl"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#60011D]/15 pb-4">
            <div>
              <span className="rounded bg-[#0B3B46] px-2.5 py-1 font-mono text-xs font-bold text-[#FDE2B9]">
                Concluído · {stats.ok} de {stats.total}
              </span>
              <h2 className="mt-1.5 font-display text-3xl font-bold text-[#60011D]">
                Fotos Reveladas
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-lg border border-[#BC9200] bg-[#FFF3DE] px-3 py-1.5 font-mono text-xs font-bold text-[#0B3B46]">
                {formatBytes(stats.origBytes)} → {formatBytes(stats.finalBytes)}
                {stats.deltaPct > 0 ? ` (-${stats.deltaPct}%)` : ""}
              </span>
              {lastZip && (
                <Button
                  onClick={() =>
                    triggerDownload(base64ToBlob(lastZip.base64, "application/zip"), lastZip.nome)
                  }
                >
                  <Archive className="h-4 w-4" />
                  Baixar ZIP
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  clearAll();
                  setResults([]);
                  setLastZip(null);
                }}
              >
                Novo Lote
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => {
              const resUrl = r.dados && r.mime ? `data:${r.mime};base64,${r.dados}` : "";
              return (
                <article
                  key={`${r.nome}-${i}`}
                  className="overflow-hidden rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] shadow-md"
                >
                  {r.status === "ok" ? (
                    <>
                      <div className="aspect-[16/10] w-full overflow-hidden border-b-2 border-[#BC9200]">
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
                        <div className="flex items-baseline justify-between gap-2 font-mono text-xs font-bold">
                          <span className="truncate text-[#60011D]">{r.salvo_como}</span>
                          <span className="shrink-0 text-[11px] text-[#0B3B46]">
                            {r.dimensoes} · {r.tamanho_bytes ? formatBytes(r.tamanho_bytes) : ""}
                          </span>
                        </div>

                        {r.aviso && (
                          <p className="mt-2 rounded-lg border border-[#BC9200] bg-[#FDE2B9] p-2 font-mono text-[10px] font-semibold text-[#60011D]">
                            {r.aviso}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#BC9200]/40 pt-2.5">
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
                              <Paintbrush className="h-3.5 w-3.5" />
                              Pincel
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
                              <Download className="h-3.5 w-3.5" />
                              Baixar
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-4">
                      <p className="font-mono text-xs font-bold text-[#60011D]">{r.nome}</p>
                      <p className="mt-1 text-xs font-medium text-[#60011D]/80">{r.mensagem}</p>
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
