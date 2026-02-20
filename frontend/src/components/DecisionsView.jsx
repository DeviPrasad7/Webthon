import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Scale, Plus, X } from 'lucide-react';

export default function DecisionsView() {
  const { state, loadDecisions, logDecision } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    decision: '', why: '', context: '', alternatives_considered: '',
    expected_outcome: '', tags: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.decision.trim() || !form.why.trim()) return;
    setSaving(true);
    try {
      await logDecision({
        decision: form.decision,
        why: form.why,
        context: form.context,
        alternatives_considered: form.alternatives_considered.split(',').map(s => s.trim()).filter(Boolean),
        expected_outcome: form.expected_outcome,
        tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      });
      setForm({ decision: '', why: '', context: '', alternatives_considered: '', expected_outcome: '', tags: '' });
      setShowForm(false);
    } catch (err) {
      alert('Failed to log decision: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="page-content">
      <div className="page-grid">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="section-title" style={{ margin: 0 }}>
            <Scale size={18} /> Decision Log
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={15} /> Log Decision
          </button>
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Log a Decision</h3>
                <button className="modal-close" onClick={() => setShowForm(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Decision</label>
                    <textarea className="form-textarea" value={form.decision} onChange={update('decision')}
                      placeholder="What did you decide?" rows={2} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Why?</label>
                    <textarea className="form-textarea" value={form.why} onChange={update('why')}
                      placeholder="Why did you make this choice?" rows={2} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Context</label>
                    <textarea className="form-textarea" value={form.context} onChange={update('context')}
                      placeholder="What was the situation?" rows={2} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alternatives Considered (comma-separated)</label>
                    <input className="form-input" value={form.alternatives_considered} onChange={update('alternatives_considered')}
                      placeholder="Option A, Option B, Option C" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expected Outcome</label>
                    <input className="form-input" value={form.expected_outcome} onChange={update('expected_outcome')}
                      placeholder="What do you expect to happen?" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tags (comma-separated)</label>
                    <input className="form-input" value={form.tags} onChange={update('tags')}
                      placeholder="e.g. pricing, strategy" />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || !form.decision.trim()}>
                    {saving ? 'Saving...' : 'Log Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card-list">
          {state.decisions.length === 0 ? (
            <div className="empty-state">
              <Scale size={40} />
              <p>No decisions logged yet. Start tracking your choices!</p>
            </div>
          ) : (
            state.decisions.map((d) => (
              <div key={d.id} className="card">
                <div className="card-header">
                  <span className="card-title">{d.decision}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ marginBottom: 6 }}><strong>Why:</strong> {d.why}</div>
                  {d.context && <div style={{ marginBottom: 6 }}><strong>Context:</strong> {d.context}</div>}
                  {d.alternatives_considered?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <strong>Alternatives:</strong> {d.alternatives_considered.join(', ')}
                    </div>
                  )}
                  {d.expected_outcome && (
                    <div><strong>Expected:</strong> {d.expected_outcome}</div>
                  )}
                </div>
                <div className="card-tags">
                  {(d.tags || []).map((t, i) => (
                    <span key={i} className="tag tag-primary">{t}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
