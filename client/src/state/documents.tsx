import React, { createContext, useCallback, useContext, useReducer, useRef } from "react";
import type { DocRecord } from "../types/document";
import { computeFileHash, getBaseName, getExtension } from "../lib/files";
import { DOC_ACCEPTED_EXTENSIONS, getTargetDocFormats } from "../lib/formats";

interface DocsState {
  items: DocRecord[];
  folderName: string;
  useZip: boolean;
}

type DocsAction =
  | { type: "ADD"; items: DocRecord[]; folderName?: string | null; forceZip?: boolean }
  | { type: "UPDATE"; id: string; patch: Partial<DocRecord> }
  | { type: "UPDATE_ALL"; updater: (item: DocRecord) => Partial<DocRecord> }
  | { type: "MOVE"; fromIndex: number; toIndex: number }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" }
  | { type: "SET_ZIP"; useZip: boolean };

function reducer(state: DocsState, action: DocsAction): DocsState {
  switch (action.type) {
    case "ADD": {
      const next = [...state.items, ...action.items];
      return {
        items: next,
        folderName: action.folderName || state.folderName,
        useZip: action.forceZip || next.length >= 2 ? true : state.useZip,
      };
    }
    case "UPDATE":
      return {
        ...state,
        items: state.items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it)),
      };
    case "UPDATE_ALL":
      return {
        ...state,
        items: state.items.map((it) => ({ ...it, ...action.updater(it) })),
      };
    case "MOVE": {
      const { fromIndex, toIndex } = action;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.items.length ||
        toIndex >= state.items.length
      ) {
        return state;
      }
      const copy = [...state.items];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return { ...state, items: copy };
    }
    case "REMOVE": {
      const removed = state.items.find((it) => it.id === action.id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return {
        ...state,
        items: state.items.filter((it) => it.id !== action.id),
      };
    }
    case "CLEAR":
      state.items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
      return { ...state, items: [] };
    case "SET_ZIP":
      return { ...state, useZip: action.useZip };
    default:
      return state;
  }
}

interface DocsContextValue {
  items: DocRecord[];
  folderName: string;
  useZip: boolean;
  setUseZip: (v: boolean) => void;
  addFiles: (files: File[], folderName?: string | null, hasFolder?: boolean) => Promise<number>;
  updateItem: (id: string, patch: Partial<DocRecord>) => void;
  updateAll: (updater: (item: DocRecord) => Partial<DocRecord>) => void;
  moveItem: (fromIndex: number, toIndex: number) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

const DocsContext = createContext<DocsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    folderName: "documentos",
    useZip: true,
  });

  const hashesRef = useRef<Set<string>>(new Set());

  const addFiles = useCallback(
    async (rawFiles: File[], folderName?: string | null, hasFolder?: boolean): Promise<number> => {
      const valid = rawFiles.filter((f) => DOC_ACCEPTED_EXTENSIONS.has(getExtension(f.name)));
      if (!valid.length) return 0;

      const added: DocRecord[] = [];
      for (const file of valid) {
        const hash = await computeFileHash(file);
        if (hashesRef.current.has(hash)) continue;
        hashesRef.current.add(hash);

        const ext = getExtension(file.name);
        const targets = getTargetDocFormats(ext);
        const isImg = ["png", "jpg", "jpeg", "webp"].includes(ext);

        added.push({
          id: `${hash.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
          hash,
          file,
          nome: file.name,
          nomeBase: getBaseName(file.name),
          extensao: ext,
          tamanhoBytes: file.size,
          previewUrl: isImg ? URL.createObjectURL(file) : undefined,
          formato: targets[0],
          rotacao: 0,
          intervaloPaginas: "",
          tamanhoPagina: "A4",
          orientacao: "portrait",
          delimitadorCsv: ";",
          nomePersonalizado: null,
        });
      }

      if (added.length > 0) {
        dispatch({ type: "ADD", items: added, folderName, forceZip: hasFolder });
      }
      return added.length;
    },
    []
  );

  const updateItem = useCallback((id: string, patch: Partial<DocRecord>) => {
    dispatch({ type: "UPDATE", id, patch });
  }, []);

  const updateAll = useCallback((updater: (item: DocRecord) => Partial<DocRecord>) => {
    dispatch({ type: "UPDATE_ALL", updater });
  }, []);

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: "MOVE", fromIndex, toIndex });
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      const target = state.items.find((i) => i.id === id);
      if (target) hashesRef.current.delete(target.hash);
      dispatch({ type: "REMOVE", id });
    },
    [state.items]
  );

  const clearAll = useCallback(() => {
    hashesRef.current.clear();
    dispatch({ type: "CLEAR" });
  }, []);

  const setUseZip = useCallback((useZip: boolean) => {
    dispatch({ type: "SET_ZIP", useZip });
  }, []);

  return (
    <DocsContext.Provider
      value={{
        items: state.items,
        folderName: state.folderName,
        useZip: state.useZip,
        setUseZip,
        addFiles,
        updateItem,
        updateAll,
        moveItem,
        removeItem,
        clearAll,
      }}
    >
      {children}
    </DocsContext.Provider>
  );
}

export function useDocuments() {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocuments deve ser usado dentro de DocumentsProvider");
  return ctx;
}
