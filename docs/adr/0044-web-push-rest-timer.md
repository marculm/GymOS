# Web Push When the Rest Timer Ends

## Status

Accepted

## Context

The rest timer from ADR-0036 is a client-side countdown. It is missed when the user
switches to another app: on iOS the installed PWA is suspended in the background, so
timers, sounds, and local notifications do not fire. Web Push is the only notification
path that works while the app is not open.

Web Push needs a service worker, a push subscription, and a server that sends the message
at the right time. GymOS is a single-user API (ADR-0009) with one API replica, and the
frontend is an installable PWA (ADR-0014). Push is an optional enhancement: users who do
not grant permission, use an unsupported browser, or have not installed the app must keep
the in-app timer (ADR-0036).

iOS 16.4+ requires the PWA to be installed to the Home Screen and served over HTTPS.
Push delivery can be delayed by a few seconds by the browser's push service.

## Decision

- The PWA uses `vite-plugin-pwa` with the `injectManifest` strategy and a custom
  service worker (`apps/web/src/sw.ts`). It precaches the app shell and handles `push`
  and `notificationclick`: the notification says the rest is over, and a click focuses an
  open GymOS window or opens the app.
- A bell toggle in the session bar asks for notification permission from the user
  gesture. When permission is granted, the client fetches the VAPID public key from
  `GET /api/push/vapid-public-key`, subscribes through `PushManager` with
  `userVisibleOnly`, and stores the subscription with
  `POST /api/push/subscriptions`. Turning the toggle off unsubscribes and removes the
  stored subscription.
- The session view keeps the rest timer as the fallback. When a timer starts, it sends its
  end timestamp to `PUT /api/push/rest-timer`; when the user stops it or finishes the
  workout, it cancels with `DELETE /api/push/rest-timer`. Reaching zero locally does not
  cancel the server timer, so a backgrounded or suspended app still receives the push.
  Sync failures are ignored; the in-app countdown keeps working.
- The API stores push subscriptions (`push_subscriptions`) and at most one pending rest
  timer per user (`rest_timers`, unique `userId`). A scheduler in the API process polls
  due timers about once per second and sends the `Rest is over` notification to every
  subscription of that user. Sent timers are deleted; a subscription the push service
  reports as gone (404/410) is removed. A failed send is logged and the timer is deleted
  so it is not retried every tick.
- VAPID configuration comes from `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
  `VAPID_SUBJECT`. When the key pair is missing, push stays disabled: the public-key and
  subscription endpoints return `503`, the scheduler is not started, and the client keeps
  the in-app timer. The private key is only read from environment/secret configuration.
- Push endpoints live under `/api/push`, use the current-user middleware, append-only Zod
  contracts from `packages/shared`, and the existing problem-details error model
  (ADR-0015). `POST` and `PUT` keep the JSON content-type guard.
- Tests cover the scheduler, the push service, and the HTTP endpoints. The deployment
  documentation documents the VAPID setup and a manual push test.

## Consequences

- A user who grants permission receives a notification when rest ends while the app is in
  the background; clicking it returns to the app.
- Push works only over HTTPS and, on iOS, only after installing the PWA to the Home
  Screen (iOS 16.4+). Delivery can be a few seconds late. Without permission or support,
  the in-app timer remains unchanged.
- The API gains two tables, a migration, four write endpoints, one read endpoint, and an
  in-process scheduler. Because the scheduler runs in the API process, sending assumes a
  single replica; multiple replicas would need a database claim or a queue.
- VAPID keys must be added to the deployment configuration. The private key is a secret;
  the public key and subject are not. No keys are committed.
- The rest timer is still client-owned: the server only stores the end timestamp and does
  not enforce workout state.
