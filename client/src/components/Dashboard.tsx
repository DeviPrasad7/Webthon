import { useEffect, useState } from "react";
import type { DashboardData } from "../types";
import { fetchDashboard } from "../api";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">Loading dashboard...</div>;
  if (!data) return <div className="card">Failed to load dashboard.</div>;

  const stats = data.stats;

  return (
    <div className="dashboard">
      <h2>🧠 Cognitive Dashboard</h2>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.planning}</div>
          <div className="stat-label">Planning</div>
        </div>
        <div className="stat-card success">
          <div className="stat-number">{stats.successes}</div>
          <div className="stat-label">Successes</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-number">{stats.failures}</div>
          <div className="stat-label">Failures</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-number">{stats.partials}</div>
          <div className="stat-label">Partial</div>
        </div>
      </div>

      {/* Patterns */}
      <div className="patterns-grid">
        <div className="card">
          <h3>✅ Top Success Patterns</h3>
          {data.success_patterns.length === 0 ? (
            <p className="muted">No patterns yet</p>
          ) : (
            <ul className="pattern-list">
              {data.success_patterns.map((p, i) => (
                <li key={i}>
                  <span className="pattern-text">{p.success_driver}</span>
                  <span className="pattern-count">{p.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>⚠️ Top Failure Patterns</h3>
          {data.failure_patterns.length === 0 ? (
            <p className="muted">No patterns yet</p>
          ) : (
            <ul className="pattern-list">
              {data.failure_patterns.map((p, i) => (
                <li key={i}>
                  <span className="pattern-text">{p.failure_reason}</span>
                  <span className="pattern-count">{p.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Completed */}
      <div className="card">
        <h3>📜 Recent Completed</h3>
        {data.recent_completed.length === 0 ? (
          <p className="muted">No completed objectives yet</p>
        ) : (
          <table className="recent-table">
            <thead>
              <tr>
                <th>Objective</th>
                <th>Outcome</th>
                <th>Success Driver</th>
                <th>Failure Reason</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_completed.map((obj) => (
                <tr key={obj.id}>
                  <td>{obj.what}</td>
                  <td>
                    <span
                      className="badge"
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
                  </td>
                  <td>{obj.success_driver || "—"}</td>
                  <td>{obj.failure_reason || "—"}</td>
                  <td>
                    {obj.completed_at
                      ? new Date(obj.completed_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
