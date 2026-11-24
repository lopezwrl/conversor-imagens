import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SectionId, WaterTheme } from "../types/shared";

interface SectionContextValue {
  section: SectionId;
  setSection: (next: SectionId) => void;
  waterTheme: WaterTheme;
  portalHover: WaterTheme | null;
  setPortalHover: (side: WaterTheme | null) => void;
  portalDrag: WaterTheme | null;
  setPortalDrag: (side: WaterTheme | null) => void;
}

const SectionContext = createContext<SectionContextValue | null>(null);

function readInitialSection(): SectionId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "fotos" || hash === "photos") return "photos";
  if (hash === "documentos" || hash === "docs") return "docs";
  return "portal";
}

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const [section, setSectionState] = useState<SectionId>(readInitialSection);
  const [lastWater, setLastWater] = useState<WaterTheme>(() =>
    readInitialSection() === "docs" ? "docs" : "photos"
  );
  const [portalHover, setPortalHover] = useState<WaterTheme | null>(null);
  const [portalDrag, setPortalDrag] = useState<WaterTheme | null>(null);

  const waterTheme: WaterTheme =
    section === "docs"
      ? "docs"
      : section === "photos"
      ? "photos"
      : portalDrag || portalHover || lastWater;

  const setSection = useCallback((next: SectionId) => {
    setSectionState(next);
    if (next === "photos" || next === "docs") {
      setLastWater(next);
    }
    setPortalHover(null);
    setPortalDrag(null);
    const hash = next === "photos" ? "#/fotos" : next === "docs" ? "#/documentos" : "#/";
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onHash = () => {
      const s = readInitialSection();
      setSectionState(s);
      if (s === "photos" || s === "docs") setLastWater(s);
    };
    window.addEventListener("popstate", onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", onHash);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", waterTheme);
  }, [waterTheme]);

  return (
    <SectionContext.Provider
      value={{
        section,
        setSection,
        waterTheme,
        portalHover,
        setPortalHover,
        portalDrag,
        setPortalDrag,
      }}
    >
      {children}
    </SectionContext.Provider>
  );
}

export function useSection() {
  const ctx = useContext(SectionContext);
  if (!ctx) throw new Error("useSection deve ser usado dentro de SectionProvider");
  return ctx;
}
