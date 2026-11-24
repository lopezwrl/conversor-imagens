import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Plus } from "lucide-react";
import { getFormatForDocBatchMode, useDocuments } from "../../state/documents";
import { useSection } from "../../state/section";
import { useToast } from "../../state/toasts";
import type { DocBatchMode, DocResultRecord, DocStreamEvent } from "../../types/document";
import type { BatchRenameRule, QueueEntry } from "../../types/shared";
import { getExtension, readDroppedItems } from "../../lib/files";
import { DOC_ACCEPTED_EXTENSIONS, DOC_FORMAT_EXT } from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { base64ToBlob, triggerDownload } from "../../lib/download";
import { consumeNdjsonStream } from "../../lib/ndjson";
import { Button } from "../../components/ui/Button";
import { Input, Label } from "../../components/ui/Field";
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
  lendo: "Lendo documento",
  convertendo: "Convertendo formato",
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
    batchMode,
    setBatchMode,
    setRowFormat,
    setUseZip,
    addFiles,
    updateItem,
    updateAll,
    moveItem,
    removeItem,
    clearAll,
  } = useDocuments();
  const { activeRouteAction } = useSection();
  const { notify } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const finishedTimerRef = useRef<number | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [mergedPdfName, setMergedPdfName] = useState("documento_unificado");
  const [justFinished, setJustFinished] = useState(false);

  const mergePdfMode = batchMode === "merge_pdf";
  const defaultBatchFormat = getFormatForDocBatchMode(batchMode);

  useEffect(() => {
    if (activeRouteAction === "unificar") {
      setBatchMode("merge_pdf");
    } else if (activeRouteAction === "planilhas") {
      setBatchMode("to_csv");
    } else if (activeRouteAction === "pdf") {
      setBatchMode("all_pdf");
    }
  }, [activeRouteAction, setBatchMode]);

  useEffect(() => {
    return () => {
      if (finishedTimerRef.current) window.clearTimeout(finishedTimerRef.current);
    };
  }, []);

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

  const totalInputBytes = useMemo(
    () => docs.reduce((acc, it) => acc + it.tamanhoBytes, 0),
    [docs]
  );

  const handleIncoming = async (rawFiles: File[], fn?: string | null, hasFolder?: boolean) => {
    const valid = rawFiles.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));
    if (!valid.length) {
      notify("Formato não suportado em Documentos.", "err");
      return;
    }
    await addFiles(valid, fn, hasFolder);
  };

  const handleSelectBatchMode = (preset: DocBatchMode) => {
    setBatchMode(preset);
  };

  const downloadAllResults = () => {
    if (lastZip) {
      triggerDownload(base64ToBlob(lastZip.base64, "application/zip"), lastZip.nome);
      return;
    }
    results.forEach((r) => {
      if (r.status === "ok" && r.dados) {
        triggerDownload(
          base64ToBlob(r.dados, r.mime || "application/octet-stream"),
          r.salvo_como || r.nome
        );
      }
    });
  };

  const runDocsBatch = async () => {
    if (!docs.length || processing) return;
    if (justFinished && results.length > 0) {
      downloadAllResults();
      return;
    }

    setProcessing(true);
    setJustFinished(false);
    setProgressPct(4);
    setProgressText(mergePdfMode ? "Juntando arquivos em PDF..." : "Convertendo documentos...");
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
    formData.append("nome_mesclado", mergedPdfName.trim() || "documento_unificado");
    formData.append("nome_zip", `${folderName || "revela"}_documentos.zip`);

    const collected: DocResultRecord[] = [];

    try {
      const response = await fetch("/api/documents/batch", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ erro: "Falha ao processar documentos." }));
        notify(err.erro || "Falha ao processar documentos.", "err");
        return;
      }

      await consumeNdjsonStream<DocStreamEvent>(response, (evt) => {
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
          setProgressText("Concluído.");
          setQueue((prev) => prev.map((q) => (q.status === "erro" ? q : { ...q, status: "concluida" })));
          if (activeZip && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_documentos.zip" };
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
          mergePdfMode
            ? "PDF unificado concluído."
            : okCount === 1
            ? "1 documento concluído."
            : `${okCount} documentos concluídos.`,
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

  // Botão curto + linha de resumo lateral sempre em sincronia com o estado
  const { buttonLabel, summaryLine } = useMemo(() => {
    const countText = docs.length === 1 ? "1 documento" : `${docs.length} documentos`;
    if (mergePdfMode) {
      const outPdf = `${mergedPdfName.trim() || "documento_unificado"}.pdf`;
      return {
        buttonLabel: `Juntar ${countText} em 1 PDF`,
        summaryLine: `Saída: ${outPdf}`,
      };
    }

    const exceptions = docs.filter((d) => d.formatoIndividual !== null);
    const primaryFormat =
      defaultBatchFormat === "PDF_SPLIT" ? "PDF dividido" : defaultBatchFormat;

    if (batchMode === "split_pdf" && exceptions.length === 0) {
      return {
        buttonLabel: `Dividir ${countText}`,
        summaryLine: `${primaryFormat} · ${useZip ? "arquivo ZIP" : "arquivos soltos"}`,
      };
    }

    const btn = `Converter ${countText} para ${primaryFormat}`;
    const excText =
      exceptions.length === 0
        ? primaryFormat
        : `${primaryFormat} · ${exceptions.length} ${
            exceptions.length === 1 ? "exceção" : "exceções"
          }`;

    return {
      buttonLabel: btn,
      summaryLine: `${excText} · ${useZip ? "arquivo ZIP" : "download direto"}`,
    };
  }, [docs, mergePdfMode, mergedPdfName, defaultBatchFormat, batchMode, useZip]);

  const sampleExtension = useMemo(() => {
    const firstFmt = docs[0]?.formato || defaultBatchFormat;
    return DOC_FORMAT_EXT[firstFmt] || "pdf";
  }, [docs, defaultBatchFormat]);

  const countHeaderLabel =
    docs.length === 0
      ? "Nenhum documento na fila"
      : `${docs.length === 1 ? "1 documento" : `${docs.length} documentos`} · ${formatBytes(totalInputBytes)}`;

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
        if (files.length) await handleIncoming(files, fn, hasFolder);
      }}
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8"
    >
      {/* Folha centralizada em Documentos */}
      <motion.div
        initial={{ opacity: 0.94, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.94, transition: { duration: 0.08 } }}
        transition={{
          y: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.12, ease: "easeOut" },
        }}
        className={`mx-auto w-full rounded-[6px] border border-[#BC9200] border-l-4 border-l-[#0B3B46] bg-[#FDE2B9] p-6 text-[#0B3B46] transition-transform duration-200 sm:p-8 ${
          dragActive ? "-translate-y-1" : ""
        }`}
      >
        {/* Cabeçalho simples: título serifado + estado + Adicionar, Pasta e Limpar fila na mesma linha */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-3xl font-semibold text-[#0B3B46] sm:text-4xl">
              {dragActive ? "Solte para adicionar" : "Documentos"}
            </h1>
            <span className="text-[13px] font-medium text-[#06252C]">{countHeaderLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => folderInputRef.current?.click()}>
              Pasta
            </Button>
            {docs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearAll();
                  setResults([]);
                  setLastZip(null);
                  setJustFinished(false);
                }}
                className="rounded-[6px] px-2.5 py-1.5 text-[13px] font-semibold text-[#0B3B46] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
              >
                Limpar fila
              </button>
            )}
          </div>
        </div>

        {/* Estado vazio */}
        {docs.length === 0 ? (
          <div className="rounded-[6px] bg-[#F4D09A]/50 px-6 py-14 text-center">
            <h2 className="font-display text-2xl font-semibold text-[#0B3B46] sm:text-3xl">
              {dragActive
                ? "Solte para adicionar"
                : "Junte, divida e converta PDFs, planilhas e textos."}
            </h2>
            <p className="mx-auto mt-2 max-w-md font-sans text-[13px] text-[#06252C]">
              Arraste arquivos para esta folha. Formatos aceitos: PDF, DOCX, XLSX, CSV, JSON, MD, HTML, TXT e imagens.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#0B3B46] text-[#FDE2B9]"
              >
                <Plus className="h-4 w-4" />
                Escolher documentos
              </Button>
              <Button variant="secondary" onClick={() => folderInputRef.current?.click()}>
                Escolher pasta
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Grupo "O que fazer" em controle segmentado */}
            <div className="rounded-[6px] bg-[#F4D09A]/55 p-3.5">
              <Label>O que fazer</Label>
              <div className="mt-1.5 flex flex-wrap overflow-hidden rounded-[6px] bg-[#FDE2B9]">
                {(
                  [
                    { id: "all_pdf", label: "Para PDF" },
                    { id: "merge_pdf", label: "Juntar em 1 PDF" },
                    { id: "split_pdf", label: "Dividir PDF" },
                    { id: "to_txt", label: "Extrair texto" },
                    { id: "to_csv", label: "Para CSV" },
                    { id: "to_json", label: "Para JSON" },
                  ] as const
                ).map((p) => {
                  const active = batchMode === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectBatchMode(p.id)}
                      className={`flex-1 px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                        active
                          ? "bg-[#0B3B46] font-semibold text-[#FDE2B9] ring-1 ring-inset ring-[#BC9200]"
                          : "text-[#06252C] hover:bg-[#F4D09A]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nome do PDF unificado ou Nome do lote */}
            {mergePdfMode ? (
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-[6px] bg-[#F4D09A]/55 p-3.5">
                <div className="min-w-[220px] flex-1">
                  <Label>Nome do PDF unificado</Label>
                  <Input
                    type="text"
                    value={mergedPdfName}
                    onChange={(e) => setMergedPdfName(e.target.value)}
                    className="font-mono"
                    placeholder="documento_unificado"
                  />
                </div>
                <p className="pb-1.5 text-[13px] text-[#06252C]">
                  Arraste as linhas abaixo para definir a ordem das páginas.
                </p>
              </div>
            ) : (
              <BatchRename
                rule={renameRule}
                onChange={setRenameRule}
                sampleExtension={sampleExtension}
                sampleOriginalBase={docs[0]?.nomeBase || "documento"}
                hasCustomNames={hasCustomNames}
                onResetCustomNames={() => updateAll(() => ({ nomePersonalizado: null }))}
              />
            )}

            {/* Fila em linhas compactas */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[13px] font-semibold text-[#06252C]">Fila</span>
              </div>
              {docs.map((item, index) => (
                <DocumentRow
                  key={item.id}
                  item={item}
                  index={index}
                  total={docs.length}
                  mergePdfMode={mergePdfMode}
                  renameRule={renameRule}
                  onSelectFormat={setRowFormat}
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

            <ProcessingPanel
              visible={processing}
              percent={progressPct}
              statusText={progressText}
              stages={DOC_STAGES}
              activeStage={activeStage}
              queue={queue}
            />

            {/* Único botão principal curto + linha de resumo ao lado */}
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-4 rounded-[6px] bg-[#F4D09A] px-4 py-3">
              <div className="flex flex-wrap items-center gap-4">
                {!mergePdfMode && (
                  <label className="inline-flex items-center gap-2 text-[13px] font-medium text-[#06252C] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useZip}
                      onChange={(e) => setUseZip(e.target.checked)}
                      className="h-4 w-4 accent-[#0B3B46]"
                    />
                    Agrupar em ZIP
                  </label>
                )}
                <span className="text-[13px] font-medium text-[#06252C]">{summaryLine}</span>
              </div>

              <Button
                size="lg"
                disabled={processing}
                onClick={runDocsBatch}
                className="bg-[#0B3B46] text-[#FDE2B9]"
              >
                {processing
                  ? "Convertendo..."
                  : justFinished
                  ? "Pronto · baixar tudo"
                  : buttonLabel}
              </Button>
            </div>
          </div>
        )}

        {/* Resultados na mesma folha principal */}
        {results.length > 0 && (
          <div ref={resultsRef} className="mt-8 border-t border-[#0B3B46]/20 pt-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-[#0B3B46]">
                Resultado
              </h2>

              {lastZip && (
                <Button
                  size="sm"
                  onClick={() =>
                    triggerDownload(base64ToBlob(lastZip.base64, "application/zip"), lastZip.nome)
                  }
                  className="bg-[#0B3B46] text-[#FDE2B9]"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Baixar ZIP
                </Button>
              )}
            </div>

            <div className="space-y-2">
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

                const pageLabel =
                  r.paginas === 1
                    ? "1 página"
                    : r.paginas && r.paginas > 1
                    ? `${r.paginas} páginas`
                    : "";

                return (
                  <div
                    key={`${r.salvo_como || r.nome}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-[#F4D09A]/55 px-3.5 py-2.5"
                  >
                    {r.status === "ok" ? (
                      <>
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-5 text-[13px] font-semibold text-[#0B3B46]">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-mono text-[13px] font-semibold text-[#06252C]">
                              {r.salvo_como}
                            </p>
                            <p className="text-[13px] text-[#06252C]">
                              {r.tamanho_bytes ? formatBytes(r.tamanho_bytes) : ""}
                              {pageLabel ? ` · ${pageLabel}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canPreview && (
                            <Button size="sm" variant="secondary" onClick={() => openPreview(r)}>
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
                              className="bg-[#0B3B46] text-[#FDE2B9]"
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
                        <p className="mt-0.5 text-[13px] text-[#3B0011]">{r.mensagem}</p>
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
            handleIncoming(list, folder, true);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
