import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Brain, Plus, X, Sparkles } from 'lucide-react';

export default function ReflectionsView() {
  const { state, loadReflections, triggerReflection } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [trigger, setTrigger] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastReflection, setLastReflection] = useState(null);

  useEffect(() => {
    loadReflections();
  }, [loadReflections]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!trigger.trim()) return;
    setSaving(true);
    try {
      const result = await triggerReflection(trigger);
      setLastReflection(result);
      setTrigger('');
    } catch (err) {
      alert('Failed to create reflection: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-grid">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="section-title" style={{ margin: 0 }}>
            <Brain size={18} /> Reflections
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setLastReflection(null); }}>
            <Plus size={15} /> New Reflection
          </button>
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3><Sparkles size={16} /> Trigger a Reflection</h3>
                <button className="modal-close" onClick={() => setShowForm(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">What do you want to reflect on?</label>
                    <textarea
                      className="form-textarea"
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value)}
                      placeholder="e.g. How am I handling client communication? What patterns am I seeing in my work?"
                      rows={3}
                      required
                    />
                  </div>
                  {lastReflection && (
                    <div style={{
                      background: 'var(--color-primary-bg)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      marginTop: 12,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: 'var(--color-primary)' }}>
                        JARVIS's Reflection:
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{lastReflection.summary}</div>
                      {lastReflection.patterns_identified?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <strong style={{ fontSize: 12 }}>Patterns:</strong>
                          <ul style={{ paddingLeft: 18, marginTop: 4, fontSize: 13 }}>
                            {lastReflection.patterns_identified.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      )}
                      {lastReflection.suggestions?.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <strong style={{ fontSize: 12 }}>Suggestions:</strong>
                          <ul style={{ paddingLeft: 18, marginTop: 4, fontSize: 13 }}>
                            {lastReflection.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Close</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || !trigger.trim()}>
                    {saving ? 'Reflecting...' : 'Reflect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card-list">
          {state.reflections.length === 0 ? (
            <div className="empty-state">
              <Brain size={40} />
              <p>No reflections yet. Take a moment to reflect on your journey!</p>
            </div>
          ) : (
            state.reflections.map((r) => (
              <div key={r.id} className="card">
                <div className="card-header">
                  <span className="card-title">{r.trigger}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="card-body">{r.summary}</div>
                {r.patterns_identified?.length > 0 && (
                  <div className="card-tags" style={{ marginTop: 8 }}>
                    {r.patterns_identified.map((p, i) => (
                      <span key={i} className="tag tag-warning">{p}</span>
                    ))}
                  </div>
                )}
                {r.suggestions?.length > 0 && (
                  <div className="card-tags" style={{ marginTop: 6 }}>
                    {r.suggestions.map((s, i) => (
                      <span key={i} className="tag tag-success">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
