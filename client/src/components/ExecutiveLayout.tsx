import { type ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Plus, BarChart3, ChevronRight } from "lucide-react";
import type { Objective } from "../types";

interface Props {
  children: ReactNode;
  objectives: Objective[];
  selectedId: string | null;
  loading: boolean;
  view: string;
  onSelect: (id: string) => void;
  onNewBrainDump: () => void;
  onDashboard: () => void;
}

const statusAccent: Record<string, string> = {
  PLANNING: "bg-amber-400",
  ACTIVE: "bg-blue-400",
  COMPLETED: "bg-emerald-400",
  ARCHIVED: "bg-zinc-600",
};

export default function ExecutiveLayout({
  children,
  objectives,
  selectedId,
  loading,
  view,
  onSelect,
  onNewBrainDump,
  onDashboard,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-full flex flex-col bg-black">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at top center, rgba(120, 53, 15, 0.15) 0%, transparent 50%, black 100%)",
        }}
      />

      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-30 mx-4 mt-4 rounded-2xl border border-amber-500/10 bg-black/60 backdrop-blur-xl px-6 py-3 flex items-center justify-between shadow-lg shadow-amber-900/5"
      >
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={onNewBrainDump}
        >
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Crown className="w-4 h-4 text-black" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-wide text-amber-50">
              JARVIS
            </span>
            <span className="text-[9px] tracking-[0.15em] text-amber-500/70 font-medium">
              Decision Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDashboard}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all duration-300 ${
              view === "dashboard"
                ? "bg-white/5 text-amber-300 border border-amber-500/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Vault</span>
          </button>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNewBrainDump}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-linear-to-r from-amber-500/90 to-yellow-500/90 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-shadow duration-300"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Entry</span>
          </motion.button>
        </div>
      </motion.header>

      <div className="relative z-10 flex flex-1 overflow-hidden mt-4">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full shrink-0 overflow-hidden"
            >
              <div className="h-full w-65 border-r border-amber-500/5 bg-black/40 backdrop-blur-md flex flex-col">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-zinc-500">
                    Decisions
                  </span>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="text-zinc-700 hover:text-zinc-400 transition-colors p-1"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-2 pb-4">
                  {loading ? (
                    <div className="space-y-2 px-2 pt-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-9 rounded-lg bg-linear-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-shimmer"
                        />
                      ))}
                    </div>
                  ) : objectives.length === 0 ? (
                    <p className="text-[11px] text-zinc-600 px-3 pt-4 italic">
                      No decisions yet.
                    </p>
                  ) : (
                    <div className="space-y-0.5 pt-1">
                      {objectives.map((obj) => (
                        <motion.button
                          key={obj.id}
                          whileHover={{ x: 2 }}
                          onClick={() => onSelect(obj.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group flex items-center gap-2.5 ${
                            selectedId === obj.id
                              ? "bg-amber-500/8 text-amber-100 border border-amber-500/10"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/3"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              statusAccent[obj.status] ?? "bg-zinc-600"
                            }`}
                          />
                          <span className="truncate text-[13px]">
                            {obj.what || obj.raw_input?.slice(0, 40) || "Untitled"}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </nav>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setSidebarOpen(true)}
            className="absolute left-2 top-4 z-20 p-2 rounded-lg bg-black/60 border border-amber-500/10 text-zinc-600 hover:text-amber-400 transition-colors backdrop-blur-md"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.button>
        )}

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="max-w-3xl mx-auto px-6 py-8"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={view + (selectedId ?? "")}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
