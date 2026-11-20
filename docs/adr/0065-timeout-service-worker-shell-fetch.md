# Timeout the Service Worker Shell Fetch

## Status

Accepted

## Context

The service worker serves navigations network-first (ADR-0054). `shellResponse()` fetches
`/index.html`, caches a successful response, and falls back to the cached shell only when
the fetch rejects. The install event prefetches the same URL with the same untimed fetch.
On a slow or flaky mobile network the fetch can hang until the browser timeout, so the
cached shell is not used and the PWA appears dead.

## Decision

- The shell fetch aborts after 3 seconds. A timed-out navigation falls through the
  existing failure path and returns the cached shell.
- A successful response still refreshes the cache.
- The install event reuses `shellResponse()`, so the prefetch has the same timeout and a
  failed prefetch is still ignored.
- The shell cache name and the navigation denylist are unchanged.

## Consequences

- A cached shell loads in about 3 seconds even when the network hangs.
- A navigation response slower than 3 seconds is abandoned and not cached; the next
  successful navigation refreshes the cache.
- A first visit with no cached shell has nothing to fall back to and still fails after the
  3-second timeout.
