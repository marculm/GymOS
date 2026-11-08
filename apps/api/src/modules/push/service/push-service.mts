import type { CreatePushSubscriptionInput } from "@gymos/shared";
import { PushNotConfiguredError } from "../errors.mts";
import type { RestTimerRepository } from "../repository/rest-timer-repository.mts";
import type { PushSubscriptionRepository } from "../repository/subscription-repository.mts";

export class PushService {
  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly restTimers: RestTimerRepository,
    private readonly publicKey: string | null
  ) {}

  isConfigured(): boolean {
    return this.publicKey !== null;
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

  private ensureConfigured(): void {
    if (this.publicKey === null) throw new PushNotConfiguredError();
  }
}
