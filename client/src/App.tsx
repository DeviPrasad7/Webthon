import { useState, useEffect, useCallback } from "react";
import CreateObjectiveForm from "./components/CreateObjectiveForm";
import ObjectiveList from "./components/ObjectiveList";
import ObjectiveDetail from "./components/ObjectiveDetail";
import Dashboard from "./components/Dashboard";
import { fetchObjectives } from "./api";
import type { Objective } from "./types";
import "./App.css";

type View = "list" | "detail" | "create" | "dashboard";

function App() {
  const [view, setView] = useState<View>("list");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadObjectives = useCallback(async () => {
    try {
      const data = await fetchObjectives();
      setObjectives(data);
    } catch (err) {
      console.error("Failed to load objectives:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  function handleCreated(id: string) {
    setSelectedId(id);
    setView("detail");
    loadObjectives();
  }

  function handleBack() {
    setSelectedId(null);
    setView("list");
    loadObjectives();
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={() => { setView("list"); setSelectedId(null); loadObjectives(); }}>
          🧠 Decision Memory Engine
        </h1>
        <nav>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => { setView("list"); setSelectedId(null); loadObjectives(); }}
          >
            Objectives
          </button>
          <button
            className={view === "create" ? "active" : ""}
            onClick={() => setView("create")}
          >
            + New
          </button>
          <button
            className={view === "dashboard" ? "active" : ""}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view === "list" && (
          loading ? (
            <div className="card">Loading objectives...</div>
          ) : (
            <ObjectiveList objectives={objectives} onSelect={handleSelect} />
          )
        )}

        {view === "detail" && selectedId && (
          <ObjectiveDetail objectiveId={selectedId} onBack={handleBack} />
        )}

        {view === "create" && (
          <CreateObjectiveForm onCreated={handleCreated} />
        )}

        {view === "dashboard" && <Dashboard onSelectObjective={handleSelect} />}
      </main>
    </div>
  );
}

export default App;
