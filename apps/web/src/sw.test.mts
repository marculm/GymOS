import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const routing = vi.hoisted(() => ({
  navigation: vi.fn(),
  registerRoute: vi.fn(),
}));

vi.mock("workbox-precaching", () => ({
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
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

let installListener: WorkerListener;
let pushListener: WorkerListener;
let clickListener: WorkerListener;
let worker: typeof import("./sw.ts");

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
  Object.defineProperty(window, "skipWaiting", {
    value: vi.fn(),
    configurable: true,
  });

  const addEventListener = vi.spyOn(window, "addEventListener");
  worker = await import("./sw.ts");

  const listenerFor = (type: string) =>
    addEventListener.mock.calls.find(([name]) => name === type)?.[1] as
      | WorkerListener
      | undefined;

  installListener = listenerFor("install") ?? (() => {});
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("service worker", () => {
  it("serves the app shell for navigation requests", () => {
    expect(routing.navigation).toHaveBeenCalledWith(
      expect.any(Function),
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

  it("caches and returns the network shell", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const match = vi.fn();
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { open: vi.fn().mockResolvedValue({ put, match }) },
    });
    const response = new Response("shell", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(worker.shellResponse()).resolves.toBe(response);
    expect(put).toHaveBeenCalledWith("/index.html", expect.any(Response));
  });

  it("falls back to the cached shell when the network hangs", async () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const cached = new Response("cached", { status: 200 });
    const match = vi.fn().mockResolvedValue(cached);
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { open: vi.fn().mockResolvedValue({ put, match }) },
    });
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise<Response>(() => {});
      })
    );

    const response = worker.shellResponse();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(response).resolves.toBe(cached);
    expect(signal?.aborted).toBe(true);
    expect(put).not.toHaveBeenCalled();
  });

  it("caches the shell on install", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const match = vi.fn();
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { open: vi.fn().mockResolvedValue({ put, match }) },
    });
    const response = new Response("shell", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const waitUntil = vi.fn();

    installListener({ waitUntil });

    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBe(response);
    expect(put).toHaveBeenCalledWith("/index.html", expect.any(Response));
  });

  it("times out the install prefetch", async () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const match = vi
      .fn()
      .mockResolvedValue(new Response("cached", { status: 200 }));
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { open: vi.fn().mockResolvedValue({ put, match }) },
    });
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise<Response>(() => {});
      })
    );
    const waitUntil = vi.fn();

    installListener({ waitUntil });
    await vi.advanceTimersByTimeAsync(3_000);

    expect(signal?.aborted).toBe(true);
    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeInstanceOf(Response);
    expect(put).not.toHaveBeenCalled();
  });

  it("falls back to the cached shell when offline", async () => {
    const put = vi.fn();
    const cached = new Response("cached", { status: 200 });
    const match = vi.fn().mockResolvedValue(cached);
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: { open: vi.fn().mockResolvedValue({ put, match }) },
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(worker.shellResponse()).resolves.toBe(cached);
    expect(put).not.toHaveBeenCalled();
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
