import { useEffect, useState, useCallback } from "react";
import type { Objective, PlanStep } from "../types";
import {
  fetchObjective,
  confirmPlan,
  updatePlan,
  completeObjective,
  subscribeToObjective,
} from "../api";

interface Props {
  objectiveId: string;
  onBack: () => void;
}

export default function ObjectiveDetail({ objectiveId, onBack }: Props) {
  const [obj, setObj] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Completion form
  const [showComplete, setShowComplete] = useState(false);
  const [outcome, setOutcome] = useState<string>("SUCCESS");
  const [reflection, setReflection] = useState("");
  const [completing, setCompleting] = useState(false);

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
          <h2>{obj.what}</h2>
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

        <div className="detail-fields">
          <div>
            <strong>Context:</strong>
            <p>{obj.context}</p>
          </div>
          <div>
            <strong>Expected Output:</strong>
            <p>{obj.expected_output}</p>
          </div>
          <div>
            <strong>Rationale:</strong>
            <p>{obj.decision_rationale}</p>
          </div>
        </div>
      </div>

      {/* Similar Past Objectives */}
      {obj.suggested_similarities && obj.suggested_similarities.length > 0 && (
        <div className="card">
          <h3>📌 Similar Past Decisions</h3>
          <div className="similarities">
            {obj.suggested_similarities.map((sim, i) => (
              <div key={i} className="similarity-item">
                <strong>{sim.what || sim.objective_id}</strong>
                {sim.outcome && (
                  <span
                    className="badge"
                    style={{
                      backgroundColor:
                        sim.outcome === "SUCCESS" ? "#10b981" : "#ef4444",
                      marginLeft: 8,
                    }}
                  >
                    {sim.outcome}
                  </span>
                )}
                {sim.success_driver && (
                  <p className="insight">✅ {sim.success_driver}</p>
                )}
                {sim.failure_reason && (
                  <p className="insight">⚠️ {sim.failure_reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan */}
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
                <li
                  key={step.step_id}
                  className={`plan-step ${step.status}`}
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
                </li>
              ))}
            </ul>

            {obj.status === "PLANNING" && obj.plan.length > 0 && (
              <button className="btn-primary" onClick={handleConfirmPlan}>
                ✅ Confirm Plan & Start
              </button>
            )}
          </>
        )}
      </div>

      {/* Complete Section */}
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

      {/* Completed Info */}
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
