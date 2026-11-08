import type { CreatePushSubscriptionInput } from "@gymos/shared";
import { getLogger } from "../../../logger/logger.mts";
import {
  PushNotConfiguredError,
  PushSubscriptionExpiredError,
} from "../errors.mts";
import {
  REST_OVER_PAYLOAD,
  type PushNotifier,
} from "../notifier/web-push-notifier.mts";
import type { RestTimerRepository } from "../repository/rest-timer-repository.mts";
import type { PushSubscriptionRepository } from "../repository/subscription-repository.mts";

type SubscriptionStore = Pick<
  PushSubscriptionRepository,
  "upsert" | "deleteByEndpoint" | "findByUserId" | "deleteById"
>;
type RestTimerStore = Pick<RestTimerRepository, "upsert" | "deleteForUser">;

const logger = getLogger("PushService");

export class PushService {
  constructor(
    private readonly subscriptions: SubscriptionStore,
    private readonly restTimers: RestTimerStore,
    private readonly notifier: PushNotifier | null,
    private readonly publicKey: string | null
  ) {}

  isConfigured(): boolean {
    return this.notifier !== null && this.publicKey !== null;
  }

  getPublicKey(): string {
    if (this.publicKey === null) throw new PushNotConfiguredError();
    return this.publicKey;
  }

  async subscribe(
    userId: string,
    input: CreatePushSubscriptionInput
  ): Promise<void> {
    this.ensureConfigured();
    await this.subscriptions.upsert(userId, input);
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    this.ensureConfigured();
    await this.subscriptions.deleteByEndpoint(userId, endpoint);
  }

  async setRestTimer(userId: string, endAt: Date): Promise<void> {
    this.ensureConfigured();
    await this.restTimers.upsert(userId, endAt);
  }

  async cancelRestTimer(userId: string): Promise<void> {
    this.ensureConfigured();
    await this.restTimers.deleteForUser(userId);
  }

  async sendRestOver(userId: string): Promise<void> {
    if (this.notifier === null) return;

    const subscriptions = await this.subscriptions.findByUserId(userId);
    for (const subscription of subscriptions) {
      try {
        await this.notifier.send(subscription, REST_OVER_PAYLOAD);
      } catch (error) {
        if (error instanceof PushSubscriptionExpiredError) {
          await this.subscriptions.deleteById(subscription.id);
        } else {
          logger.warn(
            { err: error, subscriptionId: subscription.id },
            "Push notification failed"
          );
        }
      }
    }
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) throw new PushNotConfiguredError();
  }
}
