import { prisma } from "../../../config/prisma-client.mts";

export type DueRestTimer = {
  id: string;
  userId: string;
  endAt: Date;
};

export class RestTimerRepository {
  async upsert(userId: string, endAt: Date): Promise<void> {
    await prisma.restTimer.upsert({
      where: { userId },
      create: { userId, endAt },
      update: { endAt },
    });
  }

  async deleteForUser(userId: string): Promise<void> {
    await prisma.restTimer.deleteMany({ where: { userId } });
  }

  async findDue(now: Date): Promise<DueRestTimer[]> {
    return prisma.restTimer.findMany({
      where: { endAt: { lte: now } },
      orderBy: { endAt: "asc" },
      select: { id: true, userId: true, endAt: true },
    });
  }

  async deleteById(id: string): Promise<void> {
    await prisma.restTimer.deleteMany({ where: { id } });
  }
}
