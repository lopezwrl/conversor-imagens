import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Check,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Maximize2,
  Paintbrush,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type {
  BatchRenameConfig,
  ImageItem,
  ImageOutputFormat,
  ImageProcessResult,
  QueueItemState,
  RemovalMode,
} from "../../types/revela";
import {
  DOC_EXTENSIONS,
  IMAGE_EXTENSIONS,
  IMAGE_OUTPUT_EXT,
  base64ToBlob,
  computeTargetBaseName,
  downloadBlob,
  extractFilesFromDataTransfer,
  formatBytes,
  getExtension,
  readNdjsonStream,
} from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import { BorderBeamCard, ConfettiBurst, MagneticButton } from "../ui/MotionPrimitives";
import { BatchRenameBar } from "../shared/BatchRenameBar";
import { ProcessingQueue } from "../shared/ProcessingQueue";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { MaskEditorModal } from "./MaskEditorModal";
import { LightboxModal } from "./LightboxModal";

interface ImageWorkspaceProps {
  images: ImageItem[];
  folderName: string;
  usarZip: boolean;
  setUsarZip: (v: boolean) => void;
  onAddFiles: (files: File[], folderName?: string | null, hasFolder?: boolean) => Promise<void>;
  onRedirectDocs: (files: File[]) => void;
  onUpdateImage: (id: string, patch: Partial<ImageItem>) => void;
  onUpdateAllImages: (updater: (img: ImageItem) => Partial<ImageItem>) => void;
  onRemoveImage: (id: string) => void;
  onClearAll: () => void;
}

const FORMATOS_SAIDA: ImageOutputFormat[] = ["PNG", "JPEG", "WEBP", "AVIF", "GIF", "TIFF"];
const FORMATOS_SEM_ALPHA = new Set<ImageOutputFormat>(["JPEG", "GIF"]);

const IMAGE_STAGES = [
  { id: "removendo_fundo", label: "Remover Fundo" },
  { id: "redimensionando", label: "Redimensionar" },
  { id: "convertendo", label: "Converter" },
];

const STAGE_LABELS: Record<string, string> = {
  removendo_fundo: "Removendo fundo (CIELAB)...",
  redimensionando: "Redimensionando com LANCZOS3...",
  convertendo: "Convertendo formato e otimizando...",
};

const STAGE_WEIGHTS: Record<string, number> = {
  removendo_fundo: 0.2,
  redimensionando: 0.6,
  convertendo: 0.88,
};

export function ImageWorkspace({
  images,
  folderName,
  usarZip,
  setUsarZip,
  onAddFiles,
  onRedirectDocs,
  onUpdateImage,
  onUpdateAllImages,
  onRemoveImage,
  onClearAll,
}: ImageWorkspaceProps) {
  const { pushToast } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [dragActive, setDragActive] = useState(false);

  // Estado reativo de Renomeação em Lote (CORRIGIDO — sincronizado em tempo real!)
  const [batchRename, setBatchRename] = useState<BatchRenameConfig>({
    prefix: "",
    suffix: "",
    startNumber: 1,
    padDigits: 2,
    separator: "_",
  });

  // Controles rápidos de lote
  const [loteFormato, setLoteFormato] = useState<"" | ImageOutputFormat>("");
  const [loteLargura, setLoteLargura] = useState("");
  const [loteAltura, setLoteAltura] = useState("");
  const [loteQualidade, setLoteQualidade] = useState("90");
  const [loteProporcao, setLoteProporcao] = useState<"" | "on" | "off">("");
  const [loteRemoverFundo, setLoteRemoverFundo] = useState<"" | "on" | "off">("");
  const [loteModoRemocao, setLoteModoRemocao] = useState<"" | RemovalMode>("");

  // Estado de processamento
  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItemState[]>([]);
  const [results, setResults] = useState<ImageProcessResult[]>([]);
  const [lastZip, setLastZip] = useState<{ base64: string; nome: string } | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  // Modais
  const [editingMask, setEditingMask] = useState<{
    dadosBase64: string;
    mime: string;
    nomeArquivo: string;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string; meta: string } | null>(null);

  const hasIndividualNameOverrides = useMemo(
    () => images.some((i) => i.nomePersonalizado !== null && i.nomePersonalizado.trim() !== ""),
    [images]
  );

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const { files, folderName: fn, hasFolder } = await extractFilesFromDataTransfer(e.dataTransfer);
    if (!files.length) return;

    const imgs = files.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
    const docs = files.filter((f) => DOC_EXTENSIONS.has(getExtension(f.name)));

    if (imgs.length > 0) {
      await onAddFiles(imgs, fn, hasFolder);
    } else if (docs.length > 0) {
      pushToast("Documento detectado — redirecionando para o estúdio de Documentos!", "info");
      onRedirectDocs(docs);
    } else {
      pushToast("Nenhuma imagem válida encontrada.", "warning");
    }
  };

  // Presets rápidos (trazendo o melhor do remoto + e-commerce)
  const applyPreset = (preset: "web" | "ecommerce" | "social" | "half" | "lossless" | "cutout") => {
    if (!images.length) {
      pushToast("Adicione imagens primeiro para aplicar um preset.", "warning");
      return;
    }

    if (preset === "web") {
      onUpdateAllImages(() => ({ formato: "WEBP", qualidade: 82, manterProporcao: true }));
      pushToast("Preset 'Web Otimizado' aplicado (WEBP · 82%)!", "success");
    } else if (preset === "ecommerce") {
      onUpdateAllImages(() => ({
        formato: "JPEG",
        largura: "1200",
        altura: "1200",
        qualidade: 90,
        manterProporcao: true,
        modoAjuste: "inside",
        corFundo: "#ffffff",
      }));
      pushToast("Preset 'E-commerce Catálogo' aplicado (1200×1200 · JPEG 90%)!", "success");
    } else if (preset === "social") {
      onUpdateAllImages(() => ({
        formato: "JPEG",
        largura: "1080",
        altura: "1080",
        qualidade: 90,
        manterProporcao: true,
        modoAjuste: "cover",
      }));
      pushToast("Preset 'Instagram Quadrado' aplicado (1080×1080 · recorte preenchido)!", "success");
    } else if (preset === "half") {
      onUpdateAllImages((img) => ({
        largura: String(Math.max(1, Math.round(img.larguraOriginal / 2))),
        altura: String(Math.max(1, Math.round(img.alturaOriginal / 2))),
        qualidade: 85,
        manterProporcao: true,
      }));
      pushToast("Preset 'Reduzir 50%' aplicado em todas as fotos!", "success");
    } else if (preset === "lossless") {
      onUpdateAllImages(() => ({ formato: "PNG", qualidade: 100, manterProporcao: true }));
      pushToast("Preset 'Máxima Nitidez' aplicado (PNG sem perda)!", "success");
    } else if (preset === "cutout") {
      onUpdateAllImages(() => ({
        formato: "PNG",
        removerFundo: true,
        modoRemocao: "inteligente",
      }));
      pushToast("Preset 'Recorte de Produto' aplicado (PNG + Remoção Inteligente)!", "success");
    }
  };

  const applyBatchControls = () => {
    onUpdateAllImages((img) => ({
      formato: loteFormato || img.formato,
      largura: loteLargura !== "" ? loteLargura : img.largura,
      altura: loteAltura !== "" ? loteAltura : img.altura,
      qualidade: loteQualidade ? Math.max(1, Math.min(100, Number(loteQualidade))) : img.qualidade,
      manterProporcao: loteProporcao ? loteProporcao === "on" : img.manterProporcao,
      removerFundo: loteRemoverFundo ? loteRemoverFundo === "on" : img.removerFundo,
      modoRemocao: loteModoRemocao || img.modoRemocao,
    }));
    pushToast("Ajustes aplicados em todas as imagens do lote!", "success");
  };

  const handleConvert = async () => {
    if (!images.length || processing) return;

    setProcessing(true);
    setProgressPct(2);
    setProgressText("Preparando envio...");
    setActiveStage(null);
    setResults([]);
    setLastZip(null);
    setQueue(images.map((img, i) => ({ nome: img.nome, status: i === 0 ? "processando" : "pendente" })));

    const formData = new FormData();
    const config: Record<string, unknown> = {};
    let algumModoManual = false;

    images.forEach((img, index) => {
      formData.append("arquivos", img.file, img.nome);

      // Calcula nome final definitivo respeitando renomeação em lote + override individual!
      const nomeResolvido = computeTargetBaseName(img.nomeBase, img.nomePersonalizado, index, batchRename);
      if (img.removerFundo && img.modoRemocao === "manual") algumModoManual = true;

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
        novo_nome: nomeResolvido,
      };
    });

    const zipAtivo = usarZip && !algumModoManual;
    if (algumModoManual && usarZip) {
      pushToast("Modo Manual ativo: entregando itens individualmente para correção no pincel.", "info");
    }

    formData.append("config", JSON.stringify(config));
    formData.append("usar_zip", String(zipAtivo));
    formData.append("nome_zip", `${folderName || "revela"}_imagens.zip`);

    const collected: ImageProcessResult[] = [];
    let zipRecebido: { base64: string; nome: string } | null = null;

    try {
      const response = await fetch("/api/images/batch", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ erro: "Falha no servidor ao processar imagens." }));
        pushToast(err.erro || "Erro ao processar lote.", "error");
        return;
      }

      let currentQueueIdx = 0;
      const completed = await readNdjsonStream<any>(response, (evt) => {
        if (evt.tipo === "progresso") {
          const base = (evt.indice - 1) / evt.total;
          const frac = (STAGE_WEIGHTS[evt.etapa] ?? 0.9) / evt.total;
          setProgressPct(Math.min(99, Math.round((base + frac) * 100)));
          setProgressText(`Imagem ${evt.indice} de ${evt.total} — ${STAGE_LABELS[evt.etapa] || "Processando..."}`);
          setActiveStage(evt.etapa);
        } else if (evt.tipo === "resultado") {
          const origImg = images[evt.indice ?? currentQueueIdx];
          const itemRes: ImageProcessResult = {
            ...evt,
            modoRemocao: origImg?.removerFundo ? origImg.modoRemocao : null,
            urlOriginal: origImg?.urlMiniatura,
            tamanhoOriginalBytes: origImg?.tamanhoBytes,
          };
          collected.push(itemRes);

          const finishedIdx = currentQueueIdx;
          currentQueueIdx++;
          setQueue((prev) =>
            prev.map((q, i) =>
              i === finishedIdx
                ? { ...q, status: evt.status === "ok" ? "concluida" : "erro" }
                : i === currentQueueIdx
                ? { ...q, status: "processando" }
                : q
            )
          );

          // Download imediato quando não está em ZIP (e não está em modo manual)
          if (evt.status === "ok" && !zipAtivo && evt.dados && itemRes.modoRemocao !== "manual") {
            downloadBlob(base64ToBlob(evt.dados, evt.mime), evt.salvo_como);
          }
        } else if (evt.tipo === "concluido") {
          setProgressPct(100);
          setProgressText("Lote revelado com sucesso!");
          if (zipAtivo && evt.zip_base64) {
            zipRecebido = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_imagens.zip" };
            setLastZip(zipRecebido);
            downloadBlob(base64ToBlob(evt.zip_base64, "application/zip"), zipRecebido.nome);
          }
        }
      });

      if (!completed && collected.length > 0) {
        pushToast(
          `Conexão interrompida: ${collected.length} de ${images.length} imagem(ns) foram salvas.`,
          "warning"
        );
      }

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        setConfettiTrigger((c) => c + 1);
        pushToast(`${okCount} imagem(ns) revelada(s) com sucesso!`, "success");
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 180);
      }
    } catch {
      pushToast("Erro de comunicação com o servidor Node. Verifique se a API está rodando.", "error");
    } finally {
      setProcessing(false);
    }
  };

  // Estatísticas dos resultados
  const stats = useMemo(() => {
    const ok = results.filter((r) => r.status === "ok");
    const err = results.length - ok.length;
    const origBytes = ok.reduce((acc, r) => acc + (r.tamanhoOriginalBytes || 0), 0);
    const finalBytes = ok.reduce((acc, r) => acc + (r.tamanho_bytes || 0), 0);
    const reduction = origBytes > 0 ? Math.round((1 - finalBytes / origBytes) * 1000) / 10 : 0;
    return { total: results.length, ok: ok.length, err, origBytes, finalBytes, reduction };
  }, [results]);

  return (
    <motion.div
      key="photos-workspace"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-7xl px-4 py-7 sm:px-6"
    >
      <ConfettiBurst trigger={confettiTrigger} />

      {/* Dropzone com Border Beam */}
      <BorderBeamCard
        active={dragActive}
        className="mb-6"
        innerClassName="p-6 sm:p-8"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/50 px-5 py-7 text-center sm:flex-row sm:text-left"
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <motion.div
              animate={{ y: dragActive ? -5 : [0, -4, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
            >
              <Upload className="h-6 w-6" />
            </motion.div>
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                {images.length ? "Adicionar mais fotos ao lote" : "Solte suas fotos ou pastas aqui"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Suporta PNG, JPEG, WEBP, AVIF, GIF, TIFF e BMP · Deduplicação automática via SHA-256
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <MagneticButton size="sm" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="h-4 w-4" />
              Escolher fotos
            </MagneticButton>
            <MagneticButton size="sm" variant="secondary" onClick={() => folderInputRef.current?.click()}>
              <FolderOpen className="h-4 w-4" />
              Pasta inteira
            </MagneticButton>
          </div>
        </div>
      </BorderBeamCard>

      {/* Painel de Lote + Presets + Renomeação */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-7 space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-md)] sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold revela-shimmer">Ajustes em Lote</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {images.length} imagem(ns) na fila · Configure todas de uma vez ou ajuste cada card individualmente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setResults([]);
                  setLastZip(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--status-error)] hover:bg-[var(--status-error)]/20 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar tudo
              </button>
            </div>

            {/* Presets Rápidos */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                <Zap className="h-3.5 w-3.5" />
                Presets Rápidos (1 clique)
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { id: "web" as const, tag: "Rápido", title: "Web Otimizado", sub: "WEBP · 82%" },
                  { id: "ecommerce" as const, tag: "Loja", title: "E-commerce", sub: "1200×1200 · JPG" },
                  { id: "social" as const, tag: "Social", title: "Instagram", sub: "1080×1080 · Cover" },
                  { id: "half" as const, tag: "Leve", title: "Reduzir 50%", sub: "Metade px · 85%" },
                  { id: "lossless" as const, tag: "Fidelidade", title: "Alta Nitidez", sub: "PNG · 100%" },
                  { id: "cutout" as const, tag: "Recorte", title: "Sem Fundo", sub: "PNG · Inteligente" },
                ].map((p) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => applyPreset(p.id)}
                    className="flex flex-col items-start rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/75 p-3 text-left transition-colors hover:border-[var(--accent)] cursor-pointer"
                  >
                    <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-[var(--accent-text)]">
                      {p.tag}
                    </span>
                    <strong className="mt-1.5 text-xs font-bold text-[var(--text-primary)]">{p.title}</strong>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">{p.sub}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Renomeação em Lote (Corrigida & Reativa!) */}
            <BatchRenameBar
              value={batchRename}
              onChange={setBatchRename}
              sampleExtension={IMAGE_OUTPUT_EXT[images[0]?.formato || "PNG"]}
              sampleOriginalBase={images[0]?.nomeBase || "foto"}
              hasIndividualOverrides={hasIndividualNameOverrides}
              onResetIndividualOverrides={() => onUpdateAllImages(() => ({ nomePersonalizado: null }))}
            />

            {/* Grade de Parâmetros em Lote */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8 items-end">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Formato
                </label>
                <select
                  className="revela-select text-xs"
                  value={loteFormato}
                  onChange={(e) => setLoteFormato(e.target.value as "" | ImageOutputFormat)}
                >
                  <option value="">Manter atual</option>
                  {FORMATOS_SAIDA.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Largura (px)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="Auto"
                  className="revela-input font-mono text-xs"
                  value={loteLargura}
                  onChange={(e) => setLoteLargura(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Altura (px)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="Auto"
                  className="revela-input font-mono text-xs"
                  value={loteAltura}
                  onChange={(e) => setLoteAltura(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Qualidade
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="revela-input font-mono text-xs"
                  value={loteQualidade}
                  onChange={(e) => setLoteQualidade(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Proporção
                </label>
                <select
                  className="revela-select text-xs"
                  value={loteProporcao}
                  onChange={(e) => setLoteProporcao(e.target.value as "" | "on" | "off")}
                >
                  <option value="">Não alterar</option>
                  <option value="on">Manter</option>
                  <option value="off">Esticar livre</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Remover fundo
                </label>
                <select
                  className="revela-select text-xs"
                  value={loteRemoverFundo}
                  onChange={(e) => setLoteRemoverFundo(e.target.value as "" | "on" | "off")}
                >
                  <option value="">Não alterar</option>
                  <option value="on">Ativar todas</option>
                  <option value="off">Desativar</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Modo recorte
                </label>
                <select
                  className="revela-select text-xs"
                  value={loteModoRemocao}
                  onChange={(e) => setLoteModoRemocao(e.target.value as "" | RemovalMode)}
                >
                  <option value="">Não alterar</option>
                  <option value="automatico">Automático</option>
                  <option value="inteligente">Inteligente</option>
                  <option value="manual">Manual (Pincel)</option>
                </select>
              </div>
              <MagneticButton size="sm" variant="secondary" onClick={applyBatchControls} className="h-[38px] w-full">
                <Sliders className="h-3.5 w-3.5" />
                Aplicar
              </MagneticButton>
            </div>

            <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={usarZip}
                onChange={(e) => setUsarZip(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--brand)]"
              />
              Empacotar resultados em um único arquivo <strong>.ZIP</strong> (você ainda pode baixar cada foto individualmente nos resultados!)
            </label>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Grade de Cards de Imagens */}
      {images.length > 0 && (
        <section className="mb-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {images.map((img, index) => {
                const resolvedBase = computeTargetBaseName(img.nomeBase, img.nomePersonalizado, index, batchRename);
                const resolvedFull = `${resolvedBase}.${IMAGE_OUTPUT_EXT[img.formato]}`;
                const needsBgColor = img.removerFundo && FORMATOS_SEM_ALPHA.has(img.formato);

                return (
                  <motion.article
                    key={img.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)]"
                  >
                    {/* Miniatura */}
                    <div
                      className={`relative aspect-[16/10] overflow-hidden ${
                        img.removerFundo ? "checkerboard" : "bg-[var(--bg-surface)]"
                      }`}
                    >
                      <img
                        src={img.urlMiniatura}
                        alt={img.nome}
                        loading="lazy"
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveImage(img.id)}
                        aria-label="Remover imagem"
                        className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:rotate-90 hover:bg-[var(--status-error)] cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: img.urlMiniatura,
                            title: resolvedFull,
                            meta: `${img.larguraOriginal}×${img.alturaOriginal}px · ${formatBytes(img.tamanhoBytes)}`,
                          })
                        }
                        aria-label="Ampliar imagem"
                        className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 text-[#FDE2B9] opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-black/85 cursor-pointer"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                      {img.removerFundo && (
                        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--brand)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--brand-foreground)] shadow-md">
                          <Scissors className="h-2.5 w-2.5" />
                          Sem fundo · {img.modoRemocao}
                        </span>
                      )}
                    </div>

                    {/* Metadados */}
                    <div className="border-b border-[var(--border)] px-4 py-3">
                      <p className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]" title={img.nome}>
                        {img.nome}
                      </p>
                      <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-[var(--text-muted)]">
                        <span>
                          {img.larguraOriginal}×{img.alturaOriginal}px · {formatBytes(img.tamanhoBytes)}
                        </span>
                        <span className="text-[var(--accent-text)] font-semibold">→ {resolvedFull}</span>
                      </div>
                    </div>

                    {/* Controles Individuais */}
                    <div className="grid grid-cols-2 gap-2.5 p-4">
                      <div className="col-span-2">
                        <div className="mb-1 flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            Nome de saída {img.nomePersonalizado !== null ? "(editado)" : "(lote)"}
                          </label>
                          {img.nomePersonalizado !== null && (
                            <button
                              type="button"
                              onClick={() => onUpdateImage(img.id, { nomePersonalizado: null })}
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                              Seguir lote
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          className="revela-input font-mono text-xs"
                          value={img.nomePersonalizado ?? ""}
                          placeholder={resolvedBase}
                          onChange={(e) =>
                            onUpdateImage(img.id, {
                              nomePersonalizado: e.target.value === "" ? null : e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Formato
                        </label>
                        <select
                          className="revela-select text-xs"
                          value={img.formato}
                          onChange={(e) => onUpdateImage(img.id, { formato: e.target.value as ImageOutputFormat })}
                        >
                          {FORMATOS_SAIDA.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Qualidade
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="revela-input font-mono text-xs"
                          value={img.qualidade}
                          onChange={(e) =>
                            onUpdateImage(img.id, { qualidade: Math.max(1, Math.min(100, Number(e.target.value) || 90)) })
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Largura
                        </label>
                        <input
                          type="number"
                          min={1}
                          placeholder={String(img.larguraOriginal)}
                          className="revela-input font-mono text-xs"
                          value={img.largura}
                          onChange={(e) => onUpdateImage(img.id, { largura: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Altura
                        </label>
                        <input
                          type="number"
                          min={1}
                          placeholder={String(img.alturaOriginal)}
                          className="revela-input font-mono text-xs"
                          value={img.altura}
                          onChange={(e) => onUpdateImage(img.id, { altura: e.target.value })}
                        />
                      </div>

                      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[var(--text-secondary)]">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={img.manterProporcao}
                            onChange={(e) => onUpdateImage(img.id, { manterProporcao: e.target.checked })}
                            className="accent-[var(--brand)]"
                          />
                          Manter proporção
                        </label>

                        <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={img.removerFundo}
                            onChange={(e) => onUpdateImage(img.id, { removerFundo: e.target.checked })}
                            className="accent-[var(--accent)]"
                          />
                          Remover fundo
                        </label>
                      </div>

                      {/* Opções avançadas de Remoção de Fundo */}
                      {img.removerFundo && (
                        <div className="col-span-2 space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/80 p-3">
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                { id: "automatico", title: "Automático", desc: "Fundo liso" },
                                { id: "inteligente", title: "Inteligente", desc: "Refino borda" },
                                { id: "manual", title: "Manual", desc: "Pincel fino" },
                              ] as const
                            ).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => onUpdateImage(img.id, { modoRemocao: m.id })}
                                className={`rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                                  img.modoRemocao === m.id
                                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                                    : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                                }`}
                              >
                                <span className="block text-[11px] font-bold">{m.title}</span>
                                <span className="block text-[9px] opacity-75">{m.desc}</span>
                              </button>
                            ))}
                          </div>

                          <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                            <span>Sensibilidade ({img.sensibilidadeFundo}%)</span>
                            <input
                              type="range"
                              min={10}
                              max={95}
                              value={img.sensibilidadeFundo}
                              onChange={(e) =>
                                onUpdateImage(img.id, { sensibilidadeFundo: Number(e.target.value) })
                              }
                              className="w-28 accent-[var(--accent)]"
                            />
                          </label>

                          {needsBgColor && (
                            <div className="space-y-2 border-t border-[var(--border)] pt-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                  Cor do fundo sólido ({img.formato})
                                </span>
                                <input
                                  type="color"
                                  value={img.corFundo}
                                  onChange={(e) => onUpdateImage(img.id, { corFundo: e.target.value })}
                                  className="h-7 w-10 rounded-md border border-[var(--border)] bg-transparent cursor-pointer"
                                />
                              </div>
                              <p className="flex items-start gap-1.5 rounded-lg bg-[var(--accent-soft)] p-2 text-[10px] leading-snug text-[var(--accent-text)]">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                {img.formato} não suporta transparência. Escolha a cor sólida ou troque para PNG/WEBP/AVIF.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Barra de Ação Principal ("Revelar") */}
      {images.length > 0 && (
        <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center shadow-[var(--shadow-md)]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <MagneticButton size="lg" disabled={processing} onClick={handleConvert} className="min-w-[230px]">
              {processing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Revelando...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-[#E4BA2C]" />
                  Revelar {images.length} {images.length === 1 ? "Imagem" : "Imagens"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </MagneticButton>

            <MagneticButton
              size="lg"
              variant="secondary"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              title="Adicionar mais imagens"
            >
              <Plus className="h-5 w-5" />
            </MagneticButton>
          </div>

          <ProcessingQueue
            visible={processing}
            percent={progressPct}
            statusText={progressText}
            stages={IMAGE_STAGES}
            activeStage={activeStage}
            queue={queue}
          />
        </section>
      )}

      {/* Central de Resultados */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.section
            ref={resultsRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-lg)]"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold revela-shimmer">Revelação Concluída</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Arraste o divisor sobre qualquer imagem para comparar o original com o resultado.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {lastZip && (
                  <MagneticButton
                    size="sm"
                    onClick={() => downloadBlob(base64ToBlob(lastZip.base64, "application/zip"), lastZip.nome)}
                  >
                    <Archive className="h-4 w-4" />
                    Baixar ZIP novamente
                  </MagneticButton>
                )}
                <MagneticButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onClearAll();
                    setResults([]);
                    setLastZip(null);
                  }}
                >
                  Processar novo lote
                </MagneticButton>
              </div>
            </div>

            {/* Chips de Estatísticas */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total</span>
                <p className="mt-1 font-mono text-xl font-bold text-[var(--text-primary)]">{stats.total}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Concluídas</span>
                <p className="mt-1 font-mono text-xl font-bold text-[var(--status-success)]">{stats.ok}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Erros</span>
                <p className="mt-1 font-mono text-xl font-bold text-[var(--status-error)]">{stats.err}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Peso Total</span>
                <p className="mt-1 font-mono text-sm font-bold text-[var(--accent-text)]">
                  {formatBytes(stats.origBytes)} → {formatBytes(stats.finalBytes)}
                </p>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {stats.reduction > 0
                    ? `${stats.reduction}% menor`
                    : stats.reduction < 0
                    ? `${Math.abs(stats.reduction)}% maior`
                    : "mesmo peso"}
                </span>
              </div>
            </div>

            {/* Cards de Resultado */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r, i) => {
                const resUrl = r.dados && r.mime ? `data:${r.mime};base64,${r.dados}` : "";
                return (
                  <motion.article
                    key={`${r.nome}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.35) }}
                    className={`overflow-hidden rounded-2xl border bg-[var(--bg-surface)] ${
                      r.status === "ok" ? "border-[var(--border)]" : "border-[var(--status-error)]/40"
                    }`}
                  >
                    {r.status === "ok" ? (
                      <>
                        <div className="aspect-[16/10] w-full overflow-hidden">
                          {r.urlOriginal && resUrl ? (
                            <BeforeAfterSlider
                              originalUrl={r.urlOriginal}
                              resultUrl={resUrl}
                              alt={r.salvo_como || r.nome}
                            />
                          ) : resUrl ? (
                            <img src={resUrl} alt={r.salvo_como} className="h-full w-full object-contain" />
                          ) : null}
                        </div>

                        <div className="p-4">
                          <p className="truncate font-mono text-xs font-bold text-[var(--text-primary)]">
                            {r.salvo_como}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {r.dimensoes && (
                              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                                {r.dimensoes}
                              </span>
                            )}
                            {r.tamanho_bytes && (
                              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                                {formatBytes(r.tamanho_bytes)}
                              </span>
                            )}
                          </div>

                          {r.aviso && (
                            <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-[var(--accent-soft)] p-2 text-[10px] leading-snug text-[var(--accent-text)]">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              {r.aviso}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-success)]">
                              <Check className="h-3.5 w-3.5" />
                              Pronta
                            </span>

                            <div className="flex items-center gap-1.5">
                              {r.modoRemocao === "manual" && r.dados && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingMask({
                                      dadosBase64: r.dados!,
                                      mime: r.mime || "image/png",
                                      nomeArquivo: r.salvo_como || "imagem.png",
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--accent-text)] hover:brightness-110 cursor-pointer"
                                >
                                  <Paintbrush className="h-3 w-3" />
                                  Editar máscara
                                </button>
                              )}
                              {r.dados && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadBlob(
                                      base64ToBlob(r.dados!, r.mime || "application/octet-stream"),
                                      r.salvo_como || r.nome
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer"
                                  style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
                                  title="Baixar imagem individualmente"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Baixar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-4">
                        <p className="font-mono text-xs font-bold text-[var(--status-error)]">{r.nome}</p>
                        <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{r.mensagem}</p>
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Modais */}
      <AnimatePresence>
        {editingMask && (
          <MaskEditorModal
            dadosBase64={editingMask.dadosBase64}
            mime={editingMask.mime}
            nomeArquivo={editingMask.nomeArquivo}
            onClose={() => setEditingMask(null)}
          />
        )}
        {lightbox && (
          <LightboxModal
            src={lightbox.src}
            title={lightbox.title}
            meta={lightbox.meta}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      {/* Inputs Ocultos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) onAddFiles(list, "fotos_selecionadas", false);
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
            onAddFiles(list, folder, true);
          }
          e.target.value = "";
        }}
      />
    </motion.div>
  );
}
