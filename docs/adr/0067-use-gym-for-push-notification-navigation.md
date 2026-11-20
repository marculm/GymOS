# Use /gym for Push Notification Navigation

## Status

Accepted

## Context

The API sent `url: "/"` in the rest-over web push payload, while the PWA start route is
`/gym` (the service worker default in `apps/web/src/sw.ts`) and `/` only redirects to
`/gym` (ADR-0054). A notification click therefore relied on the SPA redirect before
showing the Gym route.

## Decision

- `REST_OVER_PAYLOAD` in `apps/api/src/modules/push/notifier/web-push-notifier.mts` uses
  `url: "/gym"`.
- The service worker keeps using the payload URL unchanged, so a click opens `/gym`
  directly. Deep links to a running session stay out of scope.
- Tests assert the payload URL and that a click with that payload opens `/gym`.

## Consequences

- A notification click opens the Gym route without the redirect hop.
- A future notification type must send its own URL, because the payload URL always wins
  over the service worker default.
