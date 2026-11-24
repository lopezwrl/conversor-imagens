import { motion } from "framer-motion";
import { FileText, Image as ImageIcon, LayoutGrid, Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { SectionMode } from "../../types/revela";

interface HeaderProps {
  photoCount: number;
  docCount: number;
}

export function Header({ photoCount, docCount }: HeaderProps) {
  const { section, setSection, currentMode, toggleCurrentMode, themeLabel } = useTheme();

  const navItems: Array<{ id: SectionMode; label: string; icon: typeof ImageIcon; badge?: number }> = [
    { id: "portal", label: "Início", icon: LayoutGrid },
    { id: "photos", label: "Fotos", icon: ImageIcon, badge: photoCount || undefined },
    { id: "docs", label: "Documentos", icon: FileText, badge: docCount || undefined },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-glass)] backdrop-blur-xl transition-colors duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        {/* Marca Revela */}
        <button
          type="button"
          onClick={() => setSection("portal")}
          className="group flex items-center gap-3 text-left cursor-pointer"
          title="Voltar ao portal inicial"
        >
          <motion.div
            whileHover={{ rotate: 6, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-strong)] shadow-[var(--shadow-sm)]"
            style={{
              background:
                section === "docs"
                  ? "linear-gradient(135deg, #0B3B46 0%, #156272 100%)"
                  : "linear-gradient(135deg, #60011D 0%, #8E0E35 100%)",
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="4" width="10" height="10" rx="2.5" stroke="#FDE2B9" strokeWidth="2.2" />
              <rect x="18" y="4" width="10" height="10" rx="2.5" stroke="#BC9200" strokeWidth="2.2" />
              <rect x="4" y="18" width="10" height="10" rx="2.5" stroke="#BC9200" strokeWidth="2.2" />
              <rect x="18" y="18" width="10" height="10" rx="2.5" stroke="#FDE2B9" strokeWidth="2.2" />
            </svg>
          </motion.div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold tracking-tight revela-shimmer">Revela</span>
              <span className="hidden rounded-full border border-[var(--border)] bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-text)] sm:inline-block">
                Sem login · Em lote
              </span>
            </div>
            <p className="hidden text-xs text-[var(--text-muted)] md:block">
              Estúdio rápido de imagens e documentos
            </p>
          </div>
        </button>

        {/* Pill Switcher Animado (estilo 21st.dev) */}
        <nav
          aria-label="Alternar área do Revela"
          className="flex items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-sm)]"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isActive ? "text-[var(--brand-foreground)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="revela-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%)",
                      boxShadow: "0 4px 14px -4px var(--brand)",
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className={item.id === "portal" ? "hidden sm:inline" : ""}>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                        isActive
                          ? "bg-black/25 text-[#FDE2B9]"
                          : "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Toggle Claro/Escuro do Tema Ativo */}
        <div className="flex items-center gap-2.5">
          {section !== "portal" && (
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--text-secondary)] lg:inline-flex">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: section === "docs" ? "#0B3B46" : "#60011D", boxShadow: "0 0 0 2px var(--accent)" }}
              />
              {themeLabel}
            </span>
          )}
          <motion.button
            type="button"
            onClick={toggleCurrentMode}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.92 }}
            title={`Alternar modo claro/escuro (${themeLabel})`}
            aria-label="Alternar modo claro e escuro"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--accent-text)] shadow-[var(--shadow-sm)] hover:border-[var(--accent)] cursor-pointer"
          >
            <motion.div
              key={currentMode}
              initial={{ rotate: -65, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
            >
              {currentMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </motion.div>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
