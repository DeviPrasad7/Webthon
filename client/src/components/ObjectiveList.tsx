import type { Objective } from "../types";

interface Props {
  objectives: Objective[];
  onSelect: (id: string) => void;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    PLANNING: "#f59e0b",
    ACTIVE: "#3b82f6",
    COMPLETED: "#10b981",
    ARCHIVED: "#6b7280",
  };
  return (
    <span
      className="badge"
      style={{ backgroundColor: colors[status] || "#6b7280" }}
    >
      {status}
    </span>
  );
}

export default function ObjectiveList({ objectives, onSelect }: Props) {
  if (objectives.length === 0) {
    return (
      <div className="card empty-state">
        <p>No objectives yet. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="objective-list">
      {objectives.map((obj) => (
        <div
          key={obj.id}
          className="card objective-card"
          onClick={() => onSelect(obj.id)}
        >
          <div className="card-header">
            <h3>{obj.what || obj.raw_input?.slice(0, 80) || "Untitled"}</h3>
            {statusBadge(obj.status)}
          </div>

          {obj.status === "ACTIVE" && (
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${obj.progress_percentage}%` }}
              />
              <span className="progress-text">
                {obj.progress_percentage}%
              </span>
            </div>
          )}

          {obj.outcome && (
            <span
              className="badge outcome-badge"
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
          )}

          <p className="meta">
            Created {new Date(obj.created_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}
