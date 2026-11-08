import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("workbox-precaching", () => ({
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
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
