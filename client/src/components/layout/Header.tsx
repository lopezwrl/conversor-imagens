import { motion } from "framer-motion";
import { useSection } from "../../state/section";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import type { SectionId } from "../../types/shared";

export function Header() {
  const { section, navigate } = useSection();
  const { items: images } = useImages();
  const { items: docs } = useDocuments();

  const navItems: Array<{
    id: SectionId;
    label: string;
    activeBg: string;
    activeText: string;
    count?: number;
  }> = [
    { id: "portal", label: "Início", activeBg: "#BC9200", activeText: "#FFF3DE" },
    {
      id: "photos",
      label: "Fotos",
      activeBg: "#60011D",
      activeText: "#FDE2B9",
      count: images.length || undefined,
    },
    {
      id: "docs",
      label: "Documentos",
      activeBg: "#0B3B46",
      activeText: "#FDE2B9",
      count: docs.length || undefined,
    },
  ];

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 pb-2 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-center">
        {/* Barra centralizada em Creme (#FDE2B9) com borda Dourada (#BC9200) */}
        <nav
          aria-label="Navegação principal"
          className="inline-flex items-center gap-1 rounded-full border-2 border-[#BC9200] bg-[#FDE2B9] p-1.5 shadow-xl"
        >
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className="relative flex items-center gap-2 rounded-full px-5 py-2 text-xs sm:text-sm font-bold tracking-wide transition-colors cursor-pointer"
                style={{
                  color: active ? item.activeText : "#60011D",
                }}
              >
                {active && (
                  <motion.span
                    layoutId="revela-center-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-full border border-[#BC9200]"
                    style={{ backgroundColor: item.activeBg }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className="relative z-10 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
                    style={{
                      backgroundColor: active ? "#FDE2B9" : "#0B3B46",
                      color: active ? item.activeBg : "#FDE2B9",
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
