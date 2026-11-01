import { Prisma } from "@prisma/client";
import type {
  LoggedSet,
  WeightSuggestions,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";
import type { SessionSearchParams } from "../service/search-params.mts";
import { buildSessionWhere } from "./where-builder.mts";
import {
  sessionInclude,
  toSessionDetail,
  toSessionSummary,
  toSet,
} from "./mapping.mts";
import { withSerializableRetry } from "./transaction.mts";

export type LogSetResult =
  | { kind: "created"; set: LoggedSet }
  | { kind: "not_found" }
  | { kind: "completed" }
  | { kind: "unknown_exercise" }
  | { kind: "duplicate" };

export type CompleteSessionResult =
  | { kind: "completed"; session: WorkoutSessionDetail }
  | { kind: "not_found" }
  | { kind: "already_completed" };

export class SessionRepository {
  async findActive(userId: string): Promise<WorkoutSessionDetail | null> {
    const session = await prisma.workoutSession.findFirst({
      where: { userId, completedAt: null },
      orderBy: { startedAt: "desc" },
      include: sessionInclude,
    });
    return session ? toSessionDetail(session) : null;
  }

  async findById(
    userId: string,
    sessionId: string
  ): Promise<WorkoutSessionDetail | null> {
    const session = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: sessionInclude,
    });
    return session ? toSessionDetail(session) : null;
  }

  async findRecent(
    userId: string,
    { skip, take }: { skip: number; take: number },
    filters: SessionSearchParams = {}
  ): Promise<WorkoutSessionSummary[]> {
    const sessions = await prisma.workoutSession.findMany({
      where: buildSessionWhere(userId, filters),
      orderBy: { startedAt: "desc" },
      skip,
      take,
      include: { _count: { select: { sets: true } } },
    });
    return sessions.map(toSessionSummary);
  }

  async findCompleted(userId: string): Promise<WorkoutSessionDetail[]> {
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      include: sessionInclude,
    });
    return sessions.map(toSessionDetail);
  }

  async countRecent(
    userId: string,
    filters: SessionSearchParams = {}
  ): Promise<number> {
    return prisma.workoutSession.count({
      where: buildSessionWhere(userId, filters),
    });
  }

  async findLastCompletedPlanId(userId: string): Promise<string | null> {
    const session = await prisma.workoutSession.findFirst({
      where: { userId, completedAt: { not: null }, planId: { not: null } },
      orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
      select: { planId: true },
    });
    return session?.planId ?? null;
  }

  async findWeightSuggestions(userId: string): Promise<WeightSuggestions> {
    // shortcut: loads every completed set for the user; add a per-exercise
    // latest-session query if history grows large.
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, completedAt: { not: null }, sets: { some: {} } },
      orderBy: [{ completedAt: "desc" }, { startedAt: "desc" }],
      select: { sets: { select: { exerciseId: true, weightKg: true } } },
    });

    const latestWeights = new Map<string, number[]>();
    for (const session of sessions) {
      const byExercise = new Map<string, number[]>();
      for (const set of session.sets) {
        const weights = byExercise.get(set.exerciseId) ?? [];
        weights.push(set.weightKg);
        byExercise.set(set.exerciseId, weights);
      }
      for (const [exerciseId, weights] of byExercise) {
        if (!latestWeights.has(exerciseId)) {
          latestWeights.set(exerciseId, weights);
        }
      }
    }

    const suggestions: WeightSuggestions = {};
    for (const [exerciseId, weights] of latestWeights) {
      const average =
        weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
      suggestions[exerciseId] = Math.round(average * 2) / 2;
    }
    return suggestions;
  }

  async createIfNoActive(
    userId: string,
    input: { title: string; planId: string | null }
  ): Promise<WorkoutSessionDetail | null> {
    return withSerializableRetry(async (tx) => {
      const active = await tx.workoutSession.findFirst({
        where: { userId, completedAt: null },
        select: { id: true },
      });
      if (active) return null;

      const session = await tx.workoutSession.create({
        data: { userId, title: input.title, planId: input.planId },
        include: sessionInclude,
      });
      return toSessionDetail(session);
    });
  }

  async logSet(
    userId: string,
    sessionId: string,
    input: { exerciseId: string; reps: number; weightKg: number }
  ): Promise<LogSetResult> {
    try {
      return await withSerializableRetry(async (tx) => {
        const session = await tx.workoutSession.findFirst({
          where: { id: sessionId, userId },
          select: { id: true, completedAt: true },
        });
        if (!session) return { kind: "not_found" } as const;
        if (session.completedAt) return { kind: "completed" } as const;

        const exercise = await tx.exercise.findUnique({
          where: { id: input.exerciseId },
          select: { id: true, name: true },
        });
        if (!exercise) return { kind: "unknown_exercise" } as const;

        const max = await tx.workoutSet.aggregate({
          where: { workoutSessionId: sessionId, exerciseId: input.exerciseId },
          _max: { setNumber: true },
        });
        const set = await tx.workoutSet.create({
          data: {
            workoutSessionId: sessionId,
            exerciseId: input.exerciseId,
            setNumber: (max._max.setNumber ?? 0) + 1,
            reps: input.reps,
            weightKg: input.weightKg,
          },
        });
        return {
          kind: "created",
          set: toSet({ ...set, exercise: { name: exercise.name } }),
        } as const;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { kind: "duplicate" };
      }
      throw error;
    }
  }

  async completeIfOpen(
    userId: string,
    sessionId: string
  ): Promise<CompleteSessionResult> {
    return withSerializableRetry(async (tx) => {
      const session = await tx.workoutSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, completedAt: true },
      });
      if (!session) return { kind: "not_found" } as const;
      if (session.completedAt) return { kind: "already_completed" } as const;

      const updated = await tx.workoutSession.update({
        where: { id: sessionId },
        data: { completedAt: new Date() },
        include: sessionInclude,
      });
      return { kind: "completed", session: toSessionDetail(updated) } as const;
    });
  }
}
