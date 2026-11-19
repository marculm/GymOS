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
- The Hono API, `packages/shared`, database, styles, and PWA manifest remain unchanged.
  The web app still makes no server-side requests of its own; the PWA registration and
  service worker change as described below.
- The static nginx/Kubernetes deployment stays; only the build output directory and the
  immutable asset cache path change.
- The explicit service worker gains a network-first `NavigationRoute` shell handler that
  caches `/index.html` and serves that cache offline; the install event primes it.
- SvelteKit 3 and the Vite 8/TypeScript 6 toolchain upgrade were deferred at first;
  they landed on 2026-11-19 (see the update below).

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
- The service worker's navigation shell handler is new behavior and must not intercept
  `/api`, `/health`, the service worker, or the manifest.

## Update 2026-11-19: SvelteKit 3

The 2026-11-19 `bun audit` run reported four SvelteKit advisories and one
`cookie` advisory. The high one is a form-data DoS in the experimental remote
functions feature, which this app does not enable, and production serves the
static `adapter-static` build from nginx. The fixes exist only in SvelteKit
3.1.1 and later, so the deferred toolchain upgrade is now required.

The upgrade uses SvelteKit 3.4.x, `@sveltejs/adapter-static` 4.x, Vite 8.x,
TypeScript 6.x, `@sveltejs/vite-plugin-svelte` 7.x, and `vite-plugin-pwa` 2.x.
The former `svelte.config.js` moves into the `sveltekit()` plugin in
`vite.config.ts`; `$lib` imports become `#lib` subpath imports; the custom
`$api` and `$features` aliases become relative imports;
`goto(..., { replaceState: true })` becomes `{ replace: true }`; and
`preloadData` handles its non-loaded results. The PWA plugin's `outDir` and
`injectManifest.globDirectory` point at `.svelte-kit/output/client`, so the
service worker lands in the adapter-static output with a populated precache
manifest. The dev-only `glob` and `minimatch` versions used by
`workbox-build` are overridden to their patched releases; the PWA build
verifies the override.

Consequences: `bun audit --audit-level=high` passes, and the full audit is clean
once the Hono patch lands. SvelteKit 3 no longer runs `transformIndexHtml`, so
the PWA plugin logs a `transform_index_html_unsupported` warning at build time;
the app already links the manifest and registers the service worker itself, so
the warning is accepted. The `glob`/`minimatch` override is a build-tooling
exception to remove when `workbox-build` catches up.

## Considered Options

- **Vite + hand-rolled router.** Rejected: custom navigation code, no deep-link or
  back-button conventions, and it is the rebuild this decision avoids.
- **SvelteKit 3.** Deferred: it requires Vite 8, plugin-svelte 7, TypeScript 6, and
  Vitest 5. That repo-wide toolchain upgrade is not needed for routing.
- **SSR and server endpoints.** Rejected: the API is Hono, and the app is an
  online-only static PWA (ADR-0012).
