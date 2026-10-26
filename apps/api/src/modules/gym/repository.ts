import { Prisma } from "@prisma/client";
import type {
  CreateWorkoutPlanInput,
  Exercise,
  LoggedSet,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import { prisma } from "../../db/client.ts";

const planInclude = {
  exercises: {
    include: { exercise: true },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.WorkoutPlanInclude;

type PlanWithExercises = Prisma.WorkoutPlanGetPayload<{ include: typeof planInclude }>;

const sessionInclude = {
  sets: {
    orderBy: [{ exerciseId: "asc" as const }, { setNumber: "asc" as const }],
  },
} satisfies Prisma.WorkoutSessionInclude;

type SessionWithSets = Prisma.WorkoutSessionGetPayload<{ include: typeof sessionInclude }>;

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

function toSet(set: {
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

function toSessionDetail(session: SessionWithSets): WorkoutSessionDetail {
  return {
    id: session.id,
    title: session.title,
    planId: session.planId,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    sets: session.sets.map(toSet),
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

export async function findActiveSession(
  userId: string
): Promise<WorkoutSessionDetail | null> {
  const session = await prisma.workoutSession.findFirst({
    where: { userId, completedAt: null },
    orderBy: { startedAt: "desc" },
    include: sessionInclude,
  });
  return session ? toSessionDetail(session) : null;
}

export async function findSessionById(
  userId: string,
  sessionId: string
): Promise<WorkoutSessionDetail | null> {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: sessionInclude,
  });
  return session ? toSessionDetail(session) : null;
}

export async function findRecentSessions(
  userId: string,
  limit: number
): Promise<WorkoutSessionSummary[]> {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { _count: { select: { sets: true } } },
  });

  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    planId: session.planId,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    totalSets: session._count.sets,
  }));
}

export async function createSession(
  userId: string,
  input: { title: string; planId: string | null }
): Promise<WorkoutSessionDetail> {
  const session = await prisma.workoutSession.create({
    data: { userId, title: input.title, planId: input.planId },
    include: sessionInclude,
  });
  return toSessionDetail(session);
}

export async function maxSetNumber(
  sessionId: string,
  exerciseId: string
): Promise<number> {
  const result = await prisma.workoutSet.aggregate({
    where: { workoutSessionId: sessionId, exerciseId },
    _max: { setNumber: true },
  });
  return result._max.setNumber ?? 0;
}

export async function createSet(
  sessionId: string,
  input: { exerciseId: string; reps: number; weightKg: number; rpe?: number }
): Promise<LoggedSet> {
  const setNumber = (await maxSetNumber(sessionId, input.exerciseId)) + 1;
  const set = await prisma.workoutSet.create({
    data: {
      workoutSessionId: sessionId,
      exerciseId: input.exerciseId,
      setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      rpe: input.rpe ?? null,
    },
  });
  return toSet(set);
}

export async function markSessionCompleted(
  sessionId: string
): Promise<WorkoutSessionDetail> {
  const session = await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { completedAt: new Date() },
    include: sessionInclude,
  });
  return toSessionDetail(session);
}
