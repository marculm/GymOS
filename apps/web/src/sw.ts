/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

const SHELL_CACHE = "gymos-shell";
const SHELL_URL = "/index.html";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

export async function shellResponse(): Promise<Response> {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(SHELL_URL, { cache: "no-cache" });
    if (response.ok) {
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    throw new Error("App shell is not cached");
  }
}

registerRoute(
  new NavigationRoute(shellResponse, {
    denylist: [
      /^\/api(\/|$)/,
      /^\/health$/,
      /^\/sw\.js$/,
      /^\/manifest\.webmanifest$/,
    ],
  }),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(async (cache) => {
        const response = await fetch(SHELL_URL, { cache: "no-cache" });
        if (response.ok) await cache.put(SHELL_URL, response.clone());
      })
      .catch(() => undefined),
  );
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const DEFAULT_NOTIFICATION = {
  title: "Rest is over",
  body: "Time for your next set.",
  url: "/gym",
};

type NotificationPayload = typeof DEFAULT_NOTIFICATION;

function notificationPayload(event: PushEvent): NotificationPayload {
  if (!event.data) return DEFAULT_NOTIFICATION;

  try {
    const data = event.data.json() as Partial<NotificationPayload>;
    return {
      title: typeof data.title === "string" ? data.title : DEFAULT_NOTIFICATION.title,
      body: typeof data.body === "string" ? data.body : DEFAULT_NOTIFICATION.body,
      url: typeof data.url === "string" ? data.url : DEFAULT_NOTIFICATION.url,
    };
  } catch {
    return DEFAULT_NOTIFICATION;
  }
}

async function focusOrOpen(url: string): Promise<void> {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const existing = clients.find(
    (client) => new URL(client.url).origin === self.location.origin
  );
  if (existing) {
    await existing.focus();
    return;
  }
  await self.clients.openWindow(url);
}

self.addEventListener("push", (event) => {
  const payload = notificationPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | undefined;
  const url = typeof data?.url === "string" ? data.url : DEFAULT_NOTIFICATION.url;
  event.waitUntil(focusOrOpen(url));
});
