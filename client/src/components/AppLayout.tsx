import type { ReactNode } from "react";
import { Brain, Plus, BarChart3 } from "lucide-react";
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

function statusDot(status: string) {
  const colors: Record<string, string> = {
    PLANNING: "bg-amber-400",
    ACTIVE: "bg-blue-400",
    COMPLETED: "bg-emerald-400",
    ARCHIVED: "bg-zinc-500",
  };
  return colors[status] || "bg-zinc-500";
}

export default function AppLayout({
  children,
  objectives,
  selectedId,
  loading,
  view,
  onSelect,
  onNewBrainDump,
  onDashboard,
}: Props) {
  return (
    <div className="h-full grid grid-cols-[250px_1fr]">
      <aside className="h-full bg-zinc-950 border-r border-white/10 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div
            className="flex items-center gap-2 mb-4 cursor-pointer"
            onClick={onNewBrainDump}
          >
            <Brain className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold tracking-wide text-zinc-100">
              JARVIS
            </span>
            <span className="text-[10px] tracking-widest text-zinc-500">
              DME
            </span>
          </div>
          <button
            onClick={onNewBrainDump}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out border border-white/5"
          >
            <Plus className="w-4 h-4" />
            New Brain Dump
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <button
            onClick={onDashboard}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-in-out mb-1 ${
              view === "dashboard"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>

          <div className="mt-3 mb-2 px-3">
            <span className="text-[10px] font-semibold tracking-widest text-zinc-500">
              Recent Decisions
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 px-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 animate-pulse bg-zinc-800 rounded-lg"
                />
              ))}
            </div>
          ) : objectives.length === 0 ? (
            <p className="text-xs text-zinc-500 px-3">
              No decisions yet. Start a brain dump.
            </p>
          ) : (
            <div className="space-y-0.5">
              {objectives.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => onSelect(obj.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-in-out group flex items-center gap-2 ${
                    selectedId === obj.id
                      ? "bg-white/10 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(
                      obj.status
                    )}`}
                  />
                  <span className="truncate">
                    {obj.what || obj.raw_input?.slice(0, 40) || "Untitled"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </nav>
      </aside>

      <main className="h-full overflow-y-auto bg-zinc-900">
        <div className="max-w-3xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
