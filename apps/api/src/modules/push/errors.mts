export class PushNotConfiguredError extends Error {
  constructor() {
    super("Push notifications are not configured");
  }
}
