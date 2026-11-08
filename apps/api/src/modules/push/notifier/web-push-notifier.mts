import * as webpush from "web-push";
import type { VapidConfig } from "../../../config/env.mts";
import { PushSubscriptionExpiredError } from "../errors.mts";
import type { PushSubscriptionRecord } from "../repository/subscription-repository.mts";

export type RestOverPayload = {
  title: string;
  body: string;
  url: string;
};

export const REST_OVER_PAYLOAD: RestOverPayload = {
  title: "Rest is over",
  body: "Time for your next set.",
  url: "/",
};

export type PushNotifier = {
  send(
    subscription: PushSubscriptionRecord,
    payload: RestOverPayload
  ): Promise<void>;
};

export function createWebPushNotifier(config: VapidConfig): PushNotifier {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  return {
    async send(subscription, payload): Promise<void> {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { urgency: "high", TTL: 60 }
        );
      } catch (error) {
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          throw new PushSubscriptionExpiredError();
        }
        throw error;
      }
    },
  };
}
