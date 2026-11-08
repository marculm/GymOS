import { describe, expect, it, vi } from "vitest";
import { PushSubscriptionExpiredError } from "../errors.mts";
import type { PushSubscriptionRecord } from "../repository/subscription-repository.mts";
import { PushService } from "./push-service.mts";
import { REST_OVER_PAYLOAD } from "../notifier/web-push-notifier.mts";
import type { PushNotifier } from "../notifier/web-push-notifier.mts";

const first: PushSubscriptionRecord = {
  id: "subscription-1",
  userId: "user-1",
  endpoint: "https://push.example.com/one",
  p256dh: "p256dh-1",
  auth: "auth-1",
};

const second: PushSubscriptionRecord = {
  ...first,
  id: "subscription-2",
  endpoint: "https://push.example.com/two",
};

function createService(notifier: PushNotifier) {
  const subscriptions = {
    upsert: vi.fn(),
    deleteByEndpoint: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue([first, second]),
    deleteById: vi.fn().mockResolvedValue(undefined),
  };
  const restTimers = {
    upsert: vi.fn(),
    deleteForUser: vi.fn(),
  };

  return {
    service: new PushService(subscriptions, restTimers, notifier, "public-key"),
    subscriptions,
  };
}

describe("PushService", () => {
  it("sends the rest-over notification to every subscription", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { service } = createService({ send });

    await service.sendRestOver("user-1");

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, first, REST_OVER_PAYLOAD);
    expect(send).toHaveBeenNthCalledWith(2, second, REST_OVER_PAYLOAD);
  });

  it("removes a subscription the push service reports as gone", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new PushSubscriptionExpiredError())
      .mockResolvedValueOnce(undefined);
    const { service, subscriptions } = createService({ send });

    await service.sendRestOver("user-1");

    expect(subscriptions.deleteById).toHaveBeenCalledExactlyOnceWith(first.id);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keeps sending when one delivery fails", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("push service unavailable"))
      .mockResolvedValueOnce(undefined);
    const { service, subscriptions } = createService({ send });

    await service.sendRestOver("user-1");

    expect(send).toHaveBeenCalledTimes(2);
    expect(subscriptions.deleteById).not.toHaveBeenCalled();
  });
});
