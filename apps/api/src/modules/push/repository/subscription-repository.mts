import type { CreatePushSubscriptionInput } from "@gymos/shared";
import { prisma } from "../../../config/prisma-client.mts";

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export class PushSubscriptionRepository {
  async upsert(
    userId: string,
    input: CreatePushSubscriptionInput
  ): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
  }

  async deleteByEndpoint(userId: string, endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }
}
