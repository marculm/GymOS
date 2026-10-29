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
import { getCurrentUser } from "../../lib/current-user.mts";
import {
  completeSessionIfOpen,
  createPlanWithExercises,
  createSessionIfNoActive,
  createSetIfSessionOpen,
  findActiveSession,
  findExerciseIds,
  findExercises,
  findPlanById,
  findPlansByUser,
  findRecentSessions,
  findSessionById,
  type CompleteSessionResult,
  type LogSetResult,
} from "./repository.mts";

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

  let session: WorkoutSessionDetail | null;
  try {
    session = await createSessionIfNoActive(user.id, {
      title: title ?? "Free Workout",
      planId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new HTTPException(409, { message: "Concurrent update, retry" });
    }
    throw error;
  }

  if (!session) {
    throw new HTTPException(409, { message: "An active session is already in progress" });
  }

  return session;
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

  let result: LogSetResult;
  try {
    result = await createSetIfSessionOpen(user.id, sessionId, input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new HTTPException(409, { message: "Set was already logged, retry" });
      }
      if (error.code === "P2034") {
        throw new HTTPException(409, { message: "Concurrent update, retry" });
      }
    }
    throw error;
  }

  switch (result.kind) {
    case "created":
      return result.set;
    case "not_found":
      throw new HTTPException(404, { message: "Session not found" });
    case "completed":
      throw new HTTPException(409, { message: "Session is already completed" });
    case "unknown_exercise":
      throw new HTTPException(400, {
        message: `Unknown exercise ID: ${input.exerciseId}`,
      });
  }
}

export async function completeSession(
  sessionId: string
): Promise<WorkoutSessionDetail> {
  const user = await getCurrentUser();

  let result: CompleteSessionResult;
  try {
    result = await completeSessionIfOpen(user.id, sessionId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new HTTPException(409, { message: "Concurrent update, retry" });
    }
    throw error;
  }

  switch (result.kind) {
    case "completed":
      return result.session;
    case "not_found":
      throw new HTTPException(404, { message: "Session not found" });
    case "already_completed":
      throw new HTTPException(409, { message: "Session is already completed" });
  }
}
