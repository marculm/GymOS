import type { WorkoutPlan } from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";
import { planInclude, toPlan } from "./mapping.mts";
import { withSerializableRetry } from "./transaction.mts";

export type ReplaceRotationResult =
  | { kind: "ok" }
  | { kind: "unknown_plans"; planIds: string[] };

export class RotationRepository {
  async findByUser(userId: string): Promise<WorkoutPlan[]> {
    const items = await prisma.workoutRotationItem.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: { plan: { include: planInclude } },
    });
    return items.map((item) => toPlan(item.plan));
  }

  async replace(
    userId: string,
    planIds: string[]
  ): Promise<ReplaceRotationResult> {
    return withSerializableRetry(async (tx) => {
      if (planIds.length > 0) {
        const owned = await tx.workoutPlan.findMany({
          where: { id: { in: planIds }, userId },
          select: { id: true },
        });
        const ownedIds = new Set(owned.map((plan) => plan.id));
        const missing = planIds.filter((id) => !ownedIds.has(id));
        if (missing.length > 0) {
          return { kind: "unknown_plans", planIds: missing } as const;
        }
      }

      await tx.workoutRotationItem.deleteMany({ where: { userId } });
      if (planIds.length > 0) {
        await tx.workoutRotationItem.createMany({
          data: planIds.map((planId, position) => ({
            userId,
            planId,
            position,
          })),
        });
      }
      return { kind: "ok" } as const;
    });
  }
}
