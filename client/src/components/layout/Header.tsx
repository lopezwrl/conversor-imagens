import { motion } from "framer-motion";
import { useSection } from "../../state/section";
import { useImages } from "../../state/images";
import { useDocuments } from "../../state/documents";
import type { SectionId } from "../../types/shared";

export function Header() {
  const { section, setSection } = useSection();
  const { items: images } = useImages();
  const { items: docs } = useDocuments();

  const navItems: Array<{ id: SectionId; numeral: string; label: string; count?: number }> = [
    { id: "portal", numeral: "I", label: "Início" },
    { id: "photos", numeral: "II", label: "Fotos", count: images.length || undefined },
    { id: "docs", numeral: "III", label: "Documentos", count: docs.length || undefined },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#FDE2B9]/18 bg-[#120307]/85">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5 sm:px-8">
        {/* Assinatura editorial à esquerda */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSection("portal")}
            className="font-display text-lg font-semibold tracking-tight text-[#FDE2B9] hover:text-[#BC9200] transition-colors cursor-pointer"
          >
            Revela
          </button>
          <span className="hidden h-3 w-[1px] bg-[#FDE2B9]/25 sm:inline-block" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#FDE2B9]/55 md:inline-block">
            Estúdio de lote
          </span>
        </div>

        {/* Régua de navegação centralizada */}
        <nav
          aria-label="Seções do Revela"
          className="flex items-center divide-x divide-[#FDE2B9]/18 border border-[#FDE2B9]/25 bg-black/35"
        >
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`relative flex items-baseline gap-2 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors cursor-pointer sm:px-6 ${
                  active
                    ? "text-[#140509] font-semibold"
                    : "text-[#FDE2B9]/80 hover:text-[#FDE2B9]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="revela-ruler-active"
                    transition={{ type: "spring", stiffness: 440, damping: 34 }}
                    className="absolute inset-0 bg-[#FDE2B9]"
                  />
                )}
                <span className="relative z-10 text-[10px] opacity-65">{item.numeral}.</span>
                <span className="relative z-10">{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`relative z-10 font-mono text-[10px] ${
                      active ? "text-[#60011D] font-bold" : "text-[#BC9200]"
                    }`}
                  >
                    [{String(item.count).padStart(2, "0")}]
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Coordenada técnica à direita */}
        <div className="hidden items-center justify-end font-mono text-[10px] uppercase tracking-[0.16em] text-[#FDE2B9]/60 sm:flex">
          {section === "portal" && <span>ESTUÁRIO · 50 / 50</span>}
          {section === "photos" && <span className="text-[#9EDEE5]">BORDÔ #60011D</span>}
          {section === "docs" && <span className="text-[#F4BFC2]">PETRÓLEO #0B3B46</span>}
        </div>
      </div>
    </header>
  );
}
