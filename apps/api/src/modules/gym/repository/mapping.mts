import { Prisma } from "../../../generated/prisma/client";
import {
  ExerciseSchema,
  type Exercise,
  type LoggedSet,
  type WorkoutPlan,
  type WorkoutSessionDetail,
  type WorkoutSessionSummary,
} from "@gymos/shared";
import { InvalidMuscleGroupError } from "../service/errors.mts";

export const planInclude = {
  exercises: {
    include: { exercise: true },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.WorkoutPlanInclude;

export type PlanWithExercises = Prisma.WorkoutPlanGetPayload<{
  include: typeof planInclude;
}>;

export const sessionInclude = {
  sets: {
    orderBy: [
      { exerciseId: "asc" as const },
      { setNumber: "asc" as const },
    ],
    include: { exercise: { select: { name: true } } },
  },
} satisfies Prisma.WorkoutSessionInclude;

export type SessionWithSets = Prisma.WorkoutSessionGetPayload<{
  include: typeof sessionInclude;
}>;

type SessionWithSetCount = Prisma.WorkoutSessionGetPayload<{
  include: { _count: { select: { sets: true } } };
}>;

const muscleGroupSchema = ExerciseSchema.shape.muscleGroup;

export function toExercise(exercise: {
  id: string;
  name: string;
  muscleGroup: string;
  description: string | null;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
}): Exercise {
  const muscleGroup = muscleGroupSchema.safeParse(exercise.muscleGroup);
  if (!muscleGroup.success) {
    throw new InvalidMuscleGroupError(exercise.id, exercise.muscleGroup);
  }
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: muscleGroup.data,
    description: exercise.description,
    defaultSets: exercise.defaultSets,
    defaultReps: exercise.defaultReps,
    defaultWeightKg: exercise.defaultWeightKg,
  };
}

export function toPlan(plan: PlanWithExercises): WorkoutPlan {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    createdAt: plan.createdAt.toISOString(),
    exercises: plan.exercises.map((entry) => ({
      id: entry.id,
      position: entry.position,
      targetSets: entry.exercise.defaultSets,
      targetReps: entry.exercise.defaultReps,
      targetWeightKg: entry.exercise.defaultWeightKg,
      notes: entry.notes,
      exercise: toExercise(entry.exercise),
    })),
  };
}

export function toSet(set: {
  id: string;
  exerciseId: string;
  exercise: { name: string };
  setNumber: number;
  reps: number;
  weightKg: number;
  createdAt: Date;
}): LoggedSet {
  return {
    id: set.id,
    exerciseId: set.exerciseId,
    exerciseName: set.exercise.name,
    setNumber: set.setNumber,
    reps: set.reps,
    weightKg: set.weightKg,
    createdAt: set.createdAt.toISOString(),
  };
}

export function toSessionDetail(session: SessionWithSets): WorkoutSessionDetail {
  return {
    id: session.id,
    title: session.title,
    planId: session.planId,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    sets: session.sets.map(toSet),
  };
}

export function toSessionSummary(session: SessionWithSetCount): WorkoutSessionSummary {
  return {
    id: session.id,
    title: session.title,
    planId: session.planId,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    totalSets: session._count.sets,
  };
}
