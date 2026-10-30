import type { WorkoutPlan } from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";
import { planInclude, toPlan } from "./mapping.mts";
import { withSerializableRetry } from "./transaction.mts";

export class RotationRepository {
  async findByUser(userId: string): Promise<WorkoutPlan[]> {
    const items = await prisma.workoutRotationItem.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: { plan: { include: planInclude } },
    });
    return items.map((item) => toPlan(item.plan));
  }

  async replace(userId: string, planIds: string[]): Promise<void> {
    await withSerializableRetry(async (tx) => {
      await tx.workoutRotationItem.deleteMany({ where: { userId } });
      if (planIds.length === 0) return;

      await tx.workoutRotationItem.createMany({
        data: planIds.map((planId, position) => ({ userId, planId, position })),
      });
    });
  }
}
