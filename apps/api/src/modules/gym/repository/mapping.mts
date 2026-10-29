import { Prisma } from "@prisma/client";
import type {
  Exercise,
  LoggedSet,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";

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
  },
} satisfies Prisma.WorkoutSessionInclude;

export type SessionWithSets = Prisma.WorkoutSessionGetPayload<{
  include: typeof sessionInclude;
}>;

type SessionWithSetCount = Prisma.WorkoutSessionGetPayload<{
  include: { _count: { select: { sets: true } } };
}>;

export function toExercise(exercise: {
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

export function toPlan(plan: PlanWithExercises): WorkoutPlan {
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

export function toSet(set: {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number | null;
  createdAt: Date;
}): LoggedSet {
  return {
    id: set.id,
    exerciseId: set.exerciseId,
    setNumber: set.setNumber,
    reps: set.reps,
    weightKg: set.weightKg,
    rpe: set.rpe,
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
