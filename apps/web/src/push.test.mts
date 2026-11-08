import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api/client.mts";
import {
  disablePush,
  enablePush,
  isPushSupported,
  syncRestTimer,
} from "./push.mts";

vi.mock("./api/client.mts", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const subscriptionJson = {
  endpoint: "https://push.example.com/one",
  keys: { p256dh: "p256dh-value", auth: "auth-value" },
};

function createRegistration(overrides: {
  existing?: boolean;
  permission?: NotificationPermission;
} = {}) {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const subscription = {
    endpoint: subscriptionJson.endpoint,
    toJSON: () => subscriptionJson,
    unsubscribe,
  };
  const getSubscription = vi
    .fn()
    .mockResolvedValue(overrides.existing ? subscription : null);
  const subscribe = vi.fn().mockResolvedValue(subscription);
  const registration = {
    pushManager: { getSubscription, subscribe },
  } as unknown as ServiceWorkerRegistration;
  const serviceWorker = {
    getRegistration: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  } as unknown as ServiceWorkerContainer;

  Object.defineProperty(navigator, "serviceWorker", {
    value: serviceWorker,
    configurable: true,
  });
  Object.defineProperty(window, "PushManager", {
    value: class PushManager {},
    configurable: true,
  });
  Object.defineProperty(window, "Notification", {
    value: {
      permission: overrides.permission ?? "granted",
      requestPermission: vi
        .fn()
        .mockResolvedValue(overrides.permission ?? "granted"),
    },
    configurable: true,
  });

  return { subscribe, getSubscription, unsubscribe };
}

describe("push client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports push as unsupported without PushManager", () => {
    Reflect.deleteProperty(window, "PushManager");

    expect(isPushSupported()).toBe(false);
  });

  it("subscribes and stores the subscription", async () => {
    const { subscribe } = createRegistration();
    vi.mocked(api.get).mockResolvedValue({ publicKey: "public-key" });
    vi.mocked(api.post).mockResolvedValue(undefined);

    expect(await enablePush()).toBe(true);

    expect(api.get).toHaveBeenCalledWith("/push/vapid-public-key");
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      })
    );
    expect(api.post).toHaveBeenCalledWith("/push/subscriptions", subscriptionJson);
  });

  it("does not subscribe when permission is denied", async () => {
    createRegistration({ permission: "denied" });

    expect(await enablePush()).toBe(false);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("removes the stored subscription when disabled", async () => {
    const { unsubscribe } = createRegistration({ existing: true });
    vi.mocked(api.delete).mockResolvedValue(undefined);

    await disablePush();

    expect(api.delete).toHaveBeenCalledWith(
      `/push/subscriptions?endpoint=${encodeURIComponent(subscriptionJson.endpoint)}`
    );
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("syncs the rest timer end and cancellation", async () => {
    createRegistration();
    vi.mocked(api.put).mockResolvedValue(undefined);
    vi.mocked(api.delete).mockResolvedValue(undefined);
    const endAt = Date.now() + 120_000;

    await syncRestTimer(endAt);
    await syncRestTimer(null);

    expect(api.put).toHaveBeenCalledWith("/push/rest-timer", {
      endAt: new Date(endAt).toISOString(),
    });
    expect(api.delete).toHaveBeenCalledWith("/push/rest-timer");
  });

  it("does not call the API when notifications are not granted", async () => {
    createRegistration({ permission: "denied" });

    await syncRestTimer(Date.now() + 120_000);

    expect(api.put).not.toHaveBeenCalled();
  });
});
