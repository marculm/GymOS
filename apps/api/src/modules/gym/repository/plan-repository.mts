import { Prisma } from "@prisma/client";
import type {
  CreateWorkoutPlanInput,
  UpdateWorkoutPlanInput,
  WorkoutPlan,
} from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";
import { DuplicatePlanNameError } from "../service/errors.mts";
import type { PlanSearchParams } from "../service/search-params.mts";
import { buildPlanWhere } from "./where-builder.mts";
import { planInclude, toPlan } from "./mapping.mts";

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function rethrowDuplicateName(error: unknown): never {
  if (isPrismaError(error, "P2002")) {
    throw new DuplicatePlanNameError("A plan with this name already exists");
  }
  throw error;
}

export class PlanRepository {
  async findByUser(
    userId: string,
    { skip, take }: { skip: number; take: number },
    filters: PlanSearchParams = {}
  ): Promise<WorkoutPlan[]> {
    const plans = await prisma.workoutPlan.findMany({
      where: buildPlanWhere(userId, filters),
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: planInclude,
    });
    return plans.map(toPlan);
  }

  async countByUser(userId: string, filters: PlanSearchParams = {}): Promise<number> {
    return prisma.workoutPlan.count({ where: buildPlanWhere(userId, filters) });
  }

  async findById(userId: string, planId: string): Promise<WorkoutPlan | null> {
    const plan = await prisma.workoutPlan.findFirst({
      where: { id: planId, userId },
      include: planInclude,
    });
    return plan ? toPlan(plan) : null;
  }

  async create(userId: string, input: CreateWorkoutPlanInput): Promise<WorkoutPlan> {
    try {
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
    } catch (error) {
      rethrowDuplicateName(error);
    }
  }

  async update(
    userId: string,
    planId: string,
    input: UpdateWorkoutPlanInput
  ): Promise<WorkoutPlan | null> {
    try {
      const plan = await prisma.workoutPlan.update({
        where: { id: planId, userId },
        data: {
          name: input.name,
          description: input.description ?? null,
          exercises: {
            deleteMany: {},
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
    } catch (error) {
      if (isPrismaError(error, "P2025")) {
        return null;
      }
      rethrowDuplicateName(error);
    }
  }

  async delete(userId: string, planId: string): Promise<boolean> {
    const { count } = await prisma.workoutPlan.deleteMany({
      where: { id: planId, userId },
    });
    return count > 0;
  }
}
