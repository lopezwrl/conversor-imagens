import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, Download, Eye, Plus, Trash2 } from "lucide-react";
import { useDocuments } from "../../state/documents";
import { useToast } from "../../state/toasts";
import type { DocResultRecord, DocStreamEvent } from "../../types/document";
import type { BatchRenameRule, QueueEntry } from "../../types/shared";
import { getExtension, readDroppedItems } from "../../lib/files";
import {
  DOC_ACCEPTED_EXTENSIONS,
  DOC_FORMAT_EXT,
  getTargetDocFormats,
} from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { base64ToBlob, triggerDownload } from "../../lib/download";
import { consumeNdjsonStream } from "../../lib/ndjson";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { BatchRename } from "../../components/shared/BatchRename";
import { ProcessingPanel } from "../../components/shared/ProcessingPanel";
import { DocumentRow } from "./DocumentRow";
import { DocumentPreview } from "./DocumentPreview";

const DOC_STAGES = [
  { id: "lendo", label: "Leitura estrutural" },
  { id: "convertendo", label: "Diagramação" },
  { id: "finalizando", label: "Fechamento" },
];

const STAGE_TEXT: Record<string, string> = {
  lendo: "Lendo estrutura",
  convertendo: "Diagramando conteúdo",
  finalizando: "Fechando arquivo",
};

const STAGE_WEIGHT: Record<string, number> = {
  lendo: 0.25,
  convertendo: 0.72,
  finalizando: 0.94,
};

export function DocumentStudio() {
  const {
    items: docs,
    folderName,
    useZip,
    setUseZip,
    addFiles,
    updateItem,
    updateAll,
    moveItem,
    removeItem,
    clearAll,
  } = useDocuments();
  const { notify } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [mergePdfMode, setMergePdfMode] = useState(false);
  const [mergedPdfName, setMergedPdfName] = useState("caderno_unificado");

  const [renameRule, setRenameRule] = useState<BatchRenameRule>({
    prefix: "",
    suffix: "",
    startNumber: 1,
    padDigits: 2,
    separator: "_",
  });

  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [results, setResults] = useState<DocResultRecord[]>([]);
  const [lastZip, setLastZip] = useState<{ base64: string; nome: string } | null>(null);

  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    url: string;
    mime: string;
    text?: string;
  } | null>(null);

  const hasCustomNames = useMemo(
    () => docs.some((d) => d.nomePersonalizado !== null && d.nomePersonalizado.trim() !== ""),
    [docs]
  );

  const handleIncoming = async (rawFiles: File[], fn?: string | null, hasFolder?: boolean) => {
    const valid = rawFiles.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));
    if (!valid.length) {
      notify("Formato não suportado na prancheta de Documentos.", "warn");
      return;
    }
    const added = await addFiles(valid, fn, hasFolder);
    if (added > 0) {
      notify(`${added} ${added === 1 ? "documento incluído" : "documentos incluídos"} na pauta.`, "ok");
    } else {
      notify("Documentos já presentes na pauta.", "neutral");
    }
  };

  const applyPreset = (
    preset: "all_pdf" | "merge_pdf" | "split_pdf" | "to_txt" | "to_csv" | "to_json"
  ) => {
    if (!docs.length) return;

    if (preset === "merge_pdf") {
      setMergePdfMode(true);
      notify("D2 Encadernação em PDF único ativada.", "ok");
      return;
    }

    setMergePdfMode(false);

    if (preset === "all_pdf") {
      updateAll(() => ({ formato: "PDF" }));
      notify("D1 Converter todos para PDF aplicado.", "ok");
    } else if (preset === "split_pdf") {
      let count = 0;
      updateAll((d) => {
        if (d.extensao === "pdf") {
          count++;
          return { formato: "PDF_SPLIT" };
        }
        return {};
      });
      notify(
        count > 0
          ? `D3 Desmembrar páginas aplicado em ${count} PDF(s).`
          : "Inclua um arquivo PDF para desmembrar páginas.",
        count > 0 ? "ok" : "warn"
      );
    } else if (preset === "to_txt") {
      updateAll((d) =>
        getTargetDocFormats(d.extensao).includes("TXT") ? { formato: "TXT" } : {}
      );
      notify("D4 Extração de texto bruto (.txt) aplicada.", "ok");
    } else if (preset === "to_csv") {
      let count = 0;
      updateAll((d) => {
        if (getTargetDocFormats(d.extensao).includes("CSV")) {
          count++;
          return { formato: "CSV", delimitadorCsv: ";" };
        }
        return {};
      });
      notify(
        count > 0
          ? "D5 Conversão para CSV (;) aplicada."
          : "Inclua planilhas XLSX ou JSON para exportar em CSV.",
        count > 0 ? "ok" : "warn"
      );
    } else if (preset === "to_json") {
      let count = 0;
      updateAll((d) => {
        if (getTargetDocFormats(d.extensao).includes("JSON")) {
          count++;
          return { formato: "JSON" };
        }
        return {};
      });
      notify(
        count > 0
          ? "D6 Conversão para JSON estruturado aplicada."
          : "Inclua XLSX ou CSV para converter em JSON.",
        count > 0 ? "ok" : "warn"
      );
    }
  };

  const runDocsBatch = async () => {
    if (!docs.length || processing) return;

    setProcessing(true);
    setProgressPct(4);
    setProgressText(mergePdfMode ? "Encadernando volume PDF..." : "Iniciando conversão...");
    setActiveStage("lendo");
    setResults([]);
    setLastZip(null);
    setQueue(docs.map((d, i) => ({ nome: d.nome, status: i === 0 ? "processando" : "pendente" })));

    const formData = new FormData();
    const config: Record<string, unknown> = {};

    docs.forEach((doc, index) => {
      formData.append("arquivos", doc.file, doc.nome);
      const outBase = resolveOutputBaseName(doc.nomeBase, doc.nomePersonalizado, index, renameRule);

      config[String(index)] = {
        formato: doc.formato,
        novo_nome: outBase,
        rotacao: doc.rotacao,
        intervalo_paginas: doc.intervaloPaginas.trim() || null,
        tamanho_pagina: doc.tamanhoPagina,
        orientacao: doc.orientacao,
        delimitador_csv: doc.delimitadorCsv,
      };
    });

    const activeZip = !mergePdfMode && useZip;
    formData.append("config", JSON.stringify(config));
    formData.append("usar_zip", String(activeZip));
    formData.append("mesclar_pdf", String(mergePdfMode));
    formData.append("nome_mesclado", mergedPdfName.trim() || "caderno_unificado");
    formData.append("nome_zip", `${folderName || "revela"}_documentos.zip`);

    const collected: DocResultRecord[] = [];

    try {
      const response = await fetch("/api/documents/batch", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ erro: "Falha ao processar documentos." }));
        notify(err.erro || "Falha ao processar documentos.", "err");
        return;
      }

      const completed = await consumeNdjsonStream<DocStreamEvent>(response, (evt) => {
        if (evt.tipo === "progresso") {
          const base = (evt.indice - 1) / evt.total;
          const frac = (STAGE_WEIGHT[evt.etapa] ?? 0.7) / evt.total;
          setProgressPct(Math.min(99, Math.round((base + frac) * 100)));
          setProgressText(
            `${evt.indice}/${evt.total} · ${STAGE_TEXT[evt.etapa] || "Processando"} (${evt.nome})`
          );
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
          const orig = docs[evt.indice ?? 0];
          const resItem: DocResultRecord = {
            ...evt,
            tamanhoOriginalBytes: orig?.tamanhoBytes,
          };
          collected.push(resItem);

          if (evt.status === "ok" && !activeZip && evt.dados && evt.salvo_como) {
            triggerDownload(
              base64ToBlob(evt.dados, evt.mime || "application/octet-stream"),
              evt.salvo_como
            );
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
          setProgressText("Pauta concluída.");
          setQueue((prev) => prev.map((q) => (q.status === "erro" ? q : { ...q, status: "concluida" })));
          if (activeZip && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_documentos.zip" };
            setLastZip(z);
            triggerDownload(base64ToBlob(z.base64, "application/zip"), z.nome);
          }
        }
      });

      if (!completed && collected.length > 0) {
        notify("Conexão interrompida; arquivos já gerados foram preservados.", "warn");
      }

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        notify(
          mergePdfMode
            ? "Volume PDF unificado gerado."
            : `${okCount} ${okCount === 1 ? "documento gerado" : "documentos gerados"}.`,
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

  const openPreview = (r: DocResultRecord) => {
    if (!r.dados || !r.mime) return;
    const blob = base64ToBlob(r.dados, r.mime);
    const url = URL.createObjectURL(blob);
    if (r.mime.startsWith("text/") || r.mime.includes("json")) {
      blob.text().then((text) => {
        setPreviewDoc({
          title: r.salvo_como || r.nome,
          url,
          mime: r.mime!,
          text: text.slice(0, 18000),
        });
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        const { files, folderName: fn, hasFolder } = await readDroppedItems(e.dataTransfer);
        if (files.length) await handleIncoming(files, fn, hasFolder);
      }}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
    >
      {/* Cabeçalho da Prancheta Editorial */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line-strong)] pb-5">
        <div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-[#F4BFC2]">
            SEÇÃO III · PRANCHETA EDITORIAL
          </span>
          <h1 className="mt-1 font-display text-4xl font-medium text-[var(--fg-primary)] sm:text-5xl">
            Pauta de documentos
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 border border-[var(--line-strong)] bg-[#04181D] px-4 font-mono text-xs uppercase tracking-wider text-[var(--fg-primary)] hover:border-[var(--accent)] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--accent-bright)]" strokeWidth={1.5} />
            Incluir documentos
          </button>

          {docs.length > 0 && (
            <button
              type="button"
              disabled={processing}
              onClick={runDocsBatch}
              className="h-10 border border-[#BC9200] bg-[#FDE2B9] px-6 font-mono text-xs font-semibold uppercase tracking-wider text-[#0B3B46] hover:bg-white disabled:opacity-45 cursor-pointer"
            >
              {processing
                ? "Processando..."
                : mergePdfMode
                ? `Encadernar PDF [${docs.length}]`
                : `Transformar pauta [${docs.length}]`}
            </button>
          )}
        </div>
      </div>

      {/* Estado vazio da prancheta */}
      {docs.length === 0 && (
        <div className="my-12 border-y border-[var(--line-strong)] bg-[#04181D]/85 py-16 px-6 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#F4BFC2]">
            PAUTA VAZIA · 000 DOCUMENTOS
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium text-[var(--fg-primary)] sm:text-4xl">
            Solte PDFs, textos, planilhas ou imagens sobre a prancheta
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-[var(--fg-secondary)]">
            Aceita PDF, Word (.docx), Excel (.xlsx), CSV, JSON, Markdown, HTML, TXT e imagens para geração ou encadernação de PDFs.
          </p>
          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 border border-[#BC9200] bg-[#FDE2B9] px-6 font-mono text-xs font-semibold uppercase tracking-wider text-[#0B3B46] hover:bg-white cursor-pointer"
            >
              + Selecionar documentos
            </button>
          </div>
        </div>
      )}

      {/* Comando da Prancheta + Pauta */}
      {docs.length > 0 && (
        <section className="mb-10 border border-[var(--line-strong)] bg-[#04181D]/92">
          {/* Barra superior de teclas D1..D6 */}
          <div className="flex flex-wrap items-center justify-between border-b border-[var(--line)] bg-[#031216] px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
              OPERAÇÕES DE PAUTA · {docs.length} ITEM(NS)
            </span>
            <button
              type="button"
              onClick={() => {
                clearAll();
                setResults([]);
                setLastZip(null);
                setMergePdfMode(false);
              }}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--status-err)] hover:underline cursor-pointer"
            >
              <Trash2 className="h-3 w-3" strokeWidth={1.5} />
              Limpar pauta
            </button>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] border-b border-[var(--line)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            {[
              { id: "all_pdf" as const, code: "D1", title: "Tudo em PDF", spec: "1 PDF / item" },
              { id: "merge_pdf" as const, code: "D2", title: "Encadernar PDF", spec: "Volume único" },
              { id: "split_pdf" as const, code: "D3", title: "Desmembrar PDF", spec: "1 pág / arquivo" },
              { id: "to_txt" as const, code: "D4", title: "Texto Bruto", spec: "Extrair .txt" },
              { id: "to_csv" as const, code: "D5", title: "Tabela CSV", spec: "Excel BR (;)" },
              { id: "to_json" as const, code: "D6", title: "Dados JSON", spec: "Array objetos" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`flex flex-col items-start px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                  p.id === "merge_pdf" && mergePdfMode
                    ? "bg-[#0A2830]"
                    : "hover:bg-[#072229]"
                }`}
              >
                <div className="flex w-full items-baseline justify-between font-mono text-[10px]">
                  <span className="text-[var(--accent-bright)] font-semibold">{p.code}</span>
                  <span className="text-[var(--fg-muted)]">{p.spec}</span>
                </div>
                <span className="mt-1 text-xs font-semibold text-[var(--fg-primary)]">{p.title}</span>
              </button>
            ))}
          </div>

          {/* Configurações de Encadernação ou Renomeação em lote */}
          <div className="space-y-4 border-b border-[var(--line)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2.5 font-mono text-xs font-semibold text-[var(--fg-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergePdfMode}
                  onChange={(e) => setMergePdfMode(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Encadernar todos os {docs.length} itens da pauta em um único volume PDF
              </label>

              {mergePdfMode && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[var(--fg-secondary)]">
                    Volume final:
                  </span>
                  <Input
                    type="text"
                    value={mergedPdfName}
                    onChange={(e) => setMergedPdfName(e.target.value)}
                    className="h-8 w-52 font-mono"
                    placeholder="caderno_unificado"
                  />
                  <span className="font-mono text-xs text-[var(--accent-bright)]">.pdf</span>
                </div>
              )}
            </div>

            {!mergePdfMode && (
              <>
                <BatchRename
                  rule={renameRule}
                  onChange={setRenameRule}
                  sampleExtension={DOC_FORMAT_EXT[docs[0]?.formato || "PDF"]}
                  sampleOriginalBase={docs[0]?.nomeBase || "documento"}
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
                    Agrupar documentos convertidos em arquivo .ZIP
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Cabeçalho das colunas da Pauta */}
          <div className="hidden border-b border-[var(--line)] bg-[#031216] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)] lg:grid lg:grid-cols-[auto_1.4fr_1.6fr_auto] lg:gap-3">
            <span className="w-28">ÍNDICE / TIPO</span>
            <span>ORIGEM E DESTINO</span>
            <span>IDENTIFICADOR / CONVERSÃO / PARÂMETROS</span>
            <span className="text-right">ORDEM</span>
          </div>

          {/* Linhas da Pauta Editorial */}
          <div>
            {docs.map((item, index) => (
              <DocumentRow
                key={item.id}
                item={item}
                index={index}
                total={docs.length}
                mergePdfMode={mergePdfMode}
                mergedPdfName={mergedPdfName}
                renameRule={renameRule}
                onUpdate={updateItem}
                onMove={moveItem}
                onRemove={removeItem}
                onDragStartIndex={(idx) => {
                  dragIndexRef.current = idx;
                }}
                onDropIndex={(targetIdx) => {
                  if (dragIndexRef.current !== null && dragIndexRef.current !== targetIdx) {
                    moveItem(dragIndexRef.current, targetIdx);
                  }
                  dragIndexRef.current = null;
                }}
              />
            ))}
          </div>

          {/* Rodapé da Pauta */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#031216] px-4 py-3.5">
            <span className="font-mono text-[11px] text-[var(--fg-muted)]">
              Arraste as linhas para reordenar a numeração ou a sequência do PDF unificado.
            </span>

            <button
              type="button"
              disabled={processing}
              onClick={runDocsBatch}
              className="h-10 border border-[#BC9200] bg-[#FDE2B9] px-6 font-mono text-xs font-semibold uppercase tracking-wider text-[#0B3B46] hover:bg-white disabled:opacity-45 cursor-pointer"
            >
              {processing
                ? "Processando..."
                : mergePdfMode
                ? `Encadernar ${docs.length} itens em PDF`
                : `Executar conversão [${docs.length}]`}
            </button>
          </div>

          {processing && (
            <div className="border-t border-[var(--line)] px-5 pb-5">
              <ProcessingPanel
                visible={processing}
                percent={progressPct}
                statusText={progressText}
                stages={DOC_STAGES}
                activeStage={activeStage}
                queue={queue}
              />
            </div>
          )}
        </section>
      )}

      {/* Resultados em Pauta */}
      {results.length > 0 && (
        <section
          ref={resultsRef}
          className="border border-[var(--line-strong)] bg-[#04181D]/95 p-5"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F4BFC2]">
                PAUTA CONCLUÍDA
              </span>
              <h2 className="mt-1 font-display text-2xl font-medium text-[var(--fg-primary)]">
                Documentos expedidos
              </h2>
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
                Nova pauta
              </Button>
            </div>
          </div>

          <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
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
                <article
                  key={`${r.salvo_como || r.nome}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-3 bg-[#031216] px-4 py-3"
                >
                  {r.status === "ok" ? (
                    <>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-xs text-[#F4BFC2]">
                          {String(i + 1).padStart(3, "0")}
                        </span>
                        <span className="border border-[var(--line-strong)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--fg-primary)]">
                          {getExtension(r.salvo_como || "") || "doc"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-[var(--fg-primary)]">
                            {r.salvo_como}
                          </p>
                          <p className="font-mono text-[10px] text-[var(--fg-muted)]">
                            Origem: {r.nome}
                            {r.tamanho_bytes ? ` · ${formatBytes(r.tamanho_bytes)}` : ""}
                            {r.paginas ? ` · ${r.paginas} pág.` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canPreview && (
                          <Button size="sm" variant="secondary" onClick={() => openPreview(r)}>
                            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Inspecionar
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
                    </>
                  ) : (
                    <div>
                      <p className="font-mono text-xs text-[var(--status-err)]">{r.nome}</p>
                      <p className="mt-0.5 text-xs text-[var(--fg-secondary)]">{r.mensagem}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <AnimatePresence>
        {previewDoc && (
          <DocumentPreview
            title={previewDoc.title}
            url={previewDoc.url}
            mime={previewDoc.mime}
            text={previewDoc.text}
            onClose={closePreview}
          />
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm,.xlsx,.csv,.json,image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (list.length) handleIncoming(list, "documentos", false);
          e.target.value = "";
        }}
      />
    </motion.div>
  );
}
