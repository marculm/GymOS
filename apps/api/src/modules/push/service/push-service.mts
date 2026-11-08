import type { CreatePushSubscriptionInput } from "@gymos/shared";
import { PushNotConfiguredError } from "../errors.mts";
import type { PushSubscriptionRepository } from "../repository/subscription-repository.mts";

export class PushService {
  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
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

  private ensureConfigured(): void {
    if (this.publicKey === null) throw new PushNotConfiguredError();
  }
}
