import { prisma } from "../../../config/prisma-client.mts";

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
}
