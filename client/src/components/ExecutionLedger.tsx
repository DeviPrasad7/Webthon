import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Objective, PlanStep, ChatMessage } from "../types";
import {
  confirmPlan,
  updatePlan,
  completeObjective,
  fastTrackObjective,
  chatWithPlan,
} from "../api";
import {
  Check,
  SkipForward,
  Zap,
  MessageSquare,
  Flag,
  ArrowRight,
} from "lucide-react";

interface Props {
  objective: Objective;
  onRefresh: () => void;
}

export default function ExecutionLedger({ objective: obj, onRefresh }: Props) {
  const [showComplete, setShowComplete] = useState(false);
  const [outcome, setOutcome] = useState("SUCCESS");
  const [reflection, setReflection] = useState("");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  const [showFastTrack, setShowFastTrack] = useState(false);
  const [ftOutcome, setFtOutcome] = useState("SUCCESS");
  const [ftReflection, setFtReflection] = useState("");
  const [ftSubmitting, setFtSubmitting] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  async function handleConfirmPlan() {
    try {
      await confirmPlan(obj.id, obj.plan);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function toggleStepStatus(index: number) {
    const newPlan: PlanStep[] = obj.plan.map((step, i) => {
      if (i !== index) return step;
      const nextStatus =
        step.status === "pending"
          ? "done"
          : step.status === "done"
          ? "skipped"
          : "pending";
      return { ...step, status: nextStatus };
    });
    try {
      await updatePlan(obj.id, newPlan);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleStepNoteChange(index: number, notes: string) {
    const newPlan: PlanStep[] = obj.plan.map((step, i) =>
      i === index ? { ...step, notes } : step
    );
    try {
      await updatePlan(obj.id, newPlan);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleComplete() {
    setCompleting(true);
    setError("");
    try {
      await completeObjective(obj.id, outcome, reflection);
      setShowComplete(false);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompleting(false);
    }
  }

  async function handleFastTrack() {
    setFtSubmitting(true);
    setError("");
    try {
      await fastTrackObjective(obj.id, ftOutcome, ftReflection);
      setShowFastTrack(false);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setFtSubmitting(false);
    }
  }

  async function handleChat() {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const result = await chatWithPlan(obj.id, newMessages);
      setChatMessages([
        ...newMessages,
        { role: "assistant", content: result.reply },
      ]);
      if (result.revised_plan) {
        await updatePlan(obj.id, result.revised_plan);
        onRefresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setChatLoading(false);
    }
  }

  const hasPendingSteps = obj.plan.some((s) => s.status === "pending");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {obj.what && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-xl bg-black/40 border border-amber-500/8 backdrop-blur-md"
          >
            <span className="text-[10px] font-semibold tracking-[0.05em] text-amber-500/40 block mb-1.5">
              What
            </span>
            <p className="text-sm text-zinc-400">{obj.what}</p>
          </motion.div>
        )}
        {obj.decision_rationale && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl bg-black/40 border border-amber-500/8 backdrop-blur-md"
          >
            <span className="text-[10px] font-semibold tracking-[0.05em] text-amber-500/40 block mb-1.5">
              Why
            </span>
            <p className="text-sm text-zinc-400">{obj.decision_rationale}</p>
          </motion.div>
        )}
      </div>

      {obj.context && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-black/40 border border-amber-500/8 backdrop-blur-md"
        >
          <span className="text-[10px] font-semibold tracking-[0.05em] text-amber-500/40 block mb-1.5">
            Context
          </span>
          <p className="text-sm text-zinc-400">{obj.context}</p>
        </motion.div>
      )}

      {obj.expected_output && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl bg-black/40 border border-amber-500/8 backdrop-blur-md"
        >
          <span className="text-[10px] font-semibold tracking-[0.05em] text-amber-500/40 block mb-1.5">
            Expected Output
          </span>
          <p className="text-sm text-zinc-400">{obj.expected_output}</p>
        </motion.div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-amber-100/80 tracking-wide">
            Execution Ledger
          </h3>
          {obj.status === "ACTIVE" && (
            <span className="text-[10px] text-amber-500/50 tabular-nums">
              {obj.progress_percentage}%
            </span>
          )}
        </div>

        {obj.status === "ACTIVE" && (
          <div className="h-0.5 bg-zinc-900 rounded-full mb-5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${obj.progress_percentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-linear-to-r from-amber-500/50 to-amber-400/70 rounded-full"
            />
          </div>
        )}

        {obj.plan.length === 0 ? (
          <p className="text-sm text-zinc-700 italic">
            {obj.status === "PLANNING"
              ? "Generating plan..."
              : "No plan available"}
          </p>
        ) : (
          <ul className="space-y-0.5">
            <AnimatePresence>
              {obj.plan.map((step, i) => (
                <motion.li
                  key={step.step_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group rounded-lg transition-all duration-200 hover:bg-white/3"
                >
                  <div
                    className={`flex items-start gap-3 px-3 py-2.5 ${
                      obj.status === "ACTIVE" ? "cursor-pointer" : ""
                    }`}
                    onClick={
                      obj.status === "ACTIVE"
                        ? () => toggleStepStatus(i)
                        : undefined
                    }
                  >
                    <div className="mt-0.5">
                      {step.status === "done" ? (
                        <motion.div
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded border border-amber-500/40 bg-amber-500/10 flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-amber-400" />
                        </motion.div>
                      ) : step.status === "skipped" ? (
                        <div className="w-5 h-5 rounded border border-zinc-700 bg-zinc-800/50 flex items-center justify-center">
                          <SkipForward className="w-3 h-3 text-zinc-600" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded border border-amber-600/30 bg-transparent" />
                      )}
                    </div>
                    <motion.span
                      animate={{
                        opacity: step.status !== "pending" ? 0.4 : 1,
                      }}
                      className={`text-sm transition-all duration-300 ${
                        step.status === "done" || step.status === "skipped"
                          ? "line-through text-zinc-600"
                          : "text-zinc-300"
                      }`}
                    >
                      {step.desc}
                    </motion.span>
                  </div>
                  {obj.status === "ACTIVE" && (
                    <input
                      type="text"
                      placeholder="Add a note..."
                      value={step.notes || ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleStepNoteChange(i, e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-xs text-zinc-600 placeholder:text-zinc-800 px-11 pb-2"
                    />
                  )}
                  {obj.status !== "ACTIVE" && step.notes && (
                    <p className="text-xs text-zinc-600 px-11 pb-2 italic">
                      {step.notes}
                    </p>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {obj.status === "PLANNING" && obj.plan.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 pt-2"
        >
          <div className="flex gap-2">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirmPlan}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-linear-to-r from-amber-500/90 to-yellow-500/90 text-black text-sm font-medium rounded-xl shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-shadow duration-300"
            >
              <Check className="w-4 h-4" />
              Confirm Plan
            </motion.button>
            <button
              onClick={() => setShowChat((v) => !v)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-white/5 text-zinc-500 hover:text-amber-300 text-sm rounded-xl transition-all duration-300 border border-amber-500/10"
            >
              <MessageSquare className="w-4 h-4" />
              Discuss
            </button>
          </div>

          <button
            onClick={() => setShowFastTrack((v) => !v)}
            className="w-full text-center py-3 text-amber-500/70 hover:text-amber-300 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors duration-300"
          >
            Bypass Execution & Log Outcome <ArrowRight className="w-3 h-3 inline ml-1" />
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showFastTrack && obj.status === "PLANNING" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-xl border border-amber-500/15 bg-amber-500/5 backdrop-blur-md space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">
                  Fast Track
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                Skip execution and record the outcome directly.
              </p>
              <div className="space-y-2">
                <select
                  value={ftOutcome}
                  onChange={(e) => setFtOutcome(e.target.value)}
                  className="w-full bg-black/60 border border-amber-500/15 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none backdrop-blur-md"
                >
                  <option value="SUCCESS">Success</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="FAILURE">Failure</option>
                </select>
                <textarea
                  value={ftReflection}
                  onChange={(e) => setFtReflection(e.target.value)}
                  placeholder="Quick reflection..."
                  rows={2}
                  className="w-full bg-black/60 border border-amber-500/15 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none resize-none backdrop-blur-md"
                />
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleFastTrack}
                  disabled={ftSubmitting}
                  className="flex-1 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50"
                >
                  {ftSubmitting ? "Submitting..." : "Complete Now"}
                </motion.button>
                <button
                  onClick={() => setShowFastTrack(false)}
                  className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && obj.plan.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-xl border border-amber-500/10 bg-black/40 backdrop-blur-xl space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500/60" />
                <span className="text-sm font-semibold text-amber-100/80">
                  Discuss Plan
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-zinc-700 italic">
                    Ask the AI to modify, explain, or improve the plan.
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm px-3 py-2 rounded-lg ${
                      msg.role === "user"
                        ? "bg-amber-500/8 text-zinc-300 ml-8 border border-amber-500/10"
                        : "bg-white/3 text-zinc-400 mr-8"
                    }`}
                  >
                    {msg.content}
                  </motion.div>
                ))}
                {chatLoading && (
                  <div className="text-sm text-zinc-600 px-3 py-2">
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Thinking...
                    </motion.span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChat()}
                  placeholder="Suggest changes..."
                  disabled={chatLoading}
                  className="flex-1 bg-black/60 border border-amber-500/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none backdrop-blur-md"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-sm rounded-lg transition-all duration-300 disabled:opacity-40"
                >
                  Send
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {obj.status === "ACTIVE" && (
        <div className="pt-2">
          {!showComplete ? (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowComplete(true)}
              disabled={hasPendingSteps}
              title={hasPendingSteps ? "Complete all steps first" : ""}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-linear-to-r from-amber-500/80 to-yellow-500/80 text-black text-sm font-medium rounded-xl shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-shadow duration-300 disabled:opacity-20 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Flag className="w-4 h-4" />
              Complete Objective
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl border border-amber-500/15 bg-black/40 backdrop-blur-xl space-y-3"
            >
              <h3 className="text-sm font-semibold text-amber-100/80">
                Complete Objective
              </h3>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full bg-black/60 border border-amber-500/15 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none"
              >
                <option value="SUCCESS">Success</option>
                <option value="PARTIAL">Partial</option>
                <option value="FAILURE">Failure</option>
              </select>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What went well? What could be improved?"
                rows={3}
                className="w-full bg-black/60 border border-amber-500/15 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none resize-none"
              />
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50"
                >
                  {completing ? "Completing..." : "Submit"}
                </motion.button>
                <button
                  onClick={() => setShowComplete(false)}
                  className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {obj.status === "COMPLETED" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl border border-amber-500/10 bg-black/30 backdrop-blur-md space-y-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-amber-100/80">
              Outcome
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                obj.outcome === "SUCCESS"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : obj.outcome === "FAILURE"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              {obj.outcome}
            </span>
          </div>
          {obj.raw_reflection && (
            <p className="text-sm text-zinc-500 italic">{obj.raw_reflection}</p>
          )}
          {obj.success_driver &&
            obj.success_driver !== "No clear pattern" &&
            (obj.outcome === "SUCCESS" || obj.outcome === "PARTIAL") && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {obj.success_driver}
            </span>
          )}
          {obj.failure_reason &&
            obj.failure_reason !== "No clear pattern" &&
            (obj.outcome === "FAILURE" || obj.outcome === "PARTIAL") && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {obj.failure_reason}
            </span>
          )}
        </motion.div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-rose-400/80 text-sm"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
