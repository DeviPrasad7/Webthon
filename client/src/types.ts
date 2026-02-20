export interface PlanStep {
  step_id: string;
  desc: string;
  status: "pending" | "done" | "skipped";
  notes?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  revised_plan?: PlanStep[];
}

export interface Objective {
  id: string;
  user_id: string;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  raw_input: string;
  is_voice: boolean;
  what: string | null;
  context: string | null;
  expected_output: string | null;
  decision_rationale: string | null;
  jarvis_insight: string | null;
  plan: PlanStep[];
  outcome: string | null;
  raw_reflection: string | null;
  success_driver: string | null;
  failure_reason: string | null;
  suggested_similarities: SimilarObjective[];
  is_deleted: boolean;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  progress_percentage: number;
}

export interface SimilarObjective {
  objective_id: string;
  similarity_score: number;
  what?: string;
  raw_input?: string;
  context?: string;
  expected_output?: string;
  decision_rationale?: string;
  outcome?: string;
  raw_reflection?: string;
  success_driver?: string;
  failure_reason?: string;
  plan_summary?: string;
  completed_at?: string;
}

export interface DashboardData {
  failure_patterns: { failure_reason: string; count: string }[];
  success_patterns: { success_driver: string; count: string }[];
  recent_completed: {
    id: string;
    what: string;
    outcome: string;
    success_driver: string | null;
    failure_reason: string | null;
    completed_at: string;
  }[];
  stats: {
    completed: string;
    active: string;
    planning: string;
    successes: string;
    failures: string;
    partials: string;
  };
}

export interface PatternObjective {
  id: string;
  what: string;
  outcome: string;
  context: string;
  success_driver: string | null;
  failure_reason: string | null;
  completed_at: string;
}
