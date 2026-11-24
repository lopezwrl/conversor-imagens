import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, Download, Eye, Plus, Trash2, Upload } from "lucide-react";
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
  { id: "lendo", label: "Leitura" },
  { id: "convertendo", label: "Conversão" },
  { id: "finalizando", label: "Fechamento" },
];

const STAGE_TEXT: Record<string, string> = {
  lendo: "Lendo estrutura",
  convertendo: "Transformando conteúdo",
  finalizando: "Gerando arquivo",
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

  const [dragActive, setDragActive] = useState(false);
  const [mergePdfMode, setMergePdfMode] = useState(false);
  const [mergedPdfName, setMergedPdfName] = useState("documento_unificado");

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
      notify("Formato não suportado em Documentos.", "warn");
      return;
    }
    const added = await addFiles(valid, fn, hasFolder);
    if (added > 0) {
      notify(`${added} ${added === 1 ? "documento adicionado" : "documentos adicionados"}.`, "ok");
    } else {
      notify("Os documentos selecionados já estão na fila.", "neutral");
    }
  };

  const applyPreset = (
    preset: "all_pdf" | "merge_pdf" | "split_pdf" | "to_txt" | "to_csv" | "to_json"
  ) => {
    if (!docs.length) return;

    if (preset === "merge_pdf") {
      setMergePdfMode(true);
      notify("Modo de unificação em um único PDF ativado.", "ok");
      return;
    }

    setMergePdfMode(false);

    if (preset === "all_pdf") {
      updateAll(() => ({ formato: "PDF" }));
      notify("Saída configurada para PDF em todos os arquivos.", "ok");
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
          ? `${count} PDF(s) configurados para divisão por página.`
          : "Adicione um arquivo PDF para dividir páginas.",
        count > 0 ? "ok" : "warn"
      );
    } else if (preset === "to_txt") {
      updateAll((d) =>
        getTargetDocFormats(d.extensao).includes("TXT") ? { formato: "TXT" } : {}
      );
      notify("Extração de texto (.txt) selecionada.", "ok");
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
          ? "Conversão para CSV (;) aplicada às planilhas."
          : "Adicione planilhas XLSX ou arquivos JSON para converter em CSV.",
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
          ? "Conversão para JSON aplicada às planilhas."
          : "Adicione XLSX ou CSV para converter em JSON.",
        count > 0 ? "ok" : "warn"
      );
    }
  };

  const runDocsBatch = async () => {
    if (!docs.length || processing) return;

    setProcessing(true);
    setProgressPct(4);
    setProgressText(mergePdfMode ? "Unificando arquivos em PDF..." : "Iniciando transformação...");
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
    formData.append("nome_mesclado", mergedPdfName.trim() || "revela_unificado");
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
          setProgressText("Transformação concluída.");
          setQueue((prev) => prev.map((q) => (q.status === "erro" ? q : { ...q, status: "concluida" })));
          if (activeZip && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_documentos.zip" };
            setLastZip(z);
            triggerDownload(base64ToBlob(z.base64, "application/zip"), z.nome);
          }
        }
      });

      if (!completed && collected.length > 0) {
        notify("Conexão encerrada antes do término; itens concluídos foram mantidos.", "warn");
      }

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        notify(
          mergePdfMode
            ? "PDF unificado gerado."
            : `${okCount} ${okCount === 1 ? "arquivo gerado" : "arquivos gerados"}.`,
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
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
    >
      {/* Cabeçalho editorial de Documentos */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <span className="font-mono text-xs tracking-[0.14em] text-[var(--water-opposite-tint)]">
            02 / DOCUMENTOS
          </span>
          <h1 className="mt-1 font-display text-4xl font-medium text-[var(--fg-primary)] sm:text-5xl">
            Mesa de documentos
          </h1>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-[var(--fg-secondary)]">
          Converta formatos de texto e planilha, divida páginas ou unifique a fila em um único PDF.
        </p>
      </div>

      {/* Área de entrada */}
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
          if (files.length) await handleIncoming(files, fn, hasFolder);
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
              {docs.length > 0
                ? "Arraste mais documentos, planilhas ou imagens para acrescentar à fila"
                : "Arraste PDFs, Word (.docx), Excel (.xlsx), CSV, JSON, Markdown, HTML ou imagens"}
            </p>
            <p className="font-mono text-[11px] text-[var(--fg-muted)]">
              Arraste os cartões abaixo para alterar a ordem antes de unificar ou numerar
            </p>
          </div>
        </div>

        <Button size="sm" onClick={() => fileInputRef.current?.click()}>
          Selecionar documentos
        </Button>
      </div>

      {/* Painel de lote */}
      {docs.length > 0 && (
        <section className="mb-8 space-y-5 rounded-[6px] border border-[var(--line)] bg-[var(--bg-panel)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3.5">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-xl font-medium text-[var(--fg-primary)]">
                Operação do lote
              </h2>
              <span className="font-mono text-xs text-[var(--fg-muted)]">
                {docs.length} {docs.length === 1 ? "arquivo" : "arquivos"}
              </span>
            </div>

            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                clearAll();
                setResults([]);
                setLastZip(null);
                setMergePdfMode(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Esvaziar fila
            </Button>
          </div>

          {/* Predefinições */}
          <div>
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
              Predefinições rápidas
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { id: "all_pdf" as const, title: "Converter em PDF", meta: "1 PDF por arquivo" },
                { id: "merge_pdf" as const, title: "Unificar em 1 PDF", meta: "Junta toda a fila" },
                { id: "split_pdf" as const, title: "Dividir PDF", meta: "1 arquivo por página" },
                { id: "to_txt" as const, title: "Extrair texto", meta: "Saída .txt" },
                { id: "to_csv" as const, title: "Planilha em CSV", meta: "Separador (;)" },
                { id: "to_json" as const, title: "Planilha em JSON", meta: "Lista estruturada" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`flex flex-col items-start rounded-[4px] border px-3 py-2 text-left transition-colors cursor-pointer ${
                    p.id === "merge_pdf" && mergePdfMode
                      ? "border-[var(--accent)] bg-[var(--bg-hover)]"
                      : "border-[var(--line)] bg-[var(--bg-field)] hover:border-[var(--accent)]"
                  }`}
                >
                  <span className="text-xs font-semibold text-[var(--fg-primary)]">{p.title}</span>
                  <span className="font-mono text-[10px] text-[var(--fg-muted)]">{p.meta}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Opção de Unificação em PDF único */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] px-3.5 py-2.5">
            <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--fg-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={mergePdfMode}
                onChange={(e) => setMergePdfMode(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Unificar os {docs.length} arquivos da fila em um único documento PDF
            </label>

            {mergePdfMode && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[var(--fg-secondary)]">Arquivo:</span>
                <Input
                  type="text"
                  value={mergedPdfName}
                  onChange={(e) => setMergedPdfName(e.target.value)}
                  className="h-8 w-52 font-mono"
                  placeholder="documento_unificado"
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

              <div className="border-t border-[var(--line)] pt-3">
                <label className="inline-flex items-center gap-2.5 text-xs text-[var(--fg-secondary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useZip}
                    onChange={(e) => setUseZip(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  Agrupar documentos gerados em um pacote ZIP ao concluir
                </label>
              </div>
            </>
          )}
        </section>
      )}

      {/* Grade de documentos */}
      {docs.length > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        </section>
      )}

      {/* Barra de ação */}
      {docs.length > 0 && (
        <section className="mb-10 rounded-[6px] border border-[var(--line-strong)] bg-[var(--bg-panel)] p-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              disabled={processing}
              onClick={runDocsBatch}
              className="min-w-[230px]"
            >
              {processing
                ? "Processando..."
                : mergePdfMode
                ? `Unificar ${docs.length} arquivos em PDF`
                : `Transformar ${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`}
            </Button>

            <Button
              size="lg"
              variant="secondary"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Adicionar
            </Button>
          </div>

          <ProcessingPanel
            visible={processing}
            percent={progressPct}
            statusText={progressText}
            stages={DOC_STAGES}
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
                Arquivos gerados
              </h2>
              <p className="text-xs text-[var(--fg-secondary)]">
                Visualize no navegador ou baixe cada documento individualmente.
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
                <article
                  key={`${r.salvo_como || r.nome}-${i}`}
                  className={`flex flex-col justify-between rounded-[6px] border bg-[var(--bg-field)] p-4 ${
                    r.status === "ok" ? "border-[var(--line)]" : "border-[var(--status-err)]/50"
                  }`}
                >
                  {r.status === "ok" ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-[2px] border border-[var(--line-strong)] bg-[var(--bg-deep)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--fg-primary)]">
                            {getExtension(r.salvo_como || "") || "doc"}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--fg-muted)]">
                            {r.tamanho_bytes ? formatBytes(r.tamanho_bytes) : ""}
                            {r.paginas ? ` · ${r.paginas} pág.` : ""}
                          </span>
                        </div>
                        <p className="mt-2 truncate font-mono text-xs text-[var(--fg-primary)]">
                          {r.salvo_como}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--fg-muted)]">
                          Origem: {r.nome}
                        </p>

                        {r.aviso && (
                          <p className="mt-2 rounded-[4px] border border-[var(--line-gold)] bg-[var(--bg-deep)]/60 p-2 font-mono text-[10px] text-[var(--accent-bright)]">
                            {r.aviso}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
                        {canPreview && (
                          <Button size="sm" variant="secondary" onClick={() => openPreview(r)}>
                            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Visualizar
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
