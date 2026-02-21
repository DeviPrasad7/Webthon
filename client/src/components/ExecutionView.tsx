import { useState } from "react";
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
} from "lucide-react";

interface Props {
  objective: Objective;
  onRefresh: () => void;
}

export default function ExecutionView({ objective: obj, onRefresh }: Props) {
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
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleStepNoteChange(index: number, notes: string) {
    const newPlan: PlanStep[] = obj.plan.map((step, i) =>
      i === index ? { ...step, notes } : step
    );
    try {
      await updatePlan(obj.id, newPlan);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    setError("");
    try {
      await completeObjective(obj.id, outcome, reflection);
      setShowComplete(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChatLoading(false);
    }
  }

  const hasPendingSteps = obj.plan.some((s) => s.status === "pending");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {obj.what && (
          <div className="p-3 rounded-lg bg-white/3 border border-white/5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 block mb-1">
              What
            </span>
            <p className="text-sm text-zinc-400">{obj.what}</p>
          </div>
        )}
        {obj.decision_rationale && (
          <div className="p-3 rounded-lg bg-white/3 border border-white/5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 block mb-1">
              Why
            </span>
            <p className="text-sm text-zinc-400">{obj.decision_rationale}</p>
          </div>
        )}
      </div>

      {obj.context && (
        <div className="p-3 rounded-lg bg-white/3 border border-white/5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 block mb-1">
            Context
          </span>
          <p className="text-sm text-zinc-400">{obj.context}</p>
        </div>
      )}

      {obj.expected_output && (
        <div className="p-3 rounded-lg bg-white/3 border border-white/5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 block mb-1">
            Expected Output
          </span>
          <p className="text-sm text-zinc-400">{obj.expected_output}</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-300 tracking-wide">
            Execution Plan
          </h3>
          {obj.status === "ACTIVE" && (
            <span className="text-xs text-zinc-500">
              {obj.progress_percentage}% complete
            </span>
          )}
        </div>

        {obj.status === "ACTIVE" && (
          <div className="h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-emerald-500/50 rounded-full transition-all duration-500 ease-in-out"
              style={{ width: `${obj.progress_percentage}%` }}
            />
          </div>
        )}

        {obj.plan.length === 0 ? (
          <p className="text-sm text-zinc-600">
            {obj.status === "PLANNING"
              ? "Generating plan..."
              : "No plan available"}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {obj.plan.map((step, i) => (
              <li
                key={step.step_id}
                className="group rounded-lg transition-all duration-200 ease-in-out hover:bg-white/5"
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
                      <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                    ) : step.status === "skipped" ? (
                      <div className="w-5 h-5 rounded-md bg-zinc-700/50 border border-zinc-600 flex items-center justify-center">
                        <SkipForward className="w-3 h-3 text-zinc-500" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border border-zinc-700 bg-transparent" />
                    )}
                  </div>
                  <span
                    className={`text-sm transition-all duration-200 ease-in-out ${
                      step.status === "done"
                        ? "line-through text-zinc-600"
                        : step.status === "skipped"
                        ? "line-through text-zinc-600"
                        : "text-zinc-300"
                    }`}
                  >
                    {step.desc}
                  </span>
                </div>
                {obj.status === "ACTIVE" && (
                  <input
                    type="text"
                    placeholder="Add a note..."
                    value={step.notes || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStepNoteChange(i, e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-xs text-zinc-500 placeholder:text-zinc-700 px-11 pb-2"
                  />
                )}
                {obj.status !== "ACTIVE" && step.notes && (
                  <p className="text-xs text-zinc-600 px-11 pb-2">
                    {step.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {obj.status === "PLANNING" && obj.plan.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <button
              onClick={handleConfirmPlan}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out border border-white/5"
            >
              <Check className="w-4 h-4" />
              Confirm Plan
            </button>
            <button
              onClick={() => setShowChat((v) => !v)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-zinc-200 text-sm rounded-lg transition-all duration-200 ease-in-out border border-white/10"
            >
              <MessageSquare className="w-4 h-4" />
              Discuss
            </button>
          </div>

          <button
            onClick={() => setShowFastTrack((v) => !v)}
            className="w-full px-4 py-3 text-sm text-zinc-500 hover:text-zinc-300 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg transition-all duration-200 ease-in-out flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Skip Checklist & Log Outcome
          </button>
        </div>
      )}

      {showFastTrack && obj.status === "PLANNING" && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">
              Fast Track
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Skip execution and record the outcome directly.
          </p>
          <div className="space-y-2">
            <select
              value={ftOutcome}
              onChange={(e) => setFtOutcome(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none"
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
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFastTrack}
              disabled={ftSubmitting}
              className="flex-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out disabled:opacity-50"
            >
              {ftSubmitting ? "Submitting..." : "Complete Now"}
            </button>
            <button
              onClick={() => setShowFastTrack(false)}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-all duration-200 ease-in-out"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showChat && obj.plan.length > 0 && (
        <div className="p-4 rounded-xl border border-white/10 bg-black/30 backdrop-blur-md space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-300">
              Discuss Plan
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {chatMessages.length === 0 && (
              <p className="text-xs text-zinc-600">
                Ask the AI to modify, explain, or improve the plan.
              </p>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-zinc-800 text-zinc-300 ml-8"
                    : "bg-white/5 text-zinc-400 mr-8"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {chatLoading && (
              <div className="text-sm text-zinc-600 animate-pulse px-3 py-2">
                Thinking...
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
              className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
            />
            <button
              onClick={handleChat}
              disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm rounded-lg transition-all duration-200 ease-in-out border border-white/5 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {obj.status === "ACTIVE" && (
        <div className="pt-2">
          {!showComplete ? (
            <button
              onClick={() => setShowComplete(true)}
              disabled={hasPendingSteps}
              title={hasPendingSteps ? "Complete all steps first" : ""}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Flag className="w-4 h-4" />
              Complete Objective
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-white/10 bg-black/30 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">
                Complete Objective
              </h3>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none"
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
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out disabled:opacity-50"
                >
                  {completing ? "Completing..." : "Submit"}
                </button>
                <button
                  onClick={() => setShowComplete(false)}
                  className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-all duration-200 ease-in-out"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {obj.status === "COMPLETED" && (
        <div className="p-4 rounded-xl border border-white/10 bg-black/20 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-zinc-300">Outcome</span>
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
            <p className="text-sm text-zinc-400">{obj.raw_reflection}</p>
          )}
          {obj.success_driver && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {obj.success_driver}
              </span>
            </div>
          )}
          {obj.failure_reason && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {obj.failure_reason}
              </span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-rose-400 text-sm">{error}</p>}
    </div>
  );
}
