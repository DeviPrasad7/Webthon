import { useState, useEffect, useCallback } from "react";
import ExecutiveLayout from "./components/ExecutiveLayout";
import TheOracleInput from "./components/TheOracleInput";
import ObjectiveDetail from "./components/ObjectiveDetail";
import WisdomVault from "./components/WisdomVault";
import { fetchObjectives } from "./api";
import type { Objective } from "./types";

type View = "create" | "detail" | "dashboard";

function App() {
  const [view, setView] = useState<View>("create");
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadObjectives = useCallback(async () => {
    try {
      const data = await fetchObjectives();
      setObjectives(data);
    } catch {
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

  function handleNewBrainDump() {
    setSelectedId(null);
    setView("create");
  }

  function handleDashboard() {
    setSelectedId(null);
    setView("dashboard");
  }

  return (
    <ExecutiveLayout
      objectives={objectives}
      selectedId={selectedId}
      loading={loading}
      view={view}
      onSelect={handleSelect}
      onNewBrainDump={handleNewBrainDump}
      onDashboard={handleDashboard}
    >
      {view === "create" && <TheOracleInput onCreated={handleCreated} />}
      {view === "detail" && selectedId && (
        <ObjectiveDetail
          objectiveId={selectedId}
          onBack={handleNewBrainDump}
          onSelectObjective={handleSelect}
        />
      )}
      {view === "dashboard" && <WisdomVault onSelectObjective={handleSelect} />}
    </ExecutiveLayout>
  );
}

export default App;
