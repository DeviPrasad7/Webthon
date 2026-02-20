export interface PlanStep {
  step_id: string;
  desc: string;
  status: "pending" | "done" | "skipped";
}

export interface Objective {
  id: string;
  user_id: string;
  status: "PLANNING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  what: string;
  context: string;
  expected_output: string;
  decision_rationale: string;
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
  distance: number;
  what?: string;
  outcome?: string;
  success_driver?: string;
  failure_reason?: string;
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
