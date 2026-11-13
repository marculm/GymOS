import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandlerBoundToURL } from "workbox-precaching";

const routing = vi.hoisted(() => ({
  handler: vi.fn(),
  navigation: vi.fn(),
  registerRoute: vi.fn(),
}));

vi.mock("workbox-precaching", () => ({
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
  createHandlerBoundToURL: vi.fn(() => routing.handler),
}));

vi.mock("workbox-routing", () => ({
  NavigationRoute: class {
    constructor(handler: unknown, options: unknown) {
      routing.navigation(handler, options);
    }
  },
  registerRoute: routing.registerRoute,
}));

type WorkerListener = (event: unknown) => void;

const showNotification = vi.fn().mockResolvedValue(undefined);
const focus = vi.fn().mockResolvedValue(undefined);
const openWindow = vi.fn().mockResolvedValue(undefined);
const matchAll = vi.fn();
const close = vi.fn();

let pushListener: WorkerListener;
let clickListener: WorkerListener;

beforeAll(async () => {
  Object.defineProperty(window, "__WB_MANIFEST", {
    value: [],
    configurable: true,
  });
  Object.defineProperty(window, "registration", {
    value: { showNotification },
    configurable: true,
  });
  Object.defineProperty(window, "clients", {
    value: { matchAll, openWindow },
    configurable: true,
  });

  const addEventListener = vi.spyOn(window, "addEventListener");
  await import("./sw.ts");

  const listenerFor = (type: string) =>
    addEventListener.mock.calls.find(([name]) => name === type)?.[1] as
      | WorkerListener
      | undefined;

  pushListener = listenerFor("push") ?? (() => {});
  clickListener = listenerFor("notificationclick") ?? (() => {});
});

beforeEach(() => {
  showNotification.mockClear();
  focus.mockClear();
  openWindow.mockClear();
  matchAll.mockReset();
  close.mockClear();
});

describe("service worker", () => {
  it("serves the app shell for navigation requests", () => {
    expect(createHandlerBoundToURL).toHaveBeenCalledWith("/index.html");
    expect(routing.navigation).toHaveBeenCalledWith(
      routing.handler,
      expect.objectContaining({
        denylist: [
          /^\/api(\/|$)/,
          /^\/health$/,
          /^\/sw\.js$/,
          /^\/manifest\.webmanifest$/,
        ],
      }),
    );
    expect(routing.registerRoute).toHaveBeenCalled();
  });

  it("uses the Gym route for the default notification", () => {
    pushListener({ data: null, waitUntil: vi.fn() });

    expect(showNotification).toHaveBeenCalledWith(
      "Rest is over",
      expect.objectContaining({ data: { url: "/gym" } }),
    );
  });

  it("shows a notification from the push payload", () => {
    const waitUntil = vi.fn();

    pushListener({
      data: {
        json: () => ({
          title: "Rest is over",
          body: "Time for your next set.",
          url: "/",
        }),
      },
      waitUntil,
    });

    expect(showNotification).toHaveBeenCalledWith(
      "Rest is over",
      expect.objectContaining({
        body: "Time for your next set.",
        data: { url: "/" },
      })
    );
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it("falls back to the default notification when the payload is not JSON", () => {
    pushListener({
      data: {
        json: () => {
          throw new Error("not JSON");
        },
      },
      waitUntil: vi.fn(),
    });

    expect(showNotification).toHaveBeenCalledWith(
      "Rest is over",
      expect.objectContaining({ body: "Time for your next set." })
    );
  });

  it("focuses an open GymOS window on click", async () => {
    matchAll.mockResolvedValue([
      { url: `${window.location.origin}/session`, focus },
    ]);
    const waitUntil = vi.fn();

    clickListener({
      notification: { close, data: { url: "/" } },
      waitUntil,
    });
    await waitUntil.mock.calls[0]?.[0];

    expect(close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens the app when no window is open", async () => {
    matchAll.mockResolvedValue([]);
    const waitUntil = vi.fn();

    clickListener({
      notification: { close, data: { url: "/" } },
      waitUntil,
    });
    await waitUntil.mock.calls[0]?.[0];

    expect(openWindow).toHaveBeenCalledWith("/");
  });
});
