import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Combine,
  Download,
  Eye,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type {
  BatchRenameConfig,
  DocItem,
  DocOutputFormat,
  DocProcessResult,
  QueueItemState,
} from "../../types/revela";
import {
  DOC_ACCEPTED_EXTENSIONS,
  DOC_OUTPUT_EXT,
  base64ToBlob,
  computeTargetBaseName,
  downloadBlob,
  extractFilesFromDataTransfer,
  formatBytes,
  formatDocFormatLabel,
  getDocTargetFormats,
  getExtension,
  readNdjsonStream,
} from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import { BorderBeamCard, ConfettiBurst, MagneticButton } from "../ui/MotionPrimitives";
import { BatchRenameBar } from "../shared/BatchRenameBar";
import { ProcessingQueue } from "../shared/ProcessingQueue";

interface DocumentWorkspaceProps {
  docs: DocItem[];
  folderName: string;
  usarZip: boolean;
  setUsarZip: (v: boolean) => void;
  onAddFiles: (files: File[], folderName?: string | null, hasFolder?: boolean) => Promise<void>;
  onUpdateDoc: (id: string, patch: Partial<DocItem>) => void;
  onUpdateAllDocs: (updater: (doc: DocItem) => Partial<DocItem>) => void;
  onMoveDoc: (index: number, delta: -1 | 1) => void;
  onRemoveDoc: (id: string) => void;
  onClearAll: () => void;
}

const DOC_STAGES = [
  { id: "lendo", label: "Analisar" },
  { id: "convertendo", label: "Transformar" },
  { id: "finalizando", label: "Finalizar" },
];

const STAGE_LABELS: Record<string, string> = {
  lendo: "Lendo estrutura do documento...",
  convertendo: "Convertendo e diagramando...",
  finalizando: "Empacotando resultado...",
};

const STAGE_WEIGHTS: Record<string, number> = {
  lendo: 0.25,
  convertendo: 0.72,
  finalizando: 0.94,
};

function DocTypeBadge({ ext }: { ext: string }) {
  const e = ext.toLowerCase();
  if (["xlsx", "csv"].includes(e)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#0B3B46] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#FDE2B9]">
        <FileSpreadsheet className="h-3 w-3 text-[#E4BA2C]" />
        {e}
      </span>
    );
  }
  if (e === "json") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#0B3B46] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#FDE2B9]">
        <FileJson className="h-3 w-3 text-[#E4BA2C]" />
        JSON
      </span>
    );
  }
  if (["html", "htm", "md", "markdown"].includes(e)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#0B3B46] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#FDE2B9]">
        <FileCode2 className="h-3 w-3 text-[#E4BA2C]" />
        {e}
      </span>
    );
  }
  if (["png", "jpg", "jpeg", "webp"].includes(e)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#60011D] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#FDE2B9]">
        <ImageIcon className="h-3 w-3 text-[#E4BA2C]" />
        {e}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-[#0B3B46] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#FDE2B9]">
      <FileText className="h-3 w-3 text-[#E4BA2C]" />
      {e || "DOC"}
    </span>
  );
}

export function DocumentWorkspace({
  docs,
  folderName,
  usarZip,
  setUsarZip,
  onAddFiles,
  onUpdateDoc,
  onUpdateAllDocs,
  onMoveDoc,
  onRemoveDoc,
  onClearAll,
}: DocumentWorkspaceProps) {
  const { pushToast } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [dragActive, setDragActive] = useState(false);

  // Modo Mesclar tudo em 1 único PDF
  const [mergePdfMode, setMergePdfMode] = useState(false);
  const [mergedPdfName, setMergedPdfName] = useState("documento_unificado");

  // Renomeação em lote (mesmo motor reativo de Fotos!)
  const [batchRename, setBatchRename] = useState<BatchRenameConfig>({
    prefix: "",
    suffix: "",
    startNumber: 1,
    padDigits: 2,
    separator: "_",
  });

  // Estado de processamento
  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItemState[]>([]);
  const [results, setResults] = useState<DocProcessResult[]>([]);
  const [lastZip, setLastZip] = useState<{ base64: string; nome: string } | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  // Preview inline para PDFs/HTML/TXT gerados
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string; mime: string; text?: string } | null>(null);

  const hasIndividualNameOverrides = useMemo(
    () => docs.some((d) => d.nomePersonalizado !== null && d.nomePersonalizado.trim() !== ""),
    [docs]
  );

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const { files, folderName: fn, hasFolder } = await extractFilesFromDataTransfer(e.dataTransfer);
    const valid = files.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));
    if (!valid.length) {
      pushToast("Nenhum formato suportado encontrado (PDF, DOCX, XLSX, CSV, JSON, MD, HTML, TXT ou Imagens).", "warning");
      return;
    }
    await onAddFiles(valid, fn, hasFolder);
  };

  // Presets Rápidos de Documentos
  const applyDocPreset = (preset: "all_pdf" | "merge_pdf" | "split_pdf" | "to_txt" | "to_csv" | "to_json") => {
    if (!docs.length) {
      pushToast("Adicione documentos primeiro para aplicar um preset.", "warning");
      return;
    }

    if (preset === "merge_pdf") {
      setMergePdfMode(true);
      pushToast("Modo 'Juntar em 1 PDF' ativado! Reordene os cards se quiser.", "success");
      return;
    }

    setMergePdfMode(false);

    if (preset === "all_pdf") {
      onUpdateAllDocs(() => ({ formato: "PDF" }));
      pushToast("Todos os arquivos configurados para virar PDF!", "success");
    } else if (preset === "split_pdf") {
      let count = 0;
      onUpdateAllDocs((d) => {
        if (d.extensao === "pdf") {
          count++;
          return { formato: "PDF_SPLIT" };
        }
        return {};
      });
      pushToast(
        count ? `${count} PDF(s) configurados para dividir 1 página por arquivo!` : "Adicione um PDF para dividir páginas.",
        count ? "success" : "warning"
      );
    } else if (preset === "to_txt") {
      onUpdateAllDocs((d) => {
        const targets = getDocTargetFormats(d.extensao);
        return targets.includes("TXT") ? { formato: "TXT" } : {};
      });
      pushToast("Documentos compatíveis configurados para extrair texto (.txt)!", "success");
    } else if (preset === "to_csv") {
      let count = 0;
      onUpdateAllDocs((d) => {
        const targets = getDocTargetFormats(d.extensao);
        if (targets.includes("CSV")) {
          count++;
          return { formato: "CSV", delimitadorCsv: ";" };
        }
        return {};
      });
      pushToast(
        count ? `${count} planilha(s)/JSON configurados para CSV (Excel BR ';')!` : "Adicione XLSX ou JSON para exportar em CSV.",
        count ? "success" : "warning"
      );
    } else if (preset === "to_json") {
      let count = 0;
      onUpdateAllDocs((d) => {
        const targets = getDocTargetFormats(d.extensao);
        if (targets.includes("JSON")) {
          count++;
          return { formato: "JSON" };
        }
        return {};
      });
      pushToast(
        count ? `${count} planilha(s) configuradas para JSON estruturado!` : "Adicione XLSX ou CSV para converter em JSON.",
        count ? "success" : "warning"
      );
    }
  };

  const handleProcessDocs = async () => {
    if (!docs.length || processing) return;

    setProcessing(true);
    setProgressPct(4);
    setProgressText(mergePdfMode ? "Preparando unificação em PDF..." : "Preparando documentos...");
    setActiveStage("lendo");
    setResults([]);
    setLastZip(null);
    setQueue(docs.map((d, i) => ({ nome: d.nome, status: i === 0 ? "processando" : "pendente" })));

    const formData = new FormData();
    const config: Record<string, unknown> = {};

    docs.forEach((doc, index) => {
      formData.append("arquivos", doc.file, doc.nome);
      const nomeResolvido = computeTargetBaseName(doc.nomeBase, doc.nomePersonalizado, index, batchRename);

      config[String(index)] = {
        formato: doc.formato,
        novo_nome: nomeResolvido,
        rotacao: doc.rotacao,
        intervalo_paginas: doc.intervaloPaginas.trim() || null,
        tamanho_pagina: doc.tamanhoPagina,
        orientacao: doc.orientacao,
        delimitador_csv: doc.delimitadorCsv,
      };
    });

    const zipAtivo = !mergePdfMode && usarZip;
    formData.append("config", JSON.stringify(config));
    formData.append("usar_zip", String(zipAtivo));
    formData.append("mesclar_pdf", String(mergePdfMode));
    formData.append("nome_mesclado", mergedPdfName.trim() || "revela_unificado");
    formData.append("nome_zip", `${folderName || "revela"}_documentos.zip`);

    const collected: DocProcessResult[] = [];

    try {
      const response = await fetch("/api/documents/batch", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ erro: "Falha no servidor ao transformar documentos." }));
        pushToast(err.erro || "Erro ao transformar documentos.", "error");
        return;
      }

      const completed = await readNdjsonStream<any>(response, (evt) => {
        if (evt.tipo === "progresso") {
          const base = (evt.indice - 1) / evt.total;
          const frac = (STAGE_WEIGHTS[evt.etapa] ?? 0.7) / evt.total;
          setProgressPct(Math.min(99, Math.round((base + frac) * 100)));
          setProgressText(`Documento ${evt.indice} de ${evt.total} — ${STAGE_LABELS[evt.etapa] || "Processando..."}`);
          setActiveStage(evt.etapa);
          setQueue((prev) =>
            prev.map((q, i) =>
              i < evt.indice - 1
                ? { ...q, status: "concluida" }
                : i === evt.indice - 1
                ? { ...q, status: "processando" }
                : q
            )
          );
        } else if (evt.tipo === "resultado") {
          const origDoc = docs[evt.indice ?? 0];
          const resItem: DocProcessResult = {
            ...evt,
            tamanhoOriginalBytes: origDoc?.tamanhoBytes,
          };
          collected.push(resItem);

          if (evt.status === "ok" && !zipAtivo && evt.dados) {
            downloadBlob(base64ToBlob(evt.dados, evt.mime), evt.salvo_como);
          }

          if (!mergePdfMode && typeof evt.indice === "number") {
            setQueue((prev) =>
              prev.map((q, i) =>
                i === evt.indice
                  ? { ...q, status: evt.status === "ok" ? "concluida" : "erro" }
                  : q
              )
            );
          }
        } else if (evt.tipo === "concluido") {
          setProgressPct(100);
          setProgressText("Documentos transformados com sucesso!");
          setQueue((prev) => prev.map((q) => (q.status === "erro" ? q : { ...q, status: "concluida" })));
          if (zipAtivo && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_documentos.zip" };
            setLastZip(z);
            downloadBlob(base64ToBlob(z.base64, "application/zip"), z.nome);
          }
        }
      });

      if (!completed && collected.length > 0) {
        pushToast("Conexão interrompida antes do fim, mas os arquivos já prontos foram preservados.", "warning");
      }

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        setConfettiTrigger((c) => c + 1);
        pushToast(
          mergePdfMode
            ? `PDF unificado gerado com sucesso!`
            : `${okCount} arquivo(s) transformado(s) com sucesso!`,
          "success"
        );
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 180);
      }
    } catch {
      pushToast("Erro de comunicação com o servidor Node.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const openQuickPreview = (r: DocProcessResult) => {
    if (!r.dados || !r.mime) return;
    const blob = base64ToBlob(r.dados, r.mime);
    const url = URL.createObjectURL(blob);
    if (r.mime.startsWith("text/") || r.mime.includes("json")) {
      blob.text().then((text) => {
        setPreviewDoc({ title: r.salvo_como || r.nome, url, mime: r.mime!, text: text.slice(0, 16000) });
      });
    } else {
      setPreviewDoc({ title: r.salvo_como || r.nome, url, mime: r.mime });
    }
  };

  const closePreview = () => {
    if (previewDoc?.url) URL.revokeObjectURL(previewDoc.url);
    setPreviewDoc(null);
  };

  return (
    <motion.div
      key="docs-workspace"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-7xl px-4 py-7 sm:px-6"
    >
      <ConfettiBurst trigger={confettiTrigger} />

      {/* Dropzone Documentos */}
      <BorderBeamCard active={dragActive} className="mb-6" innerClassName="p-6 sm:p-8">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/55 px-5 py-7 text-center sm:flex-row sm:text-left"
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <motion.div
              animate={{ y: dragActive ? -5 : [0, -4, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
            >
              <FileText className="h-6 w-6" />
            </motion.div>
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                {docs.length ? "Adicionar mais documentos à fila" : "Solte documentos, planilhas ou imagens para PDF"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                PDF · Word (.docx) · Excel (.xlsx) · CSV · JSON · Markdown · HTML · TXT · Imagens → PDF
              </p>
            </div>
          </div>

          <MagneticButton size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Escolher documentos
          </MagneticButton>
        </div>
      </BorderBeamCard>

      {/* Painel de Lote de Documentos */}
      <AnimatePresence>
        {docs.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-7 space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-md)] sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold revela-shimmer">Estúdio de Documentos</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {docs.length} arquivo(s) prontos · Converta em massa, extraia texto, transforme planilhas ou unifique tudo em 1 PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setResults([]);
                  setLastZip(null);
                  setMergePdfMode(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--status-error)] hover:bg-[var(--status-error)]/20 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar tudo
              </button>
            </div>

            {/* Presets Rápidos de Documentos */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                <Zap className="h-3.5 w-3.5" />
                Ações & Presets Rápidos
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { id: "all_pdf" as const, tag: "Universal", title: "Tudo para PDF", sub: "1 PDF por arquivo" },
                  { id: "merge_pdf" as const, tag: "Unificar", title: "Juntar em 1 PDF", sub: "PDFs + Docs + Fotos" },
                  { id: "split_pdf" as const, tag: "Separar", title: "Dividir PDF", sub: "1 página = 1 PDF" },
                  { id: "to_txt" as const, tag: "Leitura", title: "Extrair Texto", sub: "Gera .txt limpo" },
                  { id: "to_csv" as const, tag: "E-commerce", title: "Planilha → CSV", sub: "Excel BR (;)" },
                  { id: "to_json" as const, tag: "Dev / API", title: "Planilha → JSON", sub: "Array de objetos" },
                ].map((p) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => applyDocPreset(p.id)}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
                      p.id === "merge_pdf" && mergePdfMode
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-[var(--bg-surface)]/75 hover:border-[var(--accent)]"
                    }`}
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

            {/* Banner Modo Unificar (Merge PDF) */}
            <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)]/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2.5 text-sm font-bold text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergePdfMode}
                    onChange={(e) => setMergePdfMode(e.target.checked)}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  <Combine className="h-4 w-4 text-[var(--accent-text)]" />
                  Juntar todos os {docs.length} arquivos da fila em um único PDF (respeitando a ordem abaixo)
                </label>

                {mergePdfMode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">Nome final:</span>
                    <input
                      type="text"
                      value={mergedPdfName}
                      onChange={(e) => setMergedPdfName(e.target.value)}
                      className="revela-input w-56 font-mono text-xs"
                      placeholder="documento_unificado"
                    />
                    <span className="font-mono text-xs text-[var(--accent-text)]">.pdf</span>
                  </div>
                )}
              </div>
            </div>

            {/* Renomeação em Lote (quando não está em modo unificado) */}
            {!mergePdfMode && (
              <>
                <BatchRenameBar
                  value={batchRename}
                  onChange={setBatchRename}
                  sampleExtension={DOC_OUTPUT_EXT[docs[0]?.formato || "PDF"]}
                  sampleOriginalBase={docs[0]?.nomeBase || "documento"}
                  hasIndividualOverrides={hasIndividualNameOverrides}
                  onResetIndividualOverrides={() => onUpdateAllDocs(() => ({ nomePersonalizado: null }))}
                />

                <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={usarZip}
                    onChange={(e) => setUsarZip(e.target.checked)}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  Empacotar todos os documentos em um arquivo <strong>.ZIP</strong> (download individual também disponível nos resultados)
                </label>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Lista / Grade de Documentos */}
      {docs.length > 0 && (
        <section className="mb-7">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {docs.map((doc, index) => {
                const targets = getDocTargetFormats(doc.extensao);
                const resolvedBase = computeTargetBaseName(doc.nomeBase, doc.nomePersonalizado, index, batchRename);
                const resolvedFull = mergePdfMode
                  ? `Parte ${index + 1} → ${mergedPdfName || "unificado"}.pdf`
                  : `${resolvedBase}.${DOC_OUTPUT_EXT[doc.formato]}`;
                const isPdfIn = doc.extensao === "pdf";
                const outputsPdf = mergePdfMode || doc.formato === "PDF" || doc.formato === "PDF_SPLIT";

                return (
                  <motion.article
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)]"
                  >
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)]/55 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-[var(--text-muted)]">
                            #{String(index + 1).padStart(2, "0")}
                          </span>
                          <DocTypeBadge ext={doc.extensao} />
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                            {formatBytes(doc.tamanhoBytes)}
                          </span>
                        </div>
                        <p className="truncate font-mono text-xs font-bold text-[var(--text-primary)]" title={doc.nome}>
                          {doc.nome}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-[var(--accent-text)]">
                          → {resolvedFull}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onRemoveDoc(doc.id)}
                          aria-label="Remover documento"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--status-error)] hover:text-[var(--status-error)] cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {docs.length > 1 && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => onMoveDoc(index, -1)}
                              title="Mover para cima"
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === docs.length - 1}
                              onClick={() => onMoveDoc(index, 1)}
                              title="Mover para baixo"
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preview de miniatura quando for imagem para PDF */}
                    {doc.previewUrl && (
                      <div className="h-28 w-full overflow-hidden border-b border-[var(--border)] bg-[var(--bg-surface)]">
                        <img src={doc.previewUrl} alt={doc.nome} className="h-full w-full object-contain" />
                      </div>
                    )}

                    {/* Controles Individuais do Documento */}
                    <div className="grid grid-cols-2 gap-2.5 p-4">
                      {!mergePdfMode && (
                        <>
                          <div className="col-span-2">
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                Nome de saída {doc.nomePersonalizado !== null ? "(editado)" : "(lote)"}
                              </label>
                              {doc.nomePersonalizado !== null && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateDoc(doc.id, { nomePersonalizado: null })}
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
                              value={doc.nomePersonalizado ?? ""}
                              placeholder={resolvedBase}
                              onChange={(e) =>
                                onUpdateDoc(doc.id, {
                                  nomePersonalizado: e.target.value === "" ? null : e.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                              Converter para
                            </label>
                            <select
                              className="revela-select text-xs font-semibold"
                              value={doc.formato}
                              onChange={(e) => onUpdateDoc(doc.id, { formato: e.target.value as DocOutputFormat })}
                            >
                              {targets.map((fmt) => (
                                <option key={fmt} value={fmt}>
                                  {formatDocFormatLabel(fmt)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      {/* Opções específicas de PDF na entrada */}
                      {isPdfIn && outputsPdf && (
                        <>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                              Páginas (opcional)
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: 1-3, 5"
                              className="revela-input font-mono text-xs"
                              value={doc.intervaloPaginas}
                              onChange={(e) => onUpdateDoc(doc.id, { intervaloPaginas: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                              Rotação
                            </label>
                            <select
                              className="revela-select font-mono text-xs"
                              value={doc.rotacao}
                              onChange={(e) =>
                                onUpdateDoc(doc.id, { rotacao: Number(e.target.value) as 0 | 90 | 180 | 270 })
                              }
                            >
                              <option value={0}>0° (Original)</option>
                              <option value={90}>90° horário</option>
                              <option value={180}>180°</option>
                              <option value={270}>270° anti-horário</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Opções de página quando gera PDF a partir de texto/planilha/imagem */}
                      {!isPdfIn && outputsPdf && (
                        <>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                              Página
                            </label>
                            <select
                              className="revela-select text-xs"
                              value={doc.tamanhoPagina}
                              onChange={(e) =>
                                onUpdateDoc(doc.id, { tamanhoPagina: e.target.value as "A4" | "LETTER" | "AUTO" })
                              }
                            >
                              <option value="A4">A4</option>
                              <option value="LETTER">Carta (Letter)</option>
                              {doc.previewUrl && <option value="AUTO">Ajustar à imagem</option>}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                              Orientação
                            </label>
                            <select
                              className="revela-select text-xs"
                              value={doc.orientacao}
                              onChange={(e) =>
                                onUpdateDoc(doc.id, { orientacao: e.target.value as "portrait" | "landscape" })
                              }
                            >
                              <option value="portrait">Retrato</option>
                              <option value="landscape">Paisagem</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Opção delimitador CSV */}
                      {!mergePdfMode && doc.formato === "CSV" && (
                        <div className="col-span-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            Separador CSV
                          </label>
                          <select
                            className="revela-select text-xs"
                            value={doc.delimitadorCsv}
                            onChange={(e) => onUpdateDoc(doc.id, { delimitadorCsv: e.target.value as "," | ";" })}
                          >
                            <option value=";">Ponto e vírgula (;) — Excel Brasil</option>
                            <option value=",">Vírgula (,) — Padrão internacional</option>
                          </select>
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

      {/* Ação Principal */}
      {docs.length > 0 && (
        <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center shadow-[var(--shadow-md)]">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <MagneticButton size="lg" disabled={processing} onClick={handleProcessDocs} className="min-w-[250px]">
              {processing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Transformando...
                </>
              ) : mergePdfMode ? (
                <>
                  <Combine className="h-5 w-5 text-[#E4BA2C]" />
                  Juntar {docs.length} arquivos em 1 PDF
                  <ArrowRight className="h-5 w-5" />
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-[#E4BA2C]" />
                  Transformar {docs.length} {docs.length === 1 ? "Documento" : "Documentos"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </MagneticButton>

            <MagneticButton
              size="lg"
              variant="secondary"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              title="Adicionar mais documentos"
            >
              <Plus className="h-5 w-5" />
            </MagneticButton>
          </div>

          <ProcessingQueue
            visible={processing}
            percent={progressPct}
            statusText={progressText}
            stages={DOC_STAGES}
            activeStage={activeStage}
            queue={queue}
          />
        </section>
      )}

      {/* Resultados de Documentos */}
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
                <h2 className="font-display text-2xl font-bold revela-shimmer">Documentos Prontos</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Visualize no navegador ou baixe cada arquivo individualmente ou em ZIP.
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
                  Novo lote de documentos
                </MagneticButton>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map((r, i) => {
                const canPreview =
                  r.status === "ok" &&
                  Boolean(r.dados) &&
                  Boolean(
                    r.mime?.includes("pdf") ||
                      r.mime?.includes("html") ||
                      r.mime?.startsWith("text/") ||
                      r.mime?.includes("json")
                  );
                return (
                  <motion.article
                    key={`${r.salvo_como || r.nome}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.35) }}
                    className={`rounded-2xl border bg-[var(--bg-surface)] p-4 ${
                      r.status === "ok" ? "border-[var(--border)]" : "border-[var(--status-error)]/40"
                    }`}
                  >
                    {r.status === "ok" ? (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-bold text-[var(--text-primary)]">
                              {r.salvo_como}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">Origem: {r.nome}</p>
                          </div>
                          <DocTypeBadge ext={getExtension(r.salvo_como || "")} />
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {r.tamanho_bytes && (
                            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                              {formatBytes(r.tamanho_bytes)}
                            </span>
                          )}
                          {r.paginas && (
                            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                              {r.paginas} {r.paginas === 1 ? "página" : "páginas"}
                            </span>
                          )}
                        </div>

                        {r.aviso && (
                          <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-[var(--accent-soft)] p-2 text-[10px] text-[var(--accent-text)]">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            {r.aviso}
                          </p>
                        )}

                        <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-success)]">
                            <Check className="h-3.5 w-3.5" />
                            Pronto
                          </span>
                          <div className="flex items-center gap-1.5">
                            {canPreview && (
                              <button
                                type="button"
                                onClick={() => openQuickPreview(r)}
                                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver
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
                              >
                                <Download className="h-3.5 w-3.5" />
                                Baixar
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-mono text-xs font-bold text-[var(--status-error)]">{r.nome}</p>
                        <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{r.mensagem}</p>
                      </>
                    )}
                  </motion.article>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Modal Quick Preview de PDF / Texto / HTML */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePreview}
            className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
                <span className="truncate font-mono text-sm font-bold text-[var(--text-primary)]">
                  {previewDoc.title}
                </span>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-[var(--bg-surface)] p-4">
                {previewDoc.mime.includes("pdf") ? (
                  <iframe title={previewDoc.title} src={previewDoc.url} className="h-full w-full rounded-xl border-0" />
                ) : previewDoc.mime.includes("html") ? (
                  <iframe
                    title={previewDoc.title}
                    src={previewDoc.url}
                    sandbox=""
                    className="h-full w-full rounded-xl border-0 bg-white"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--text-primary)]">
                    {previewDoc.text}
                  </pre>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm,.xlsx,.csv,.json,image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) onAddFiles(list, "documentos", false);
          e.target.value = "";
        }}
      />
    </motion.div>
  );
}
