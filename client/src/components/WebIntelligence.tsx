import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Zap, AlertTriangle, TrendingUp, ExternalLink, ChevronDown, ChevronRight, Search, Loader2 } from "lucide-react";
import type { ObjectiveResearch, WebSource } from "../types";
import { researchObjective } from "../api";

interface Props {
  objectiveId: string;
  objectiveTitle: string;
}

export default function WebIntelligence({ objectiveId }: Props) {
  const [research, setResearch] = useState<ObjectiveResearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  async function handleResearch() {
    setLoading(true);
    setError("");
    try {
      const result = await researchObjective(objectiveId);
      setResearch(result);
    } catch (err: any) {
      setError(err.message || "Research failed");
    } finally {
      setLoading(false);
    }
  }

  // Not yet researched — show the trigger button
  if (!research && !loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={handleResearch}
          className="w-full group relative rounded-2xl border border-dashed border-cyan-500/20 bg-cyan-500/3 backdrop-blur-md p-5 hover:border-cyan-500/30 hover:bg-cyan-500/6 transition-all duration-300"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/15 transition-colors">
              <Globe className="w-4.5 h-4.5 text-cyan-400" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-cyan-300/90 block">
                Deep Research
              </span>
              <span className="text-[11px] text-zinc-600">
                Search the web for real-time intelligence on this decision
              </span>
            </div>
            <Search className="w-4 h-4 text-cyan-500/40 ml-auto group-hover:text-cyan-400 transition-colors" />
          </div>
          {error && (
            <p className="text-rose-400/80 text-xs mt-2">{error}</p>
          )}
        </button>
      </motion.div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-cyan-500/15 bg-black/40 backdrop-blur-xl p-6"
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-5 h-5 text-cyan-400" />
          </motion.div>
          <div>
            <span className="text-sm text-cyan-300/90 font-medium block">Researching the web...</span>
            <span className="text-[11px] text-zinc-600">Searching multiple angles, synthesizing intelligence</span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {["Searching best practices...", "Analyzing risks & pitfalls...", "Synthesizing findings..."].map((phase, i) => (
            <motion.div
              key={phase}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 1.2 }}
              className="flex items-center gap-2 text-xs text-zinc-600"
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-cyan-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
              />
              {phase}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (!research) return null;

  const { synthesis, sources } = research;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-cyan-500/15 bg-black/40 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/2 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
          <Globe className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-left flex-1">
          <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-cyan-500/60 block">
            Web Intelligence
          </span>
          <span className="text-[11px] text-zinc-600">
            {sources.length} sources • {research.queries.length} searches • {new Date(research.searched_at).toLocaleTimeString()}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-cyan-500/40" />
        ) : (
          <ChevronRight className="w-4 h-4 text-cyan-500/40" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Strategic Brief */}
              <div className="relative bg-linear-to-br from-cyan-950/30 to-black border-l-4 border-cyan-500 rounded-r-xl p-4">
                <p className="text-cyan-300/90 font-serif text-sm italic leading-relaxed">
                  &ldquo;{synthesis.brief}&rdquo;
                </p>
              </div>

              {/* Key Insights */}
              {synthesis.key_insights && synthesis.key_insights.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-500/50">
                      Key Insights
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {synthesis.key_insights.map((insight, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2 text-xs text-zinc-400"
                      >
                        <span className="w-1 h-1 rounded-full bg-amber-500/50 mt-1.5 shrink-0" />
                        {insight}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks & Opportunities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {synthesis.risks_identified && synthesis.risks_identified.length > 0 && (
                  <div className="rounded-xl border border-rose-500/10 bg-rose-500/3 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-500/60">
                        Risks
                      </span>
                    </div>
                    <div className="space-y-1">
                      {synthesis.risks_identified.map((risk, i) => (
                        <p key={i} className="text-[11px] text-rose-300/70 leading-relaxed">
                          • {risk}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {synthesis.opportunities && synthesis.opportunities.length > 0 && (
                  <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/3 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-500/60">
                        Opportunities
                      </span>
                    </div>
                    <div className="space-y-1">
                      {synthesis.opportunities.map((opp, i) => (
                        <p key={i} className="text-[11px] text-emerald-300/70 leading-relaxed">
                          • {opp}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sources */}
              {sources.length > 0 && (
                <div>
                  <button
                    onClick={() => setSourcesExpanded(!sourcesExpanded)}
                    className="flex items-center gap-2 mb-2 hover:text-zinc-300 transition-colors"
                  >
                    {sourcesExpanded ? (
                      <ChevronDown className="w-3 h-3 text-zinc-600" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-zinc-600" />
                    )}
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                      Sources ({sources.length})
                    </span>
                  </button>
                  <AnimatePresence>
                    {sourcesExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2 overflow-hidden"
                      >
                        {sources.map((source: WebSource, i: number) => (
                          <motion.a
                            key={i}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="block rounded-lg border border-zinc-800/50 bg-white/2 p-3 hover:border-cyan-500/20 hover:bg-cyan-500/3 transition-all duration-200 group"
                          >
                            <div className="flex items-start gap-2">
                              <ExternalLink className="w-3 h-3 text-cyan-500/40 mt-0.5 shrink-0 group-hover:text-cyan-400 transition-colors" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-cyan-300/80 font-medium truncate group-hover:text-cyan-200 transition-colors">
                                  {source.title}
                                </p>
                                <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-2 leading-relaxed">
                                  {source.snippet}
                                </p>
                                <p className="text-[10px] text-zinc-700 mt-1 truncate">
                                  {source.url}
                                </p>
                              </div>
                            </div>
                          </motion.a>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Re-research button */}
              <button
                onClick={handleResearch}
                disabled={loading}
                className="flex items-center gap-2 text-[11px] text-cyan-500/50 hover:text-cyan-400 transition-colors mt-2"
              >
                <Search className="w-3 h-3" />
                Research again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
