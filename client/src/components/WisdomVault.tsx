import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DashboardData, PatternObjective } from "../types";
import { fetchDashboard, fetchPatternObjectives } from "../api";
import LoadingState from "./LoadingState";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Trophy,
  ShieldAlert,
  Crown,
} from "lucide-react";

interface Props {
  onSelectObjective?: (id: string) => void;
}

export default function WisdomVault({ onSelectObjective }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPattern, setExpandedPattern] = useState<{
    type: string;
    pattern: string;
  } | null>(null);
  const [patternObjs, setPatternObjs] = useState<PatternObjective[]>([]);
  const [patternLoading, setPatternLoading] = useState(false);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState text="Consulting the Ledger..." />;
  if (!data)
    return (
      <p className="text-zinc-600 text-sm italic">
        Failed to load the Wisdom Vault.
      </p>
    );

  const stats = data.stats;
  const totalDecisions =
    Number(stats.completed) + Number(stats.active) + Number(stats.planning);
  const completionRate =
    totalDecisions > 0
      ? Math.round((Number(stats.completed) / totalDecisions) * 100)
      : 0;

  async function handlePatternClick(
    type: "success" | "failure",
    pattern: string
  ) {
    const key = `${type}:${pattern}`;
    const currentKey = expandedPattern
      ? `${expandedPattern.type}:${expandedPattern.pattern}`
      : null;
    if (currentKey === key) {
      setExpandedPattern(null);
      setPatternObjs([]);
      return;
    }
    setExpandedPattern({ type, pattern });
    setPatternLoading(true);
    try {
      const objs = await fetchPatternObjectives(type, pattern);
      setPatternObjs(objs);
    } catch {
      setPatternObjs([]);
    } finally {
      setPatternLoading(false);
    }
  }

  const statCards = [
    {
      value: totalDecisions,
      label: "Total Decisions",
      icon: Crown,
      accent: "text-amber-400",
      border: "border-amber-500/10",
      bg: "bg-amber-500/5",
    },
    {
      value: `${completionRate}%`,
      label: "Completion Rate",
      icon: Activity,
      accent: "text-zinc-300",
      border: "border-white/5",
      bg: "bg-white/3",
    },
    {
      value: stats.successes,
      label: "Successes",
      icon: Trophy,
      accent: "text-emerald-400",
      border: "border-emerald-500/15",
      bg: "bg-emerald-500/5",
    },
    {
      value: stats.failures,
      label: "Failures",
      icon: ShieldAlert,
      accent: "text-rose-400",
      border: "border-rose-900/20",
      bg: "bg-rose-950/20",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div>
        <h1 className="font-serif text-xl text-amber-50/90 tracking-tight mb-1">
          Wisdom Vault
        </h1>
        <p className="text-sm text-zinc-600">
          Your decision intelligence at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`group relative p-4 rounded-xl border ${card.border} ${card.bg} backdrop-blur-md overflow-hidden hover:border-amber-500/20 transition-colors duration-300`}
          >
            <card.icon
              className={`absolute top-3 right-3 w-4 h-4 ${card.accent} opacity-30 group-hover:opacity-60 transition-opacity`}
            />
            <div className={`text-2xl font-semibold ${card.accent} tabular-nums`}>
              {card.value}
            </div>
            <div className="text-[10px] tracking-[0.05em] text-zinc-600 mt-1">
              {card.label}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="p-5 rounded-xl border border-emerald-500/10 bg-emerald-500/3"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300/80">
              Success Drivers
            </span>
          </div>
          {data.success_patterns.length === 0 ? (
            <p className="text-sm text-zinc-700 italic">No patterns yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.success_patterns.map((p, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    handlePatternClick("success", p.success_driver)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-emerald-500/8 text-emerald-400 border border-emerald-500/15 text-xs font-medium hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-all duration-300"
                >
                  {p.success_driver}
                  <span className="bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    {p.count}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-5 rounded-xl border border-rose-900/20 bg-rose-950/15"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-semibold text-rose-300/80">
              Failure Traps
            </span>
          </div>
          {data.failure_patterns.length === 0 ? (
            <p className="text-sm text-zinc-700 italic">No patterns yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.failure_patterns.map((p, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    handlePatternClick("failure", p.failure_reason)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-rose-500/8 text-rose-400 border border-rose-500/15 text-xs font-medium hover:bg-rose-500/15 hover:border-rose-500/30 transition-all duration-300"
                >
                  {p.failure_reason}
                  <span className="bg-rose-500/15 text-rose-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    {p.count}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {expandedPattern && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-xl border border-amber-500/10 bg-black/30 backdrop-blur-md space-y-3">
              <div className="flex items-center gap-2">
                {expandedPattern.type === "success" ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span className="text-sm font-semibold text-zinc-300">
                  &ldquo;{expandedPattern.pattern}&rdquo;
                </span>
              </div>
              {patternLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 rounded-lg bg-linear-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-shimmer"
                    />
                  ))}
                </div>
              ) : patternObjs.length === 0 ? (
                <p className="text-sm text-zinc-700 italic">
                  No matching objectives found.
                </p>
              ) : (
                <div className="space-y-1">
                  {patternObjs.map((o) => (
                    <motion.button
                      key={o.id}
                      whileHover={{ x: 2 }}
                      onClick={() => onSelectObjective?.(o.id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/3 transition-all duration-200 flex items-center gap-2"
                    >
                      <span className="text-sm text-zinc-400 flex-1 truncate">
                        {o.what}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          o.outcome === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : o.outcome === "FAILURE"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {o.outcome}
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-amber-500/50" />
          <span className="text-sm font-semibold text-amber-100/70">
            Recent Completed
          </span>
        </div>
        {data.recent_completed.length === 0 ? (
          <p className="text-sm text-zinc-700 italic">
            No completed objectives yet
          </p>
        ) : (
          <div className="space-y-1">
            {data.recent_completed.map((obj, i) => (
              <motion.div
                key={obj.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.04 }}
                onClick={() => onSelectObjective?.(obj.id)}
                className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/3 hover:border-amber-500/10 border border-transparent transition-all duration-300 cursor-pointer"
              >
                <span className="text-sm text-zinc-400 group-hover:text-zinc-200 flex-1 truncate transition-colors">
                  {obj.what}
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    obj.outcome === "SUCCESS"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : obj.outcome === "FAILURE"
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {obj.outcome}
                </span>
                <span className="text-[10px] text-zinc-700 tabular-nums">
                  {obj.completed_at
                    ? new Date(obj.completed_at).toLocaleDateString()
                    : ""}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
