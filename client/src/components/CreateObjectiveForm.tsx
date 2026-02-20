import { useState } from "react";
import { createObjective } from "../api";

interface Props {
  onCreated: (id: string) => void;
}

export default function CreateObjectiveForm({ onCreated }: Props) {
  const [what, setWhat] = useState("");
  const [context, setContext] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await createObjective({
        what,
        context,
        expected_output: expectedOutput,
        decision_rationale: decisionRationale,
      });
      setWhat("");
      setContext("");
      setExpectedOutput("");
      setDecisionRationale("");
      onCreated(result.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>New Objective</h2>

      <label>
        What are you deciding?
        <textarea
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="e.g., Migrate auth to OAuth2"
          required
        />
      </label>

      <label>
        Context
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Background info, constraints, stakeholders..."
          required
        />
      </label>

      <label>
        Expected Output
        <textarea
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          placeholder="What does success look like?"
          required
        />
      </label>

      <label>
        Decision Rationale
        <textarea
          value={decisionRationale}
          onChange={(e) => setDecisionRationale(e.target.value)}
          placeholder="Why this approach?"
          required
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Objective"}
      </button>
    </form>
  );
}
