import { useEffect, useState, useCallback } from "react";
import type { Objective, PlanStep, ChatMessage, SimilarObjective } from "../types";
import {
  fetchObjective,
  confirmPlan,
  updatePlan,
  completeObjective,
  fastTrackObjective,
  subscribeToObjective,
  chatWithPlan,
} from "../api";

interface Props {
  objectiveId: string;
  onBack: () => void;
}

export default function ObjectiveDetail({ objectiveId, onBack }: Props) {
  const [obj, setObj] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showComplete, setShowComplete] = useState(false);
  const [outcome, setOutcome] = useState<string>("SUCCESS");
  const [reflection, setReflection] = useState("");
  const [completing, setCompleting] = useState(false);

  const [showFastTrack, setShowFastTrack] = useState(false);
  const [ftOutcome, setFtOutcome] = useState<string>("SUCCESS");
  const [ftReflection, setFtReflection] = useState("");
  const [ftSubmitting, setFtSubmitting] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [expandedSim, setExpandedSim] = useState<Set<string>>(new Set());

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

  async function handleConfirmPlan() {
    if (!obj) return;
    try {
      await confirmPlan(obj.id, obj.plan);
      await loadObjective();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleStepStatus(index: number) {
    if (!obj) return;
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
      await loadObjective();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleComplete() {
    if (!obj) return;
    setCompleting(true);
    setError("");
    try {
      await completeObjective(obj.id, outcome, reflection);
      setShowComplete(false);
      await loadObjective();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCompleting(false);
    }
  }

  async function handleFastTrack() {
    if (!obj) return;
    setFtSubmitting(true);
    setError("");
    try {
      await fastTrackObjective(obj.id, ftOutcome, ftReflection);
      setShowFastTrack(false);
      await loadObjective();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFtSubmitting(false);
    }
  }

  async function handleChat() {
    if (!obj || !chatInput.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const result = await chatWithPlan(obj.id, newMessages);
      setChatMessages([...newMessages, { role: "assistant", content: result.reply }]);
      if (result.revised_plan) {
        await updatePlan(obj.id, result.revised_plan);
        await loadObjective();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleStepNoteChange(index: number, notes: string) {
    if (!obj) return;
    const newPlan: PlanStep[] = obj.plan.map((step, i) =>
      i === index ? { ...step, notes } : step
    );
    try {
      await updatePlan(obj.id, newPlan);
      setObj({ ...obj, plan: newPlan });
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div className="card">Loading...</div>;
  if (!obj) return <div className="card">Objective not found</div>;

  const hasPendingSteps = obj.plan.some((s) => s.status === "pending");

  return (
    <div className="objective-detail">
      <button className="btn-back" onClick={onBack}>
        ← Back
      </button>

      <div className="card">
        <div className="detail-header">
          <h2>{obj.what || obj.raw_input}</h2>
          <span
            className="badge"
            style={{
              backgroundColor:
                obj.status === "PLANNING"
                  ? "#f59e0b"
                  : obj.status === "ACTIVE"
                  ? "#3b82f6"
                  : obj.status === "COMPLETED"
                  ? "#10b981"
                  : "#6b7280",
            }}
          >
            {obj.status}
          </span>
        </div>

        {obj.jarvis_insight && (
          <div className="jarvis-banner">
            <strong>🤖 JARVIS says:</strong> {obj.jarvis_insight}
          </div>
        )}

        {obj.raw_input && obj.what && (
          <div className="detail-raw-input">
            <strong>Your brain-dump:</strong>
            <p className="muted">{obj.raw_input}</p>
          </div>
        )}

        <div className="detail-fields">
          {obj.context && (
            <div>
              <strong>Context:</strong>
              <p>{obj.context}</p>
            </div>
          )}
          {obj.expected_output && (
            <div>
              <strong>Expected Output:</strong>
              <p>{obj.expected_output}</p>
            </div>
          )}
          {obj.decision_rationale && (
            <div>
              <strong>Rationale:</strong>
              <p>{obj.decision_rationale}</p>
            </div>
          )}
        </div>
      </div>

      {obj.suggested_similarities && obj.suggested_similarities.length > 0 && (
        <div className="card">
          <h3>📌 Similar Past Decisions ({obj.suggested_similarities.length} found)</h3>
          <p className="muted" style={{ marginBottom: "0.75rem", fontSize: "0.8rem" }}>
            These are past decisions JARVIS used to ground its advice. Click to expand details.
          </p>
          <div className="sim-list">
            {obj.suggested_similarities.map((sim: SimilarObjective, i: number) => {
              const isExpanded = expandedSim.has(sim.objective_id);
              const toggleExpand = () => {
                setExpandedSim((prev) => {
                  const next = new Set(prev);
                  if (next.has(sim.objective_id)) next.delete(sim.objective_id);
                  else next.add(sim.objective_id);
                  return next;
                });
              };
              return (
                <div key={sim.objective_id || i} className={`sim-card ${isExpanded ? "expanded" : ""}`}>
                  <div className="sim-header" onClick={toggleExpand}>
                    <div className="sim-title-row">
                      <span className="sim-expand-icon">{isExpanded ? "▼" : "▶"}</span>
                      <strong className="sim-title">{sim.what || sim.raw_input?.slice(0, 80) || "Past Decision"}</strong>
                      {sim.outcome && (
                        <span
                          className="badge"
                          style={{
                            backgroundColor:
                              sim.outcome === "SUCCESS" ? "#10b981"
                              : sim.outcome === "FAILURE" ? "#ef4444"
                              : "#f59e0b",
                            marginLeft: 8,
                            fontSize: "0.7rem",
                          }}
                        >
                          {sim.outcome}
                        </span>
                      )}
                      {sim.similarity_score != null && (
                        <span className="sim-score">
                          {(sim.similarity_score * 100).toFixed(0)}% match
                        </span>
                      )}
                    </div>
                    <div className="sim-quick-summary">
                      {sim.success_driver && sim.success_driver !== "No clear pattern" && (
                        <span className="sim-tag success">✅ {sim.success_driver}</span>
                      )}
                      {sim.failure_reason && sim.failure_reason !== "No clear pattern" && (
                        <span className="sim-tag failure">⚠️ {sim.failure_reason}</span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="sim-details">
                      {sim.context && (
                        <div className="sim-field">
                          <span className="sim-label">Context:</span>
                          <span>{sim.context}</span>
                        </div>
                      )}
                      {sim.decision_rationale && (
                        <div className="sim-field">
                          <span className="sim-label">Rationale:</span>
                          <span>{sim.decision_rationale}</span>
                        </div>
                      )}
                      {sim.expected_output && (
                        <div className="sim-field">
                          <span className="sim-label">Expected:</span>
                          <span>{sim.expected_output}</span>
                        </div>
                      )}
                      {sim.raw_reflection && (
                        <div className="sim-field">
                          <span className="sim-label">Reflection:</span>
                          <span className="sim-reflection">"{sim.raw_reflection}"</span>
                        </div>
                      )}
                      {sim.plan_summary && (
                        <div className="sim-field">
                          <span className="sim-label">Steps taken:</span>
                          <span className="sim-plan-summary">{sim.plan_summary}</span>
                        </div>
                      )}
                      {sim.completed_at && (
                        <div className="sim-field">
                          <span className="sim-label">Completed:</span>
                          <span>{new Date(sim.completed_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h3>
          📋 Plan{" "}
          {obj.status === "ACTIVE" && (
            <span className="progress-inline">
              {obj.progress_percentage}% done
            </span>
          )}
        </h3>

        {obj.plan.length === 0 ? (
          <p className="muted">
            {obj.status === "PLANNING"
              ? "AI is drafting your plan..."
              : "No plan available"}
          </p>
        ) : (
          <>
            {obj.status === "ACTIVE" && (
              <div className="progress-bar-container large">
                <div
                  className="progress-bar"
                  style={{ width: `${obj.progress_percentage}%` }}
                />
              </div>
            )}

            <ul className="plan-list">
              {obj.plan.map((step, i) => (
                <li key={step.step_id} className={`plan-step ${step.status}`}>
                  <div
                    className="step-main"
                    onClick={
                      obj.status === "ACTIVE"
                        ? () => toggleStepStatus(i)
                        : undefined
                    }
                    style={{
                      cursor: obj.status === "ACTIVE" ? "pointer" : "default",
                    }}
                  >
                    <span className="step-icon">
                      {step.status === "done"
                        ? "✅"
                        : step.status === "skipped"
                        ? "⏭️"
                        : "⬜"}
                    </span>
                    <span className="step-desc">{step.desc}</span>
                    <span className="step-status">{step.status}</span>
                  </div>
                  {obj.status === "ACTIVE" && (
                    <input
                      className="step-notes-input"
                      type="text"
                      placeholder="Add a note..."
                      value={step.notes || ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleStepNoteChange(i, e.target.value)}
                    />
                  )}
                  {obj.status !== "ACTIVE" && step.notes && (
                    <div className="step-notes-display">📝 {step.notes}</div>
                  )}
                </li>
              ))}
            </ul>

            {obj.status === "PLANNING" && obj.plan.length > 0 && (
              <div className="plan-actions">
                <button className="btn-primary" onClick={handleConfirmPlan}>
                  ✅ Confirm Plan & Start
                </button>
                <button
                  className="btn-fast-track"
                  onClick={() => setShowFastTrack((v) => !v)}
                >
                  ⚡ {showFastTrack ? "Hide" : "Skip Checklist"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowChat((v) => !v)}
                >
                  💬 {showChat ? "Hide Chat" : "Discuss Plan"}
                </button>
              </div>
            )}

            {showFastTrack && obj.status === "PLANNING" && (
              <div className="fast-track-panel">
                <h4>⚡ Fast-Track — Log Outcome Directly</h4>
                <p className="muted">Skip the execution checklist and record the result now.</p>
                <label>
                  Outcome:
                  <select value={ftOutcome} onChange={(e) => setFtOutcome(e.target.value)}>
                    <option value="SUCCESS">Success</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="FAILURE">Failure</option>
                  </select>
                </label>
                <label>
                  Reflection:
                  <textarea
                    value={ftReflection}
                    onChange={(e) => setFtReflection(e.target.value)}
                    placeholder="Quick reflection — what happened?"
                    rows={3}
                  />
                </label>
                <div className="btn-group">
                  <button className="btn-fast-track" onClick={handleFastTrack} disabled={ftSubmitting}>
                    {ftSubmitting ? "Submitting..." : "⚡ Complete Now"}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowFastTrack(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showChat && obj.plan.length > 0 && (
              <div className="chat-panel">
                <h4>💬 Discuss Plan with AI</h4>
                <div className="chat-messages">
                  {chatMessages.length === 0 && (
                    <p className="muted">Ask the AI to modify, explain, or improve the plan.</p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`chat-msg chat-${msg.role}`}>
                      <strong>{msg.role === "user" ? "You" : "AI"}:</strong>
                      <span>{msg.content}</span>
                    </div>
                  ))}
                  {chatLoading && <div className="chat-msg chat-assistant"><em>Thinking...</em></div>}
                </div>
                <div className="chat-input-row">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChat()}
                    placeholder="e.g. Add a research step before step 3..."
                    disabled={chatLoading}
                  />
                  <button className="btn-primary" onClick={handleChat} disabled={chatLoading || !chatInput.trim()}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {obj.status === "ACTIVE" && (
        <div className="card">
          {!showComplete ? (
            <button
              className="btn-primary"
              onClick={() => setShowComplete(true)}
              disabled={hasPendingSteps}
              title={
                hasPendingSteps
                  ? "Complete all steps first"
                  : "Mark objective complete"
              }
            >
              🏁 Complete Objective
            </button>
          ) : (
            <div className="complete-form">
              <h3>Complete Objective</h3>
              <label>
                Outcome:
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="SUCCESS">Success</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="FAILURE">Failure</option>
                </select>
              </label>
              <label>
                Reflection:
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="What went well? What could be improved?"
                  rows={4}
                />
              </label>
              <div className="btn-group">
                <button
                  className="btn-primary"
                  onClick={handleComplete}
                  disabled={completing}
                >
                  {completing ? "Completing..." : "Submit"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowComplete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {obj.status === "COMPLETED" && (
        <div className="card completed-info">
          <h3>📊 Outcome</h3>
          <span
            className="badge large"
            style={{
              backgroundColor:
                obj.outcome === "SUCCESS"
                  ? "#10b981"
                  : obj.outcome === "FAILURE"
                  ? "#ef4444"
                  : "#f59e0b",
            }}
          >
            {obj.outcome}
          </span>
          {obj.raw_reflection && (
            <div>
              <strong>Reflection:</strong>
              <p>{obj.raw_reflection}</p>
            </div>
          )}
          {obj.success_driver && (
            <p className="insight">✅ Success driver: {obj.success_driver}</p>
          )}
          {obj.failure_reason && (
            <p className="insight">
              ⚠️ Failure reason: {obj.failure_reason}
            </p>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
