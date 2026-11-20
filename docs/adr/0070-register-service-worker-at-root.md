# Register the Service Worker at the Root

## Status

Accepted

## Context

SvelteKit sets Vite's `base` to `./` for the client build because relative asset
paths are enabled. `vite-plugin-pwa` derives the generated registration script URL and
scope from Vite's base, so the client bundle registers `./sw.js` with scope `./`.

A browser resolves those URLs against the current document. On a first visit to a
nested route such as `/nutrition/recipes`, registration requests
`/nutrition/sw.js` with scope `/nutrition/`. nginx answers with the SPA fallback,
which is not JavaScript, so registration fails. The worker is emitted at `/sw.js`,
and the app only becomes installable and offline-capable after a top-level reload.

## Decision

- Set the plugin's `base` and `scope` to `/`, overriding SvelteKit's relative Vite
  base for the PWA output only. The registration is always `/sw.js` with scope `/`.
- The build check scans the immutable client chunks and fails unless it finds a root
  registration.

## Consequences

- A first visit to any route registers the worker at the origin root.
- SvelteKit's relative asset paths are unchanged because the plugin options affect
  only the PWA registration and manifest output.
- A deployment under a sub-path must set `base` and `scope` to that path instead.
- The build check catches a regression to a relative registration before release.
