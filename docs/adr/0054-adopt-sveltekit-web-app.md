# Adopt SvelteKit for the Web App

## Status

Accepted

## Context

`apps/web` is a Svelte 5 + Vite 6 client-side PWA served as static files from nginx,
with a separate Hono API and no SSR. ADR-0014 chose Vite over SvelteKit because the app
had a single view and no routing, SSR, or server-endpoint needs, and allowed revisiting
SvelteKit when file-based routing becomes necessary.

That condition is now met. Nutrition logging (#2) adds daily logging, recipes, and
mealprep; the AI extractor (#3) adds another work area. Navigation is tab state inside
`App.svelte`; extending it would hand-roll routing without URLs, deep links, or browser
history. Building these features before a migration would rebuild their navigation and
tests afterwards.

SvelteKit 3.2 requires Vite 8, `@sveltejs/vite-plugin-svelte` 7, and TypeScript 6. The
repository runs Vite 6, plugin-svelte 6, TypeScript 5, and Vitest 4. SvelteKit 2.70
supports that toolchain.

## Decision

- `apps/web` uses SvelteKit 2 with `@sveltejs/adapter-static` and
  `fallback: 'index.html'`, built as a client-rendered SPA (`ssr = false`).
- Top-level areas become routes: `/gym`, `/nutrition`, and `/extractor`; `/` redirects
  to `/gym`. The layout owns the header, content area, and tab bar. Gym's internal
  gallery tabs stay component state.
- The Hono API, `packages/shared`, database, styles, and PWA layer remain unchanged. The
  web app still makes no server-side requests of its own.
- The static nginx/Kubernetes deployment stays; only the build output directory and the
  immutable asset cache path change.
- The explicit service worker gains a `NavigationRoute` fallback to `index.html` so deep
  links work offline.
- SvelteKit 3 and the Vite 8/TypeScript 6/Vitest 5 toolchain upgrade are deferred to a
  separate ADR. This decision does not depend on them.

## Consequences

- ADR-0014 is superseded by this ADR.
- Nutrition and the Extractor can be added as route pages without changing the shell,
  and the browser gets real back/forward navigation and deep links.
- The migration touches the entry point, build config, PWA registration, tests, the
  Docker image, and the nginx config once. The feature components and the API client
  stay unchanged.
- There is no SSR or server-side data loading; data still comes from the Hono API, and
  the app stays online-only per ADR-0012.
- The app now depends on the SvelteKit release line. A later SvelteKit 3 upgrade is a
  dependency and toolchain task, not an application restructure.
- The service worker's SPA navigation fallback is new behavior and must not intercept
  `/api`, `/health`, the service worker, or the manifest.

## Considered Options

- **Vite + hand-rolled router.** Rejected: custom navigation code, no deep-link or
  back-button conventions, and it is the rebuild this decision avoids.
- **SvelteKit 3.** Deferred: it requires Vite 8, plugin-svelte 7, TypeScript 6, and
  Vitest 5. That repo-wide toolchain upgrade is not needed for routing.
- **SSR and server endpoints.** Rejected: the API is Hono, and the app is an
  online-only static PWA (ADR-0012).
