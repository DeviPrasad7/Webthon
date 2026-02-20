const BASE = '/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err}`);
  }
  return res.json();
}

export const api = {
  // Chat (persistent sessions)
  chat: (message, session_id = null, history = []) =>
    request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, session_id, history }),
    }),
  listChatSessions: (limit = 20) => request(`/chat/sessions?limit=${limit}`),
  getChatHistory: (sessionId) => request(`/chat/sessions/${sessionId}`),
  deleteChatSession: (sessionId) =>
    request(`/chat/sessions/${sessionId}`, { method: 'DELETE' }),

  // Dashboard
  dashboard: () => request('/dashboard'),

  // Objectives
  listObjectives: (limit = 20) => request(`/objectives?limit=${limit}`),
  getObjective: (id) => request(`/objectives/${id}`),
  ingestText: (text) =>
    request('/ingest/text', { method: 'POST', body: JSON.stringify({ text }) }),
  confirmPlan: (id, approved, modifications = null) =>
    request(`/objectives/${id}/confirm`, { method: 'POST', body: JSON.stringify({ approved, modifications }) }),
  updateProgress: (id, step) =>
    request(`/objectives/${id}/progress`, { method: 'POST', body: JSON.stringify({ completed_step: step }) }),
  getStatus: (id) => request(`/objectives/${id}/status`),

  // Learnings
  listLearnings: (limit = 20) => request(`/learnings?limit=${limit}`),
  captureLearning: (content, category = 'insight', tags = []) =>
    request('/learnings', { method: 'POST', body: JSON.stringify({ content, category, tags }) }),

  // Decisions
  listDecisions: (limit = 20) => request(`/decisions?limit=${limit}`),
  logDecision: (data) =>
    request('/decisions', { method: 'POST', body: JSON.stringify(data) }),

  // Reflections
  listReflections: (limit = 10) => request(`/reflections?limit=${limit}`),
  reflect: (trigger) =>
    request('/reflect', { method: 'POST', body: JSON.stringify({ trigger }) }),

  // Search
  search: (query, limit = 10) =>
    request('/search', { method: 'POST', body: JSON.stringify({ query, limit }) }),

  // Health
  health: () => fetch('/health').then(r => r.json()),
};
