import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Target, Plus, X, Check, CheckCircle, Clock, Loader, ChevronDown, ChevronUp, Rocket, Sparkles, MessageSquare } from 'lucide-react';
import { api } from '../api';

export default function ObjectivesView() {
  const { state, dispatch, loadObjectives } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pending objectives (in staging/planning, from cache)
  const [pendingObjectives, setPendingObjectives] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [updatingStep, setUpdatingStep] = useState(null); // "objId-stepNum"

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadObjectives();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadObjectives]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const result = await api.ingestText(text);
      setText('');
      setShowForm(false);
      if (result.objective_id) {
        pollForPlan(result.objective_id);
      }
    } catch (err) {
      alert('Failed to create objective: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const pollForPlan = async (objectiveId) => {
    setPendingLoading(true);
    let attempts = 0;
    const maxAttempts = 15;
    const poll = async () => {
      attempts++;
      try {
        const status = await api.getStatus(objectiveId);
        if (status.plan_draft || status.status === 'planning' || status.status === 'staging') {
          setPendingObjectives((prev) => {
            const exists = prev.find((p) => p.objective_id === objectiveId);
            if (exists) return prev.map((p) => p.objective_id === objectiveId ? status : p);
            return [...prev, status];
          });
          setPendingLoading(false);
          setExpandedPlan(objectiveId);
          return;
        }
        if (status.status === 'approved' || status.status === 'in_progress') {
          setPendingLoading(false);
          loadObjectives();
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setPendingLoading(false);
          loadObjectives();
        }
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setPendingLoading(false);
        }
      }
    };
    poll();
  };

  const handleConfirm = async (objectiveId) => {
    setConfirming(objectiveId);
    try {
      await api.confirmPlan(objectiveId, true);
      setPendingObjectives((prev) => prev.filter((p) => p.objective_id !== objectiveId));
      loadObjectives();
    } catch (err) {
      alert('Failed to confirm plan: ' + err.message);
    } finally {
      setConfirming(null);
    }
  };

  const handleReject = (objectiveId) => {
    setPendingObjectives((prev) => prev.filter((p) => p.objective_id !== objectiveId));
  };

  const handleStepToggle = useCallback(async (objectiveId, stepNumber) => {
    const key = `${objectiveId}-${stepNumber}`;
    if (updatingStep === key) return; // prevent double-click
    setUpdatingStep(key);
    try {
      await api.updateProgress(objectiveId, stepNumber);
      await loadObjectives(); // refresh to get updated workdone %
      // Reverse-sync: update chat messages that have this objective linked
      dispatch({ type: 'MARK_OBJECTIVE_STEP_DONE', payload: { objectiveId, stepNumber } });
    } catch (err) {
      console.error('Failed to update step:', err);
    } finally {
      setUpdatingStep(null);
    }
  }, [updatingStep, loadObjectives, dispatch]);

  // Sort objectives by latest created_at
  const sortedObjectives = useMemo(() =>
    [...state.objectives].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : 0;
      const dateB = b.created_at ? new Date(b.created_at) : 0;
      return dateB - dateA;
    }),
    [state.objectives]
  );

  const goToChat = () => {
    dispatch({ type: 'SET_VIEW', payload: 'chat' });
  };

  const statusConfig = {
    staging: { color: 'badge-staging', label: '📋 Staging' },
    planning: { color: 'badge-planning', label: '🧠 Planning' },
    awaiting_approval: { color: 'badge-awaiting_approval', label: '⏳ Awaiting Approval' },
    approved: { color: 'badge-approved', label: '✅ Approved' },
    in_progress: { color: 'badge-in_progress', label: '🚀 In Progress' },
    completed: { color: 'badge-completed', label: '🎉 Completed' },
    failed: { color: 'badge-failed', label: '❌ Failed' },
  };

  const hasContent = state.objectives.length > 0 || pendingObjectives.length > 0;

  return (
    <div className="page-content">
      <div className="page-grid">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="section-title" style={{ margin: 0 }}>
            <Target size={18} /> Objectives
            {state.objectives.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                ({state.objectives.length})
              </span>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={15} /> New Objective
          </button>
        </div>

        {/* Create Objective Modal */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🎯 Create Objective</h3>
                <button className="modal-close" onClick={() => setShowForm(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Describe your objective</label>
                    <textarea
                      className="form-textarea"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="e.g. I want to hit $5K revenue this month by landing 3 new clients..."
                      rows={5}
                      required
                    />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    JARVIS will analyze this and create a structured plan for you to review.
                  </p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || !text.trim()}>
                    {saving ? '⏳ Creating...' : '🚀 Create Objective'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && !hasContent && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <Loader size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12, color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading objectives...</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Plan creation loading */}
        {pendingLoading && (
          <div className="card" style={{ textAlign: 'center', padding: 28, borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <Loader size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
              JARVIS is analyzing your objective and creating a plan...
            </p>
          </div>
        )}

        {/* Pending objectives (awaiting confirmation) */}
        {pendingObjectives.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 8 }}>
              <Clock size={16} /> Awaiting Your Approval
            </div>
            <div className="card-list">
              {pendingObjectives.map((p) => {
                const obj = p.objective || {};
                const plan = p.plan_draft;
                const isExpanded = expandedPlan === p.objective_id;
                return (
                  <div key={p.objective_id} className="card" style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                    <div className="card-header">
                      <span className="card-title">{obj.what || 'New Objective'}</span>
                      <span className="badge badge-planning">📋 Plan Ready</span>
                    </div>
                    {obj.why && (
                      <div className="card-body" style={{ marginBottom: 6 }}>
                        <strong>Why:</strong> {obj.why}
                      </div>
                    )}
                    {obj.expected_output && (
                      <div className="card-body" style={{ marginBottom: 8 }}>
                        <strong>Expected:</strong> {obj.expected_output}
                      </div>
                    )}
                    {plan && plan.steps && (
                      <>
                        <button
                          onClick={() => setExpandedPlan(isExpanded ? null : p.objective_id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-primary-hover)', fontSize: 13, fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0',
                          }}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {plan.steps.length} Plan Steps
                        </button>
                        {isExpanded && (
                          <div style={{ marginTop: 4 }}>
                            {plan.steps.map((step, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '10px 0', fontSize: 13, color: 'var(--color-text-secondary)',
                                borderBottom: '1px solid var(--color-border)',
                              }}>
                                <span style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: 'var(--color-primary-light)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--color-primary-hover)', fontSize: 11, fontWeight: 700, flexShrink: 0,
                                }}>
                                  {step.step_number}
                                </span>
                                <span>{step.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button
                        className="btn btn-primary"
                        disabled={confirming === p.objective_id}
                        onClick={() => handleConfirm(p.objective_id)}
                      >
                        <Check size={14} />
                        {confirming === p.objective_id ? 'Approving...' : 'Approve Plan'}
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleReject(p.objective_id)}>
                        Dismiss
                      </button>
                    </div>
                    <div className="card-tags">
                      {(obj.tags || []).map((t, i) => (
                        <span key={i} className="tag tag-primary">{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Active & Completed Objectives */}
        {sortedObjectives.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: pendingObjectives.length > 0 ? 20 : 0 }}>
              <Rocket size={16} /> Active Objectives
            </div>
            <div className="card-list">
              {sortedObjectives.map((o) => {
                const sc = statusConfig[o.status] || { color: 'badge-staging', label: o.status };
                return (
                  <div key={o.id} className="card">
                    <div className="card-header">
                      <span className="card-title">{o.what}</span>
                      <span className={`badge ${sc.color}`}>{sc.label}</span>
                    </div>
                    {o.why && (
                      <div className="card-body" style={{ marginBottom: 6 }}>
                        <strong>Why:</strong> {o.why}
                      </div>
                    )}
                    {o.expected_output && (
                      <div className="card-body" style={{ marginBottom: 4 }}>
                        <strong>Expected:</strong> {o.expected_output}
                      </div>
                    )}
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${o.workdone || 0}%` }} />
                    </div>
                    <div className="card-tags">
                      {(o.tags || []).map((t, i) => (
                        <span key={i} className="tag tag-primary">{t}</span>
                      ))}
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                        {o.workdone || 0}% complete
                      </span>
                    </div>
                    {o.plan && o.plan.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span>Plan Steps:</span>
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                            {o.plan.filter(s => s.status === 'completed').length}/{o.plan.length} done
                          </span>
                        </div>
                        {o.plan.map((step, i) => {
                          const isCompleted = step.status === 'completed';
                          const isUpdating = updatingStep === `${o.id}-${step.step_number}`;
                          return (
                            <div
                              key={i}
                              onClick={() => !isCompleted && handleStepToggle(o.id, step.step_number)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 6px', fontSize: 13, color: 'var(--color-text-secondary)',
                                borderBottom: '1px solid var(--color-border)',
                                cursor: isCompleted ? 'default' : 'pointer',
                                borderRadius: 6,
                                transition: 'all 0.2s',
                                background: isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                              }}
                              onMouseEnter={e => { if (!isCompleted) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'transparent'; }}
                            >
                              <span style={{
                                width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                                border: isCompleted ? '2px solid #10b981' : '2px solid var(--color-border)',
                                background: isCompleted ? '#10b981' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.25s',
                              }}>
                                {isUpdating ? (
                                  <Loader size={12} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                                ) : isCompleted ? (
                                  <CheckCircle size={13} color="white" style={{ strokeWidth: 3 }} />
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    {step.step_number}
                                  </span>
                                )}
                              </span>
                              <span style={{
                                textDecoration: isCompleted ? 'line-through' : 'none',
                                opacity: isCompleted ? 0.55 : 1,
                                color: isCompleted ? '#34d399' : 'var(--color-text-secondary)',
                                transition: 'all 0.2s',
                                flex: 1,
                              }}>
                                {step.description}
                              </span>
                              {!isCompleted && (
                                <span style={{
                                  fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.5,
                                  whiteSpace: 'nowrap',
                                }}>
                                  click to complete
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Empty state — beautiful and helpful */}
        {!loading && !hasContent && (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            animation: 'fadeInUp 0.5s ease-out',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', boxShadow: 'var(--shadow-glow-strong)',
            }}>
              <Target size={36} color="white" />
            </div>
            <h3 style={{
              fontSize: 22, fontWeight: 800, marginBottom: 10,
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              No Objectives Yet
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, maxWidth: 460, margin: '0 auto 28px', lineHeight: 1.7 }}>
              Objectives are goals with action plans. Create one here, or just tell JARVIS about your goals in chat — 
              like <em>"I want to launch a newsletter by March"</em> — and it'll be captured automatically.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <Plus size={15} /> Create an Objective
              </button>
              <button className="btn btn-secondary" onClick={goToChat}>
                <MessageSquare size={15} /> Tell JARVIS in Chat
              </button>
            </div>

            {/* Tips */}
            <div style={{
              marginTop: 36, padding: '20px 24px',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', textAlign: 'left', maxWidth: 500, margin: '36px auto 0',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={15} color="var(--color-primary)" /> How objectives work
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>1.</span>
                  <span>Describe what you want to achieve</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>2.</span>
                  <span>JARVIS creates a structured action plan</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>3.</span>
                  <span>Review and approve the plan</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>4.</span>
                  <span>Track progress step by step</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
