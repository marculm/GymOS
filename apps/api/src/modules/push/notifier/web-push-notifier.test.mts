import { beforeEach, describe, expect, it, vi } from "vitest";
import * as webpush from "web-push";
import { PushSubscriptionExpiredError } from "../errors.mts";
import type { PushSubscriptionRecord } from "../repository/subscription-repository.mts";
import {
  REST_OVER_PAYLOAD,
  createWebPushNotifier,
} from "./web-push-notifier.mts";

vi.mock("web-push", () => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
  WebPushError: class WebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number
    ) {
      super(message);
    }
  },
}));

const config = {
  publicKey: "public-key",
  privateKey: "private-key",
  subject: "mailto:test@gymos.app",
};

const subscription: PushSubscriptionRecord = {
  id: "subscription-1",
  userId: "user-1",
  endpoint: "https://push.example.com/one",
  p256dh: "p256dh-value",
  auth: "auth-value",
};

describe("createWebPushNotifier", () => {
  beforeEach(() => {
    vi.mocked(webpush.sendNotification).mockReset();
  });

  it("sets the VAPID details and sends the rest-over payload", async () => {
    vi.mocked(webpush.sendNotification).mockResolvedValue({
      statusCode: 201,
      body: "",
      headers: {},
    });

    const notifier = createWebPushNotifier(config);
    await notifier.send(subscription, REST_OVER_PAYLOAD);

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      config.subject,
      config.publicKey,
      config.privateKey
    );
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(REST_OVER_PAYLOAD),
      { urgency: "high", TTL: 60 }
    );
  });

  it.each([404, 410])(
    "maps a %i response to an expired subscription",
    async (statusCode) => {
      const error = new webpush.WebPushError(
        "gone",
        statusCode,
        {},
        "",
        subscription.endpoint
      );
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      const notifier = createWebPushNotifier(config);

      await expect(
        notifier.send(subscription, REST_OVER_PAYLOAD)
      ).rejects.toBeInstanceOf(PushSubscriptionExpiredError);
    }
  );

  it("rethrows other delivery failures", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue(
      new Error("push service unavailable")
    );

    const notifier = createWebPushNotifier(config);

    await expect(
      notifier.send(subscription, REST_OVER_PAYLOAD)
    ).rejects.toThrow("push service unavailable");
  });
});
