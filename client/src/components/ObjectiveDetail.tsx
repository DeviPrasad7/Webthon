import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Objective, SimilarObjective } from "../types";
import { fetchObjective, subscribeToObjective } from "../api";
import StrategicInsightCard from "./StrategicInsightCard";
import ExecutionLedger from "./ExecutionLedger";
import WebIntelligence from "./WebIntelligence";
import LoadingState from "./LoadingState";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";

interface Props {
  objectiveId: string;
  onBack: () => void;
  onSelectObjective?: (id: string) => void;
}

export default function ObjectiveDetail({
  objectiveId,
  onBack,
}: Props) {
  const [obj, setObj] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSim, setExpandedSim] = useState<Set<string>>(new Set());
  const [ssePhase, setSsePhase] = useState(0);

  const loadObjective = useCallback(async () => {
    try {
      const data = await fetchObjective(objectiveId);
      setObj(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [objectiveId]);

  useEffect(() => {
    loadObjective();
    const unsubscribe = subscribeToObjective(objectiveId, () => {
      loadObjective();
    });
    return unsubscribe;
  }, [objectiveId, loadObjective]);

  useEffect(() => {
    if (!obj || obj.status !== "PLANNING" || obj.plan.length > 0) return;
    const interval = setInterval(() => {
      setSsePhase((p) => (p + 1) % 4);
    }, 1500);
    return () => clearInterval(interval);
  }, [obj]);

  const phases = [
    "Parsing your brain dump...",
    "Searching past decisions...",
    "Generating execution plan...",
    "Preparing insights...",
  ];

  if (loading) return <LoadingState type="detail" />;
  if (error)
    return <p className="text-rose-400/80 text-sm">{error}</p>;
  if (!obj)
    return <p className="text-zinc-600 text-sm italic">Objective not found</p>;

  const isProcessing = obj.status === "PLANNING" && obj.plan.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-zinc-600 hover:text-amber-400 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span
          className={`text-[9px] font-semibold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${
            obj.status === "PLANNING"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/15"
              : obj.status === "ACTIVE"
              ? "bg-blue-500/10 text-blue-400 border border-blue-500/15"
              : obj.status === "COMPLETED"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
              : "bg-zinc-800 text-zinc-500 border border-zinc-700"
          }`}
        >
          {obj.status}
        </span>
      </div>

      <h1 className="font-serif text-xl text-amber-50/90 tracking-tight">
        {obj.what || obj.raw_input}
      </h1>

      {isProcessing && (
        <LoadingState text={phases[ssePhase]} />
      )}

      <AnimatePresence>
        {obj.jarvis_insight && (
          <StrategicInsightCard insight={obj.jarvis_insight} />
        )}
      </AnimatePresence>

      {/* Web Intelligence — Deep Research Panel */}
      {!isProcessing && obj.what && (
        <WebIntelligence
          objectiveId={obj.id}
          objectiveTitle={obj.what || obj.raw_input}
        />
      )}

      {obj.suggested_similarities &&
        obj.suggested_similarities.length > 0 && (
          <div className="space-y-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-500/40 block">
              Similar Past Decisions ({obj.suggested_similarities.length})
            </span>
            <div className="space-y-1">
              {obj.suggested_similarities.map(
                (sim: SimilarObjective, i: number) => {
                  const isExpanded = expandedSim.has(sim.objective_id);
                  const toggleExpand = () => {
                    setExpandedSim((prev) => {
                      const next = new Set(prev);
                      if (next.has(sim.objective_id))
                        next.delete(sim.objective_id);
                      else next.add(sim.objective_id);
                      return next;
                    });
                  };
                  return (
                    <motion.div
                      key={sim.objective_id || i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-amber-500/8 bg-black/30 backdrop-blur-md overflow-hidden hover:border-amber-500/15 transition-colors duration-300"
                    >
                      <button
                        onClick={toggleExpand}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/3 transition-all duration-200"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-amber-500/40 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-amber-500/40 shrink-0" />
                        )}
                        <span className="text-sm text-zinc-400 truncate flex-1">
                          {sim.what ||
                            sim.raw_input?.slice(0, 80) ||
                            "Past Decision"}
                        </span>
                        {sim.similarity_score != null && (
                          <span className="text-[10px] text-amber-500/40 font-mono shrink-0 tabular-nums">
                            {(sim.similarity_score * 100).toFixed(0)}%
                          </span>
                        )}
                        {sim.outcome && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              sim.outcome === "SUCCESS"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : sim.outcome === "FAILURE"
                                ? "bg-rose-500/10 text-rose-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {sim.outcome}
                          </span>
                        )}
                      </button>
                      <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-3 pb-3 pt-1 space-y-2 border-t border-amber-500/5 overflow-hidden">
                          {sim.success_driver &&
                            sim.success_driver !== "No clear pattern" && (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-500/8 text-emerald-400 border border-emerald-500/15 mr-1">
                                {sim.success_driver}
                              </span>
                            )}
                          {sim.failure_reason &&
                            sim.failure_reason !== "No clear pattern" && (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-rose-500/8 text-rose-400 border border-rose-500/15">
                                {sim.failure_reason}
                              </span>
                            )}
                          {sim.context && (
                            <div>
                              <span className="text-[9px] uppercase tracking-[0.2em] text-amber-500/30">
                                Context
                              </span>
                              <p className="text-xs text-zinc-500">
                                {sim.context}
                              </p>
                            </div>
                          )}
                          {sim.decision_rationale && (
                            <div>
                              <span className="text-[9px] uppercase tracking-[0.2em] text-amber-500/30">
                                Rationale
                              </span>
                              <p className="text-xs text-zinc-500">
                                {sim.decision_rationale}
                              </p>
                            </div>
                          )}
                          {sim.raw_reflection && (
                            <div>
                              <span className="text-[9px] uppercase tracking-[0.2em] text-amber-500/30">
                                Reflection
                              </span>
                              <p className="text-xs text-zinc-500 italic">
                                &ldquo;{sim.raw_reflection}&rdquo;
                              </p>
                            </div>
                          )}
                          {sim.plan_summary && (
                            <div>
                              <span className="text-[9px] uppercase tracking-[0.2em] text-amber-500/30">
                                Steps
                              </span>
                              <p className="text-xs text-zinc-500">
                                {sim.plan_summary}
                              </p>
                            </div>
                          )}
                          {sim.completed_at && (
                            <div>
                              <span className="text-[9px] uppercase tracking-[0.2em] text-amber-500/30">
                                Completed
                              </span>
                              <p className="text-xs text-zinc-500">
                                {new Date(
                                  sim.completed_at
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </motion.div>
                  );
                }
              )}
            </div>
          </div>
        )}

      {!isProcessing && (
        <ExecutionLedger objective={obj} onRefresh={loadObjective} />
      )}
    </motion.div>
  );
}
