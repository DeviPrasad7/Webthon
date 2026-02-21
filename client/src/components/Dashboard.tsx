import { useEffect, useState } from "react";
import type { DashboardData, PatternObjective } from "../types";
import { fetchDashboard, fetchPatternObjectives } from "../api";
import SkeletonLoader from "./SkeletonLoader";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface Props {
  onSelectObjective?: (id: string) => void;
}

export default function Dashboard({ onSelectObjective }: Props) {
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

  if (loading) return <SkeletonLoader type="dashboard" />;
  if (!data)
    return (
      <p className="text-zinc-500 text-sm">Failed to load dashboard.</p>
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100 tracking-tight mb-1">
          Cognitive Dashboard
        </h1>
        <p className="text-sm text-zinc-500">
          Your decision intelligence at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-white/10 bg-black/30 backdrop-blur-md">
          <div className="text-2xl font-semibold text-zinc-100">
            {totalDecisions}
          </div>
          <div className="text-[10px] tracking-widest text-zinc-400 mt-1">
            Total Decisions
          </div>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-black/30 backdrop-blur-md">
          <div className="text-2xl font-semibold text-zinc-100">
            {completionRate}%
          </div>
          <div className="text-[10px] tracking-widest text-zinc-400 mt-1">
            Completion Rate
          </div>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 backdrop-blur-md">
          <div className="text-2xl font-semibold text-emerald-400">
            {stats.successes}
          </div>
          <div className="text-[10px] tracking-widest text-emerald-400/60 mt-1">
            Successes
          </div>
        </div>
        <div className="p-4 rounded-xl border border-rose-500/10 bg-rose-500/5 backdrop-blur-md">
          <div className="text-2xl font-semibold text-rose-400">
            {stats.failures}
          </div>
          <div className="text-[10px] tracking-widest text-rose-400/60 mt-1">
            Failures
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-300">
              Success Drivers
            </span>
          </div>
          {data.success_patterns.length === 0 ? (
            <p className="text-sm text-zinc-500">No patterns yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.success_patterns.map((p, i) => (
                <button
                  key={i}
                  onClick={() =>
                    handlePatternClick("success", p.success_driver)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-all duration-200 ease-in-out"
                >
                  {p.success_driver}
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    {p.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-semibold text-zinc-300">
              Failure Traps
            </span>
          </div>
          {data.failure_patterns.length === 0 ? (
            <p className="text-sm text-zinc-600">No patterns yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.failure_patterns.map((p, i) => (
                <button
                  key={i}
                  onClick={() =>
                    handlePatternClick("failure", p.failure_reason)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium hover:bg-rose-500/20 transition-all duration-200 ease-in-out"
                >
                  {p.failure_reason}
                  <span className="bg-rose-500/20 text-rose-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    {p.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {expandedPattern && (
        <div className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-3">
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
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse bg-zinc-800 rounded-lg"
                />
              ))}
            </div>
          ) : patternObjs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No matching objectives found.
            </p>
          ) : (
            <div className="space-y-1">
              {patternObjs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onSelectObjective?.(o.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-all duration-200 ease-in-out flex items-center gap-2"
                >
                  <span className="text-sm text-zinc-300 flex-1 truncate">
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
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-300">
            Recent Completed
          </span>
        </div>
        {data.recent_completed.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No completed objectives yet
          </p>
        ) : (
          <div className="space-y-1">
            {data.recent_completed.map((obj) => (
              <div
                key={obj.id}
                onClick={() => onSelectObjective?.(obj.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all duration-200 ease-in-out cursor-pointer"
              >
                <span className="text-sm text-zinc-300 flex-1 truncate">
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
                <span className="text-[10px] text-zinc-500">
                  {obj.completed_at
                    ? new Date(obj.completed_at).toLocaleDateString()
                    : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
