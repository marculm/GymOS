import { Prisma } from "@prisma/client";
import type { CreateWorkoutPlanInput, Exercise, WorkoutPlan } from "@gymos/shared";
import { prisma } from "../../db/client.ts";

const planInclude = {
  exercises: {
    include: { exercise: true },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.WorkoutPlanInclude;

type PlanWithExercises = Prisma.WorkoutPlanGetPayload<{ include: typeof planInclude }>;

function toExercise(exercise: {
  id: string;
  name: string;
  muscleGroup: string;
  description: string | null;
}): Exercise {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup as Exercise["muscleGroup"],
    description: exercise.description,
  };
}

function toPlan(plan: PlanWithExercises): WorkoutPlan {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    createdAt: plan.createdAt.toISOString(),
    exercises: plan.exercises.map((entry) => ({
      id: entry.id,
      position: entry.position,
      targetSets: entry.targetSets,
      targetReps: entry.targetReps,
      targetWeightKg: entry.targetWeightKg,
      notes: entry.notes,
      exercise: toExercise(entry.exercise),
    })),
  };
}

export async function findExercises(): Promise<Exercise[]> {
  const exercises = await prisma.exercise.findMany({ orderBy: { name: "asc" } });
  return exercises.map(toExercise);
}

export async function findPlansByUser(userId: string): Promise<WorkoutPlan[]> {
  const plans = await prisma.workoutPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: planInclude,
  });
  return plans.map(toPlan);
}

export async function findPlanById(userId: string, planId: string): Promise<WorkoutPlan | null> {
  const plan = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    include: planInclude,
  });
  return plan ? toPlan(plan) : null;
}

export async function findExerciseIds(ids: string[]): Promise<string[]> {
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return exercises.map((exercise) => exercise.id);
}

export async function createPlanWithExercises(
  userId: string,
  input: CreateWorkoutPlanInput
): Promise<WorkoutPlan> {
  const plan = await prisma.workoutPlan.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      exercises: {
        create: input.exercises.map((exercise, index) => ({
          exerciseId: exercise.exerciseId,
          position: index,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps,
          targetWeightKg: exercise.targetWeightKg ?? null,
          notes: exercise.notes ?? null,
        })),
      },
    },
    include: planInclude,
  });
  return toPlan(plan);
}
