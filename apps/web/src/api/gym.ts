import type {
  CreateWorkoutPlanInput,
  CreateWorkoutSessionInput,
  CreateWorkoutSetInput,
  Exercise,
  LoggedSet,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import { api } from "./client.ts";

export async function listExercises(): Promise<Exercise[]> {
  const { exercises } = await api.get<{ exercises: Exercise[] }>("/gym/exercises");
  return exercises;
}

export async function listPlans(): Promise<WorkoutPlan[]> {
  const { plans } = await api.get<{ plans: WorkoutPlan[] }>("/gym/plans");
  return plans;
}

export async function createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan> {
  const { plan } = await api.post<{ plan: WorkoutPlan }>("/gym/plans", input);
  return plan;
}

export async function startSession(
  input: CreateWorkoutSessionInput
): Promise<WorkoutSessionDetail> {
  const { session } = await api.post<{ session: WorkoutSessionDetail }>(
    "/gym/sessions",
    input
  );
  return session;
}

export async function getActiveSession(): Promise<WorkoutSessionDetail | null> {
  const { session } = await api.get<{ session: WorkoutSessionDetail | null }>(
    "/gym/sessions/active"
  );
  return session;
}

export async function listSessions(limit = 10): Promise<WorkoutSessionSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const { sessions } = await api.get<{ sessions: WorkoutSessionSummary[] }>(
    `/gym/sessions?${params.toString()}`
  );
  return sessions;
}

export async function getSession(sessionId: string): Promise<WorkoutSessionDetail> {
  const { session } = await api.get<{ session: WorkoutSessionDetail }>(
    `/gym/sessions/${sessionId}`
  );
  return session;
}

export async function addSet(
  sessionId: string,
  input: CreateWorkoutSetInput
): Promise<LoggedSet> {
  const { set } = await api.post<{ set: LoggedSet }>(
    `/gym/sessions/${sessionId}/sets`,
    input
  );
  return set;
}

export async function completeSession(
  sessionId: string
): Promise<WorkoutSessionDetail> {
  const { session } = await api.post<{ session: WorkoutSessionDetail }>(
    `/gym/sessions/${sessionId}/complete`,
    {}
  );
  return session;
}
