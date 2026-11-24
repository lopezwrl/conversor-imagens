import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ActiveWorkspace, ColorMode, SectionMode, ToastItem } from "../types/revela";

interface ThemeContextValue {
  section: SectionMode;
  setSection: (s: SectionMode) => void;
  photoMode: ColorMode;
  docMode: ColorMode;
  currentMode: ColorMode;
  toggleCurrentMode: () => void;
  toggleModeFor: (target: ActiveWorkspace) => void;
  themeLabel: string;
  toasts: ToastItem[];
  pushToast: (message: string, type?: ToastItem["type"]) => void;
  dismissToast: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_LABELS: Record<`${ActiveWorkspace}:${ColorMode}`, string> = {
  "photos:dark": "Câmara Escura",
  "photos:light": "Ateliê Claro",
  "docs:dark": "Estúdio Noturno",
  "docs:light": "Papelaria Clara",
};

function readStoredMode(key: string, fallback: ColorMode): ColorMode {
  try {
    const val = localStorage.getItem(key);
    if (val === "light" || val === "dark") return val;
  } catch {
    // ignora ambientes restritos
  }
  return fallback;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [section, setSectionState] = useState<SectionMode>(() => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash === "fotos" || hash === "photos") return "photos";
    if (hash === "documentos" || hash === "docs") return "docs";
    return "portal";
  });

  const [photoMode, setPhotoMode] = useState<ColorMode>(() => readStoredMode("revela_mode_photos", "dark"));
  const [docMode, setDocMode] = useState<ColorMode>(() => readStoredMode("revela_mode_docs", "light"));
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const currentMode: ColorMode = section === "docs" ? docMode : photoMode;

  const setSection = useCallback((next: SectionMode) => {
    setSectionState(next);
    const hash = next === "photos" ? "#/fotos" : next === "docs" ? "#/documentos" : "#/";
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (hash === "fotos" || hash === "photos") setSectionState("photos");
      else if (hash === "documentos" || hash === "docs") setSectionState("docs");
      else setSectionState("portal");
    };
    window.addEventListener("popstate", onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", onHash);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-section", section);
    root.setAttribute("data-mode", currentMode);
  }, [section, currentMode]);

  useEffect(() => {
    try {
      localStorage.setItem("revela_mode_photos", photoMode);
    } catch {
      // ignora
    }
  }, [photoMode]);

  useEffect(() => {
    try {
      localStorage.setItem("revela_mode_docs", docMode);
    } catch {
      // ignora
    }
  }, [docMode]);

  const toggleModeFor = useCallback((target: ActiveWorkspace) => {
    if (target === "photos") {
      setPhotoMode((prev) => (prev === "dark" ? "light" : "dark"));
    } else {
      setDocMode((prev) => (prev === "dark" ? "light" : "dark"));
    }
  }, []);

  const toggleCurrentMode = useCallback(() => {
    if (section === "docs") {
      setDocMode((prev) => (prev === "dark" ? "light" : "dark"));
    } else {
      setPhotoMode((prev) => (prev === "dark" ? "light" : "dark"));
    }
  }, [section]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const activeKey: `${ActiveWorkspace}:${ColorMode}` =
    section === "docs" ? `docs:${docMode}` : `photos:${photoMode}`;

  return (
    <ThemeContext.Provider
      value={{
        section,
        setSection,
        photoMode,
        docMode,
        currentMode,
        toggleCurrentMode,
        toggleModeFor,
        themeLabel: THEME_LABELS[activeKey],
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}
