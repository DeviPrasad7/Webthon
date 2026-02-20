import type { Objective, DashboardData, PlanStep } from "./types";

const USER_ID = "00000000-0000-0000-0000-000000000001"; // Demo user

const headers = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "x-user-id": USER_ID,
});

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

// ─── OBJECTIVES ─────────────────────────────────────────────────────────

export async function createObjective(data: {
  what: string;
  context: string;
  expected_output: string;
  decision_rationale: string;
}): Promise<{ id: string }> {
  const res = await fetch("/api/objectives", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function fetchObjectives(): Promise<Objective[]> {
  const res = await fetch("/api/objectives", { headers: headers() });
  return handleResponse(res);
}

export async function fetchObjective(id: string): Promise<Objective> {
  const res = await fetch(`/api/objectives/${id}`, { headers: headers() });
  return handleResponse(res);
}

export async function confirmPlan(
  id: string,
  plan: PlanStep[]
): Promise<void> {
  const res = await fetch(`/api/objectives/${id}/confirm`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ plan }),
  });
  await handleResponse(res);
}

export async function updatePlan(
  id: string,
  plan: PlanStep[]
): Promise<void> {
  const res = await fetch(`/api/objectives/${id}/plan`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ plan }),
  });
  await handleResponse(res);
}

export async function completeObjective(
  id: string,
  outcome: string,
  raw_reflection: string
): Promise<void> {
  const res = await fetch(`/api/objectives/${id}/complete`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ outcome, raw_reflection }),
  });
  await handleResponse(res);
}

export async function deleteObjective(id: string): Promise<void> {
  const res = await fetch(`/api/objectives/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  await handleResponse(res);
}

// ─── MEMORY / DASHBOARD ────────────────────────────────────────────────

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/memory/dashboard", { headers: headers() });
  return handleResponse(res);
}

// ─── SSE ────────────────────────────────────────────────────────────────

export function subscribeToObjective(
  id: string,
  onUpdate: () => void
): () => void {
  const eventSource = new EventSource(`/api/objectives/${id}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === "updated") {
        onUpdate();
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    // EventSource will auto-reconnect
  };

  return () => eventSource.close();
}
