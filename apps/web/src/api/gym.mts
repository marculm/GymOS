import type {
  CreateExerciseInput,
  CreateWorkoutPlanInput,
  CreateWorkoutSessionInput,
  CreateWorkoutSetInput,
  Exercise,
  LoggedSet,
  Page,
  UpdateExerciseInput,
  UpdateWorkoutPlanInput,
  UpdateWorkoutRotationInput,
  WeightSuggestions,
  WorkoutPlan,
  WorkoutRotation,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import { ApiError, api } from "./client.mts";

type PageParams = {
  page?: number;
  size?: number;
};

function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getWeightSuggestions(): Promise<WeightSuggestions> {
  return api.get<WeightSuggestions>("/gym/exercises/weight-suggestions");
}

export function listExercises(params: PageParams = {}): Promise<Page<Exercise>> {
  return api.get<Page<Exercise>>(`/gym/exercises${toQuery(params)}`);
}

export function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  return api.post<Exercise>("/gym/exercises", input);
}

export function updateExercise(
  id: string,
  input: UpdateExerciseInput
): Promise<Exercise> {
  return api.put<Exercise>(`/gym/exercises/${id}`, input);
}

export function deleteExercise(id: string): Promise<Exercise> {
  return api.delete<Exercise>(`/gym/exercises/${id}`);
}

export function listPlans(
  params: PageParams & { name?: string } = {}
): Promise<Page<WorkoutPlan>> {
  return api.get<Page<WorkoutPlan>>(`/gym/plans${toQuery(params)}`);
}

const ALL_PAGE_SIZE = 100;

async function collectPages<T>(
  fetchPage: (page: number, size: number) => Promise<Page<T>>
): Promise<T[]> {
  const first = await fetchPage(1, ALL_PAGE_SIZE);
  const items = [...first.content];

  for (let page = 2; page <= first.page.totalPages; page += 1) {
    const next = await fetchPage(page, ALL_PAGE_SIZE);
    items.push(...next.content);
  }

  return items;
}

export function listAllExercises(): Promise<Exercise[]> {
  return collectPages((page, size) => listExercises({ page, size }));
}

export function listAllPlans(): Promise<WorkoutPlan[]> {
  return collectPages((page, size) => listPlans({ page, size }));
}

export function createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan> {
  return api.post<WorkoutPlan>("/gym/plans", input);
}

export function updatePlan(
  id: string,
  input: UpdateWorkoutPlanInput
): Promise<WorkoutPlan> {
  return api.put<WorkoutPlan>(`/gym/plans/${id}`, input);
}

export function deletePlan(id: string): Promise<void> {
  return api.delete<void>(`/gym/plans/${id}`);
}

export function getRotation(): Promise<WorkoutRotation> {
  return api.get<WorkoutRotation>("/gym/rotation");
}

export function setRotation(
  input: UpdateWorkoutRotationInput
): Promise<WorkoutRotation> {
  return api.put<WorkoutRotation>("/gym/rotation", input);
}

export function startSession(
  input: CreateWorkoutSessionInput
): Promise<WorkoutSessionDetail> {
  return api.post<WorkoutSessionDetail>("/gym/sessions", input);
}

export async function getActiveSession(): Promise<WorkoutSessionDetail | null> {
  try {
    return await api.get<WorkoutSessionDetail>("/gym/sessions/active");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function listSessions(
  params: PageParams & { planId?: string; from?: string; to?: string } = {}
): Promise<Page<WorkoutSessionSummary>> {
  return api.get<Page<WorkoutSessionSummary>>(`/gym/sessions${toQuery(params)}`);
}

export function addSet(
  sessionId: string,
  input: CreateWorkoutSetInput
): Promise<LoggedSet> {
  return api.post<LoggedSet>(`/gym/sessions/${sessionId}/sets`, input);
}

export function completeSession(
  sessionId: string
): Promise<WorkoutSessionDetail> {
  return api.post<WorkoutSessionDetail>(`/gym/sessions/${sessionId}/complete`, {});
}
