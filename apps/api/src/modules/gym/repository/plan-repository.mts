import { Prisma } from "@prisma/client";
import type { CreateWorkoutPlanInput, WorkoutPlan } from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";
import { DuplicatePlanNameError } from "../service/errors.mts";
import type { PlanSearchParams } from "../service/search-params.mts";
import { buildPlanWhere } from "./where-builder.mts";
import { planInclude, toPlan } from "./mapping.mts";

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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new DuplicatePlanNameError("A plan with this name already exists");
      }
      throw error;
    }
  }
}
