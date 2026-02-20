import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Target, Lightbulb, Scale, Brain, TrendingUp, AlertTriangle } from 'lucide-react';

export default function DashboardView() {
  const { state, loadDashboard } = useApp();
  const { dashboard } = state;

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (!dashboard) {
    return (
      <div className="page-content">
        <div className="page-grid">
          <div className="empty-state">
            <TrendingUp size={48} />
            <p>Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-grid">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-label">🎯 Objectives</div>
            <div className="stat-card-value">{dashboard.counts.objectives}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">💡 Learnings</div>
            <div className="stat-card-value">{dashboard.counts.learnings}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">⚖️ Decisions</div>
            <div className="stat-card-value">{dashboard.counts.decisions}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">🧠 Reflections</div>
            <div className="stat-card-value">{dashboard.counts.reflections}</div>
          </div>
        </div>

        {/* Recent Objectives */}
        <div className="section-title">
          <Target size={16} /> Recent Objectives
        </div>
        <div className="card-list">
          {dashboard.objectives.length === 0 ? (
            <div className="empty-state"><p>No objectives yet. Create one to get started!</p></div>
          ) : (
            dashboard.objectives.map((o) => (
              <div key={o.id} className="card">
                <div className="card-header">
                  <span className="card-title">{o.what}</span>
                  <span className={`badge badge-${o.status}`}>{o.status}</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${o.workdone}%` }} />
                </div>
                <div className="card-tags">
                  {(o.tags || []).map((t, i) => (
                    <span key={i} className="tag tag-primary">{t}</span>
                  ))}
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    {o.workdone}% done
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Learnings */}
        <div className="section-title">
          <Lightbulb size={16} /> Recent Learnings
        </div>
        <div className="card-list">
          {dashboard.learnings.length === 0 ? (
            <div className="empty-state"><p>No learnings captured yet.</p></div>
          ) : (
            dashboard.learnings.map((l) => (
              <div key={l.id} className="card">
                <div className="card-header">
                  <span className={`tag ${l.category === 'mistake' ? 'tag-danger' : l.category === 'success' ? 'tag-success' : 'tag-info'}`}>
                    {l.category}
                  </span>
                </div>
                <div className="card-body">{l.content}</div>
                <div className="card-tags">
                  {(l.tags || []).map((t, i) => (
                    <span key={i} className="tag tag-primary">{t}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Decisions */}
        <div className="section-title">
          <Scale size={16} /> Recent Decisions
        </div>
        <div className="card-list">
          {dashboard.decisions.length === 0 ? (
            <div className="empty-state"><p>No decisions logged yet.</p></div>
          ) : (
            dashboard.decisions.map((d) => (
              <div key={d.id} className="card">
                <div className="card-title">{d.decision}</div>
                <div className="card-body" style={{ marginTop: 6 }}>Why: {d.why}</div>
                <div className="card-tags">
                  {(d.tags || []).map((t, i) => (
                    <span key={i} className="tag tag-primary">{t}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Reflections */}
        <div className="section-title">
          <Brain size={16} /> Recent Reflections
        </div>
        <div className="card-list">
          {dashboard.reflections.length === 0 ? (
            <div className="empty-state"><p>No reflections yet.</p></div>
          ) : (
            dashboard.reflections.map((r) => (
              <div key={r.id} className="card">
                <div className="card-title">{r.trigger}</div>
                <div className="card-body" style={{ marginTop: 6 }}>
                  {r.patterns} patterns · {r.suggestions} suggestions
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
