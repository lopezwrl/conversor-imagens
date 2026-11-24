import { motion } from "framer-motion";
import { useSection } from "../../state/section";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import type { SectionId } from "../../types/shared";

export function Header() {
  const { section, setSection } = useSection();
  const { items: images } = useImages();
  const { items: docs } = useDocuments();

  const navItems: Array<{ id: SectionId; label: string; count?: number }> = [
    { id: "portal", label: "Início" },
    { id: "photos", label: "Fotos", count: images.length || undefined },
    { id: "docs", label: "Documentos", count: docs.length || undefined },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg-deep)]/75 backdrop-blur-md">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3.5 sm:grid-cols-[1fr_auto_1fr] sm:px-8">
        {/* Marca à esquerda */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setSection("portal")}
            className="font-display text-xl font-semibold tracking-tight text-[var(--fg-primary)] transition-opacity hover:opacity-80 cursor-pointer"
          >
            Revela
          </button>
        </div>

        {/* Navegação centralizada */}
        <nav
          aria-label="Navegação principal"
          className="flex items-center justify-center gap-6 sm:gap-10"
        >
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`relative py-1.5 text-xs sm:text-sm tracking-wide transition-colors cursor-pointer ${
                  active
                    ? "font-semibold text-[var(--fg-primary)]"
                    : "font-normal text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                }`}
              >
                <span className="inline-flex items-baseline gap-1.5">
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span className="font-mono text-[10px] text-[var(--accent-bright)]">
                      {String(item.count).padStart(2, "0")}
                    </span>
                  )}
                </span>

                {active && (
                  <motion.span
                    layoutId="revela-center-underline"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-[var(--accent)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Indicador discreto à direita */}
        <div className="hidden items-center justify-end font-mono text-[11px] text-[var(--fg-muted)] sm:flex">
          {section === "photos" && (
            <span>01 / Fotos ({images.length})</span>
          )}
          {section === "docs" && (
            <span>02 / Documentos ({docs.length})</span>
          )}
          {section === "portal" && (images.length > 0 || docs.length > 0) && (
            <span>
              {images.length > 0 ? `${images.length} foto(s)` : ""}
              {images.length > 0 && docs.length > 0 ? " · " : ""}
              {docs.length > 0 ? `${docs.length} doc(s)` : ""}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
