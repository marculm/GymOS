import { Prisma } from "@prisma/client";
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
import { HTTPException } from "hono/http-exception";
import { getCurrentUser } from "../../lib/current-user.ts";
import {
  createPlanWithExercises,
  createSession,
  createSet,
  findActiveSession,
  findExerciseIds,
  findExercises,
  findPlanById,
  findPlansByUser,
  findRecentSessions,
  findSessionById,
  markSessionCompleted,
} from "./repository.ts";

export function listExercises(): Promise<Exercise[]> {
  return findExercises();
}

export async function listPlans(): Promise<WorkoutPlan[]> {
  const user = await getCurrentUser();
  return findPlansByUser(user.id);
}

export async function createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan> {
  const user = await getCurrentUser();

  const requestedIds = [...new Set(input.exercises.map((exercise) => exercise.exerciseId))];
  const existingIds = await findExerciseIds(requestedIds);
  const missing = requestedIds.filter((id) => !existingIds.includes(id));

  if (missing.length > 0) {
    throw new HTTPException(400, {
      message: `Unknown exercise IDs: ${missing.join(", ")}`,
    });
  }

  try {
    return await createPlanWithExercises(user.id, input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HTTPException(409, { message: "A plan with this name already exists" });
    }
    throw error;
  }
}

export async function startSession(
  input: CreateWorkoutSessionInput
): Promise<WorkoutSessionDetail> {
  const user = await getCurrentUser();
  const active = await findActiveSession(user.id);
  if (active) {
    throw new HTTPException(409, { message: "An active session is already in progress" });
  }

  let planId: string | null = null;
  let title = input.title;

  if (input.planId) {
    const plan = await findPlanById(user.id, input.planId);
    if (!plan) {
      throw new HTTPException(404, { message: "Plan not found" });
    }
    planId = plan.id;
    title = title ?? plan.name;
  }

  return createSession(user.id, { title: title ?? "Free Workout", planId });
}

export async function getActiveSession(): Promise<WorkoutSessionDetail | null> {
  const user = await getCurrentUser();
  return findActiveSession(user.id);
}

export async function listSessions(limit: number): Promise<WorkoutSessionSummary[]> {
  const user = await getCurrentUser();
  return findRecentSessions(user.id, limit);
}

export async function getSession(sessionId: string): Promise<WorkoutSessionDetail> {
  const user = await getCurrentUser();
  const session = await findSessionById(user.id, sessionId);
  if (!session) {
    throw new HTTPException(404, { message: "Session not found" });
  }
  return session;
}

export async function logSet(
  sessionId: string,
  input: CreateWorkoutSetInput
): Promise<LoggedSet> {
  const user = await getCurrentUser();
  const session = await findSessionById(user.id, sessionId);
  if (!session) {
    throw new HTTPException(404, { message: "Session not found" });
  }
  if (session.completedAt) {
    throw new HTTPException(409, { message: "Session is already completed" });
  }

  const exerciseIds = await findExerciseIds([input.exerciseId]);
  if (exerciseIds.length === 0) {
    throw new HTTPException(400, { message: `Unknown exercise ID: ${input.exerciseId}` });
  }

  try {
    return await createSet(sessionId, input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HTTPException(409, { message: "Set was already logged, retry" });
    }
    throw error;
  }
}

export async function completeSession(
  sessionId: string
): Promise<WorkoutSessionDetail> {
  const user = await getCurrentUser();
  const session = await findSessionById(user.id, sessionId);
  if (!session) {
    throw new HTTPException(404, { message: "Session not found" });
  }
  if (session.completedAt) {
    throw new HTTPException(409, { message: "Session is already completed" });
  }
  return markSessionCompleted(sessionId);
}
