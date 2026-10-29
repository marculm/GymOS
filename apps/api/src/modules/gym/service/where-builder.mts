import type { Prisma } from "@prisma/client";
import type { PlanSearchParams, SessionSearchParams } from "./search-params.mts";

export function buildPlanWhere(
  userId: string,
  filters: PlanSearchParams = {}
): Prisma.WorkoutPlanWhereInput {
  return {
    userId,
    ...(filters.name
      ? { name: { contains: filters.name, mode: "insensitive" as const } }
      : {}),
  };
}

export function buildSessionWhere(
  userId: string,
  filters: SessionSearchParams = {}
): Prisma.WorkoutSessionWhereInput {
  const where: Prisma.WorkoutSessionWhereInput = {
    userId,
    completedAt: { not: null },
  };

  if (filters.planId) {
    where.planId = filters.planId;
  }

  if (filters.from || filters.to) {
    const startedAt: Prisma.DateTimeFilter = {};
    if (filters.from) startedAt.gte = filters.from;
    if (filters.to) startedAt.lte = filters.to;
    where.startedAt = startedAt;
  }

  return where;
}
