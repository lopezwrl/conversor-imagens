import React, { createContext, useCallback, useContext, useReducer, useRef } from "react";
import type { ImageRecord } from "../types/image";
import { computeFileHash, getBaseName, getExtension } from "../lib/files";
import { IMAGE_EXTENSIONS, inferImageFormat } from "../lib/formats";

interface ImagesState {
  items: ImageRecord[];
  folderName: string;
  useZip: boolean;
}

type ImagesAction =
  | { type: "ADD"; items: ImageRecord[]; folderName?: string | null; forceZip?: boolean }
  | { type: "UPDATE"; id: string; patch: Partial<ImageRecord> }
  | { type: "UPDATE_ALL"; updater: (item: ImageRecord) => Partial<ImageRecord> }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" }
  | { type: "SET_ZIP"; useZip: boolean };

function reducer(state: ImagesState, action: ImagesAction): ImagesState {
  switch (action.type) {
    case "ADD": {
      const nextItems = [...state.items, ...action.items];
      return {
        items: nextItems,
        folderName: action.folderName || state.folderName,
        useZip: action.forceZip || nextItems.length >= 3 ? true : state.useZip,
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
    case "REMOVE": {
      const removed = state.items.find((it) => it.id === action.id);
      if (removed) URL.revokeObjectURL(removed.urlMiniatura);
      return {
        ...state,
        items: state.items.filter((it) => it.id !== action.id),
      };
    }
    case "CLEAR":
      state.items.forEach((it) => URL.revokeObjectURL(it.urlMiniatura));
      return { ...state, items: [] };
    case "SET_ZIP":
      return { ...state, useZip: action.useZip };
    default:
      return state;
  }
}

interface ImagesContextValue {
  items: ImageRecord[];
  folderName: string;
  useZip: boolean;
  setUseZip: (v: boolean) => void;
  addFiles: (files: File[], folderName?: string | null, hasFolder?: boolean) => Promise<number>;
  updateItem: (id: string, patch: Partial<ImageRecord>) => void;
  updateAll: (updater: (item: ImageRecord) => Partial<ImageRecord>) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

const ImagesContext = createContext<ImagesContextValue | null>(null);

export function ImagesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    folderName: "revela",
    useZip: true,
  });

  const hashesRef = useRef<Set<string>>(new Set());

  const addFiles = useCallback(
    async (rawFiles: File[], folderName?: string | null, hasFolder?: boolean): Promise<number> => {
      const valid = rawFiles.filter((f) => IMAGE_EXTENSIONS.has(getExtension(f.name)));
      if (!valid.length) return 0;

      const added: ImageRecord[] = [];
      for (const file of valid) {
        const hash = await computeFileHash(file);
        if (hashesRef.current.has(hash)) continue;
        hashesRef.current.add(hash);

        let w = 0;
        let h = 0;
        try {
          const bmp = await createImageBitmap(file);
          w = bmp.width;
          h = bmp.height;
          bmp.close();
        } catch {
          // Formatos como TIFF ou BMP são lidos diretamente pelo sharp no servidor
        }

        const fmt = inferImageFormat(getExtension(file.name));
        added.push({
          id: `${hash.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
          hash,
          file,
          nome: file.name,
          nomeBase: getBaseName(file.name),
          larguraOriginal: w,
          alturaOriginal: h,
          tamanhoBytes: file.size,
          urlMiniatura: URL.createObjectURL(file),
          formatoOriginal: fmt,
          formato: fmt,
          largura: "",
          altura: "",
          qualidade: 90,
          manterProporcao: true,
          modoAjuste: "inside",
          removerFundo: false,
          modoRemocao: "automatico",
          sensibilidadeFundo: 50,
          corFundo: "#ffffff",
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

  const updateItem = useCallback((id: string, patch: Partial<ImageRecord>) => {
    dispatch({ type: "UPDATE", id, patch });
  }, []);

  const updateAll = useCallback((updater: (item: ImageRecord) => Partial<ImageRecord>) => {
    dispatch({ type: "UPDATE_ALL", updater });
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
    <ImagesContext.Provider
      value={{
        items: state.items,
        folderName: state.folderName,
        useZip: state.useZip,
        setUseZip,
        addFiles,
        updateItem,
        updateAll,
        removeItem,
        clearAll,
      }}
    >
      {children}
    </ImagesContext.Provider>
  );
}

export function useImages() {
  const ctx = useContext(ImagesContext);
  if (!ctx) throw new Error("useImages deve ser usado dentro de ImagesProvider");
  return ctx;
}
