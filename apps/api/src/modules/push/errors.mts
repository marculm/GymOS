export class PushNotConfiguredError extends Error {
  constructor() {
    super("Push notifications are not configured");
  }
}

export class PushSubscriptionExpiredError extends Error {
  constructor() {
    super("Push subscription is gone");
  }
}
