import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SectionId, WaterTheme } from "../types/shared";

interface SectionContextValue {
  section: SectionId;
  activeRouteAction: string | null;
  navigate: (next: SectionId, action?: string | null) => void;
  setSection: (next: SectionId) => void;
  waterTheme: WaterTheme;
  portalHover: WaterTheme | null;
  setPortalHover: (side: WaterTheme | null) => void;
  portalDrag: WaterTheme | null;
  setPortalDrag: (side: WaterTheme | null) => void;
}

const SectionContext = createContext<SectionContextValue | null>(null);

function parseLocationHash(): { section: SectionId; action: string | null } {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const params = new URLSearchParams(queryPart || "");
  const action = params.get("acao");

  if (pathPart === "fotos" || pathPart === "photos") {
    return { section: "photos", action };
  }
  if (pathPart === "documentos" || pathPart === "docs") {
    return { section: "docs", action };
  }
  return { section: "portal", action: null };
}

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const initial = parseLocationHash();
  const [section, setSectionState] = useState<SectionId>(initial.section);
  const [activeRouteAction, setActiveRouteAction] = useState<string | null>(initial.action);
  const [lastWater, setLastWater] = useState<WaterTheme>(() =>
    initial.section === "docs" ? "docs" : "photos"
  );
  const [portalHover, setPortalHover] = useState<WaterTheme | null>(null);
  const [portalDrag, setPortalDrag] = useState<WaterTheme | null>(null);

  const waterTheme: WaterTheme =
    section === "docs"
      ? "docs"
      : section === "photos"
      ? "photos"
      : portalDrag || portalHover || lastWater;

  const navigate = useCallback((next: SectionId, action: string | null = null) => {
    setSectionState(next);
    setActiveRouteAction(action);
    if (next === "photos" || next === "docs") {
      setLastWater(next);
    }
    setPortalHover(null);
    setPortalDrag(null);
    const base = next === "photos" ? "#/fotos" : next === "docs" ? "#/documentos" : "#/";
    const hash = action ? `${base}?acao=${encodeURIComponent(action)}` : base;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const setSection = useCallback(
    (next: SectionId) => {
      navigate(next, null);
    },
    [navigate]
  );

  useEffect(() => {
    const onHash = () => {
      const parsed = parseLocationHash();
      setSectionState(parsed.section);
      setActiveRouteAction(parsed.action);
      if (parsed.section === "photos" || parsed.section === "docs") {
        setLastWater(parsed.section);
      }
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
        activeRouteAction,
        navigate,
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
