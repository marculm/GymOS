import { Prisma } from "@prisma/client";
import type { CreateWorkoutPlanInput, Exercise, WorkoutPlan } from "@gymos/shared";
import { HTTPException } from "hono/http-exception";
import { getCurrentUser } from "../../lib/current-user.ts";
import {
  createPlanWithExercises,
  findExerciseIds,
  findExercises,
  findPlansByUser,
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
