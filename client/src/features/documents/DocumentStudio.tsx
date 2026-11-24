import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Combine,
  Download,
  Eye,
  FileText,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useDocuments } from "../../state/documents";
import { useSection } from "../../state/section";
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
  { id: "lendo", label: "Ler Arquivo" },
  { id: "convertendo", label: "Transformar" },
  { id: "finalizando", label: "Finalizar" },
];

const STAGE_TEXT: Record<string, string> = {
  lendo: "Lendo documento",
  convertendo: "Transformando formato",
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
  const { activeRouteAction } = useSection();
  const { notify } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [mergePdfMode, setMergePdfMode] = useState(false);
  const [mergedPdfName, setMergedPdfName] = useState("documento_unificado");
  const [activeActionPill, setActiveActionPill] = useState<string>("all_pdf");

  // Reage à rota vinda do Portal (#/documentos?acao=unificar | pdf | planilhas)
  useEffect(() => {
    if (activeRouteAction === "unificar") {
      setMergePdfMode(true);
      setActiveActionPill("merge_pdf");
    } else if (activeRouteAction === "planilhas") {
      setMergePdfMode(false);
      setActiveActionPill("to_csv");
      updateAll((d) =>
        getTargetDocFormats(d.extensao).includes("CSV")
          ? { formato: "CSV", delimitadorCsv: ";" }
          : {}
      );
    } else if (activeRouteAction === "pdf") {
      setMergePdfMode(false);
      setActiveActionPill("all_pdf");
      updateAll(() => ({ formato: "PDF" }));
    }
  }, [activeRouteAction, updateAll]);

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
      notify("Esses documentos já estão na mesa.", "neutral");
    }
  };

  const applyPreset = (
    preset: "all_pdf" | "merge_pdf" | "split_pdf" | "to_txt" | "to_csv" | "to_json"
  ) => {
    setActiveActionPill(preset);
    if (!docs.length) return;

    if (preset === "merge_pdf") {
      setMergePdfMode(true);
      notify("Modo Juntar em 1 PDF ativado.", "ok");
      return;
    }

    setMergePdfMode(false);

    if (preset === "all_pdf") {
      updateAll(() => ({ formato: "PDF" }));
      notify("Todos os arquivos configurados para virar PDF.", "ok");
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
          ? `${count} PDF(s) configurados para separar páginas.`
          : "Adicione um PDF para separar páginas.",
        count > 0 ? "ok" : "warn"
      );
    } else if (preset === "to_txt") {
      updateAll((d) =>
        getTargetDocFormats(d.extensao).includes("TXT") ? { formato: "TXT" } : {}
      );
      notify("Extração de texto (.txt) ativada.", "ok");
    } else if (preset === "to_csv") {
      updateAll((d) =>
        getTargetDocFormats(d.extensao).includes("CSV")
          ? { formato: "CSV", delimitadorCsv: ";" }
          : {}
      );
      notify("Conversão para CSV (;) ativada.", "ok");
    } else if (preset === "to_json") {
      updateAll((d) =>
        getTargetDocFormats(d.extensao).includes("JSON") ? { formato: "JSON" } : {}
      );
      notify("Conversão para JSON ativada.", "ok");
    }
  };

  const runDocsBatch = async () => {
    if (!docs.length || processing) return;

    setProcessing(true);
    setProgressPct(4);
    setProgressText(mergePdfMode ? "Juntando arquivos em PDF..." : "Transformando documentos...");
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
          setProgressText("Documentos prontos.");
          setQueue((prev) => prev.map((q) => (q.status === "erro" ? q : { ...q, status: "concluida" })));
          if (activeZip && evt.zip_base64) {
            const z = { base64: evt.zip_base64, nome: evt.nome_zip || "revela_documentos.zip" };
            setLastZip(z);
            triggerDownload(base64ToBlob(z.base64, "application/zip"), z.nome);
          }
        }
      });

      if (!completed && collected.length > 0) {
        notify("Conexão interrompida; arquivos já gerados foram salvos.", "warn");
      }

      setResults(collected);
      const okCount = collected.filter((r) => r.status === "ok").length;
      if (okCount > 0) {
        notify(
          mergePdfMode
            ? "PDF unificado gerado."
            : `${okCount} ${okCount === 1 ? "documento pronto" : "documentos prontos"}.`,
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
      className="mx-auto max-w-7xl px-4 py-5 sm:px-8"
    >
      {/* Barra Topo em Creme (#FDE2B9) com Borda Dourada (#BC9200) sobre o Rio Petróleo (#0B3B46) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] px-6 py-4 text-[#0B3B46] shadow-2xl">
        <div>
          <span className="rounded bg-[#60011D] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#FDE2B9]">
            02 · Mesa de Documentos
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold text-[#0B3B46] sm:text-4xl">
            Transformar Documentos
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4" />
            Adicionar Documentos
          </Button>
          {docs.length > 0 && (
            <Button variant="opposite" size="lg" disabled={processing} onClick={runDocsBatch}>
              <Sparkles className="h-4 w-4 text-[#BC9200]" />
              {processing
                ? "Transformando..."
                : mergePdfMode
                ? `Juntar ${docs.length} em 1 PDF`
                : `Transformar ${docs.length} Arquivo(s)`}
            </Button>
          )}
        </div>
      </div>

      {/* Estado Vazio: Ficha Creme Luminosa sobre o Rio Petróleo */}
      {docs.length === 0 && (
        <div className="my-8 rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] p-10 text-center text-[#0B3B46] shadow-2xl sm:p-14">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#BC9200] bg-[#0B3B46] text-[#FDE2B9] shadow-lg">
            <FileText className="h-8 w-8 text-[#BC9200]" />
          </div>
          <h2 className="font-display text-3xl font-bold text-[#0B3B46] sm:text-4xl">
            Solte seus PDFs, documentos Word, planilhas ou imagens aqui
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-[#0B3B46]/80">
            Converta para PDF, DOCX, XLSX, CSV, JSON, Markdown ou TXT, divida páginas ou junte vários arquivos em um único PDF.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => fileInputRef.current?.click()}>
              <FileText className="h-4 w-4 text-[#BC9200]" />
              Escolher Documentos
            </Button>
          </div>
        </div>
      )}

      {/* Painel Principal em Creme (#FDE2B9) com Pílulas em Petróleo (#0B3B46) e Bordô (#60011D) */}
      {docs.length > 0 && (
        <section className="mb-10 space-y-5 rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] p-5 text-[#0B3B46] shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#0B3B46]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-[#0B3B46] px-3 py-1 font-mono text-xs font-bold text-[#FDE2B9]">
                {docs.length} arquivo(s)
              </span>
              <h2 className="font-display text-xl font-bold text-[#0B3B46]">
                O que você quer fazer com estes documentos?
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                clearAll();
                setResults([]);
                setLastZip(null);
                setMergePdfMode(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#60011D] px-3 py-1.5 font-mono text-xs font-bold text-[#FDE2B9] hover:bg-[#7d0428] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar Tudo
            </button>
          </div>

          {/* Pílulas Grandes de Ação em 1 Clique */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { id: "all_pdf" as const, title: "Tudo para PDF", sub: "1 PDF por arquivo" },
              { id: "merge_pdf" as const, title: "Juntar em 1 PDF", sub: "Unifica toda a fila" },
              { id: "split_pdf" as const, title: "Dividir PDF", sub: "1 página = 1 PDF" },
              { id: "to_txt" as const, title: "Extrair Texto", sub: "Gera .txt limpo" },
              { id: "to_csv" as const, title: "Planilha → CSV", sub: "Excel Brasil (;)" },
              { id: "to_json" as const, title: "Planilha → JSON", sub: "Lista de dados" },
            ].map((p) => {
              const active =
                (p.id === "merge_pdf" && mergePdfMode) ||
                (!mergePdfMode && activeActionPill === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                    active
                      ? "border-[#BC9200] bg-[#60011D] text-[#FDE2B9] shadow-md"
                      : "border-[#0B3B46]/25 bg-[#FFF3DE] text-[#0B3B46] hover:border-[#0B3B46]"
                  }`}
                >
                  <span className="text-xs font-bold">{p.title}</span>
                  <span className="mt-0.5 font-mono text-[10px] opacity-80">{p.sub}</span>
                </button>
              );
            })}
          </div>

          {/* Se estiver no modo Juntar em 1 PDF, mostra campo único para o nome do PDF */}
          {mergePdfMode ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#60011D] bg-[#60011D] p-4 text-[#FDE2B9]">
              <div className="flex items-center gap-2.5">
                <Combine className="h-5 w-5 text-[#BC9200]" />
                <div>
                  <p className="text-sm font-bold">
                    Modo Unificar Ativo: todos os {docs.length} arquivos serão juntados em 1 único PDF
                  </p>
                  <p className="text-xs text-[#FDE2B9]/80">
                    Use as setas ou arraste os itens abaixo para mudar a ordem das páginas.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold">Nome do PDF:</span>
                <Input
                  type="text"
                  value={mergedPdfName}
                  onChange={(e) => setMergedPdfName(e.target.value)}
                  className="w-52 font-mono"
                  placeholder="documento_unificado"
                />
                <span className="font-mono text-xs font-bold text-[#BC9200]">.pdf</span>
              </div>
            </div>
          ) : (
            <BatchRename
              rule={renameRule}
              onChange={setRenameRule}
              sampleExtension={DOC_FORMAT_EXT[docs[0]?.formato || "PDF"]}
              sampleOriginalBase={docs[0]?.nomeBase || "documento"}
              hasCustomNames={hasCustomNames}
              onResetCustomNames={() => updateAll(() => ({ nomePersonalizado: null }))}
            />
          )}

          {/* Lista de Fichas de Documentos */}
          <div className="space-y-2.5">
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

          {/* Rodapé de Ação */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#0B3B46]/15 pt-4">
            {!mergePdfMode ? (
              <label className="inline-flex items-center gap-2.5 text-xs font-bold text-[#0B3B46] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useZip}
                  onChange={(e) => setUseZip(e.target.checked)}
                  className="h-4 w-4 accent-[#0B3B46]"
                />
                Baixar todos juntos em um pacote .ZIP
              </label>
            ) : (
              <span className="font-mono text-xs font-bold text-[#60011D]">
                Saída: {mergedPdfName || "documento_unificado"}.pdf
              </span>
            )}

            <Button variant="opposite" size="lg" disabled={processing} onClick={runDocsBatch}>
              <Sparkles className="h-4 w-4 text-[#BC9200]" />
              {processing
                ? "Transformando..."
                : mergePdfMode
                ? `Juntar ${docs.length} Arquivos em 1 PDF`
                : `Transformar ${docs.length} Documento(s) Agora`}
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

      {/* Resultados de Documentos em Ficha Creme */}
      {results.length > 0 && (
        <section
          ref={resultsRef}
          className="rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] p-6 text-[#0B3B46] shadow-2xl"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#0B3B46]/15 pb-4">
            <div>
              <span className="rounded bg-[#60011D] px-2.5 py-1 font-mono text-xs font-bold text-[#FDE2B9]">
                Concluído
              </span>
              <h2 className="mt-1.5 font-display text-3xl font-bold text-[#0B3B46]">
                Documentos Transformados
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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

          <div className="space-y-2.5">
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] px-4 py-3 shadow-sm"
                >
                  {r.status === "ok" ? (
                    <>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="rounded-md bg-[#0B3B46] px-2 py-1 font-mono text-xs font-bold text-[#FDE2B9]">
                          #{String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="rounded-md bg-[#60011D] px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-[#FDE2B9]">
                          {getExtension(r.salvo_como || "") || "doc"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-bold text-[#0B3B46]">
                            {r.salvo_como}
                          </p>
                          <p className="font-mono text-[11px] font-medium text-[#60011D]">
                            Origem: {r.nome}
                            {r.tamanho_bytes ? ` · ${formatBytes(r.tamanho_bytes)}` : ""}
                            {r.paginas ? ` · ${r.paginas} página(s)` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canPreview && (
                          <Button size="sm" variant="secondary" onClick={() => openPreview(r)}>
                            <Eye className="h-3.5 w-3.5" />
                            Visualizar
                          </Button>
                        )}
                        {r.dados && (
                          <Button
                            size="sm"
                            variant="opposite"
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
                    </>
                  ) : (
                    <div>
                      <p className="font-mono text-xs font-bold text-[#60011D]">{r.nome}</p>
                      <p className="mt-0.5 text-xs font-medium text-[#60011D]/80">{r.mensagem}</p>
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
