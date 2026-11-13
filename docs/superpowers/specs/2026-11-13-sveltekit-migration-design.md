# SvelteKit Migration for the Web App

**Date:** 2026-11-13
**Status:** Draft for review
**ADRs:** ADR-0054 (supersedes ADR-0014)

## Context

`apps/web` is a Svelte 5 single-page app built with Vite 6. `src/main.mts` mounts
`src/App.svelte`, which owns the header, a tab switch in component state, and a
`sessionActive` flag that hides the tab bar during a workout. The app is a static build
served by nginx in Kubernetes; the Hono API is a separate service under `/api`. The PWA
layer is `vite-plugin-pwa` with a custom service worker (`src/sw.ts`) and auto-update
registration. There is no router and no SSR (ADR-0014; ADR-0012 keeps data
online-only).

ADR-0014 allowed revisiting SvelteKit when the app needs file-based routing. The next
feature slices do: nutrition logging (#2) adds daily logging, recipes, and mealprep; the
AI extractor (#3) adds another work area. Modelling these as more branches inside
`App.svelte` would grow a hand-rolled router and lose deep links and the browser back
button. Building them before this migration would mean rebuilding their navigation and
tests afterwards.

The goal is to migrate the web app to SvelteKit as a static SPA now, so Nutrition and
the Extractor become routes without another structural change.

## Goals

- One route per top-level area: `/gym`, `/nutrition`, `/extractor`.
- The layout owns the header, main content, and tab bar; pages own feature content.
- Keep the feature components, API client, `packages/shared`, styles, and PWA behavior.
- Keep the static nginx/Kubernetes deployment and the separate Hono API.
- Keep the current component test toolchain and the existing component tests.
- No SSR, no server endpoints, and no server-side data loading in the web app.

## Non-goals

- Visual redesign or theme changes; the design pass is a separate step.
- Moving Gym's inner gallery tabs (Exercises/Plans/Workouts) or history to routes.
- Offline mutations, background sync, or authentication.
- Changes to the API, database, or shared contracts.
- Upgrading to SvelteKit 3, Vite 8, TypeScript 6, or Vitest 5.
- Replacing `vite-plugin-pwa` or rewriting the service worker beyond the SPA navigation
  fallback.

## Toolchain

- Add `@sveltejs/kit@^2.70.4` and `@sveltejs/adapter-static@^3.0.11` to `apps/web`.
- Stay on Vite 6, `@sveltejs/vite-plugin-svelte` 6, TypeScript 5, and Vitest 4.
  SvelteKit 2 supports them.
- SvelteKit 3 requires Vite 8, `@sveltejs/vite-plugin-svelte` 7, and TypeScript 6. That
  toolchain upgrade is a separate decision and ADR.
- Add `svelte.config.js` with `vitePreprocess()` and
  `adapter-static({ fallback: 'index.html' })`.
- `src/routes/+layout.ts` sets `export const ssr = false`. The build is a
  client-rendered SPA; every route uses the static fallback shell.
- `src/app.html` replaces `index.html` and keeps the viewport, theme-color, and Apple
  touch icon tags.
- `vite.config.ts` uses `sveltekit()` instead of the bare `svelte()` plugin. `VitePWA`
  stays in the plugin list, and the `/api` and `/health` dev proxies stay.
- The custom `resolve.conditions: ["browser"]` is removed; SvelteKit configures the
  client resolution conditions. The build must still resolve `@gymos/shared/labels`
  and exclude Zod (ADR-0048).

## Routes and Shell

```
src/routes/+layout.svelte       header, <main>, tab bar, global styles
src/routes/+layout.ts           ssr = false
src/routes/+page.ts             redirect to /gym
src/routes/gym/+page.svelte     GymView
src/routes/nutrition/+page.svelte
src/routes/extractor/+page.svelte
src/lib/shell-state.svelte.ts   sessionActive context
```

- The layout renders the existing header (`🏋️ GymOS`, subtitle) and the tab bar. Tabs are
  links (`<a href>`), not buttons: `/gym`, `/nutrition`, `/extractor`, each with its
  lucide icon. The active tab uses `aria-current="page"` and the existing `tab-active`
  class; it is derived from `page.url.pathname` (`$app/state`).
- `/gym` is the start route. `/` redirects to `/gym` with `redirect(307, '/gym')` in
  `+page.ts`. The manifest `start_url` becomes `/gym`, and the service worker's default
  notification URL becomes `/gym`.
- `GymView` keeps its `onSessionActiveChange` prop. `/gym/+page.svelte` reads the shell
  context and sets `sessionActive`; the layout hides the tab bar while a session is
  active, as today.
- The session remains server-side. Navigating away from `/gym` while a session is
  active hides the tab bar (as today), but the browser back button can still leave the
  page. Returning to `/gym` recovers the active session through `getActiveSession`, as
  a reload already does after #87.
- The Nutrition and Extractor placeholder cards move verbatim from `App.svelte` into
  their route files.
- `main.mts` and `App.svelte` are deleted; `styles.css` is imported once by the layout.

## PWA

- Keep `vite-plugin-pwa` with `injectManifest`, `srcDir: 'src'`, `filename: 'sw.ts'`,
  `registerType: 'autoUpdate'`, and the existing precache globs.
- Set `injectRegister: null`; register the worker explicitly in the layout with
  `registerSW({ immediate: true })` from `virtual:pwa-register` inside `onMount`.
- Add `workbox-routing` to the web dev dependencies. `src/sw.ts` registers a
  `NavigationRoute` backed by `createHandlerBoundToURL('/index.html')`, with a denylist
  for `/api/`, `/health`, `/sw.js`, and `/manifest.webmanifest`. This keeps deep links
  such as `/nutrition` working offline; `precacheAndRoute` alone only maps `/`.
- Manifest: add `start_url: '/gym'` and `scope: '/'`; keep icons, colors, display, and
  copy. `src/vite-env.d.ts` adds the `vite-plugin-pwa/client` types.

## Styling

`styles.css` and all component-scoped styles stay unchanged. The layout imports the
global stylesheet once. No CSS framework and no theme change; the design pass comes
after this migration.

## Testing

- The root Vitest project config stays; `apps/web/vite.config.ts` keeps its `test`
  block. `sveltekit()` runs in the test pipeline.
- Existing component tests (`GymView`, `SessionView`, `History`, and the forms) keep
  importing components directly and stay unchanged.
- `App.test.mts` is replaced by route-level tests: the layout renders three navigation
  links with the correct `href` and `aria-current`; `/nutrition` and `/extractor` render
  their placeholder cards; `/gym` renders `GymView` with the mocked API. Mock
  `$app/state` and `virtual:pwa-register` where needed.
- Add `svelte-kit sync` before `svelte-check` and Vitest (`typecheck` and `test`
  scripts) so `.svelte-kit/` exists in CI.
- `tsconfig.json` extends `.svelte-kit/tsconfig.json`; the root strictness stays.

## Deployment

- `apps/web/Dockerfile` copies `apps/web/build` instead of `apps/web/dist` into nginx.
- `apps/web/nginx.conf` caches `/_app/immutable/` immutably (SvelteKit's hashed asset
  directory) instead of `/assets/`; the SPA fallback and the no-cache rules for
  `index.html`, `sw.js`, and `manifest.webmanifest` stay.
- `deploy/k8s/*` and the ingress do not change. The image build, tag, and rollout flow
  stays.
- `docs/architecture.md` is updated: its "No server-side rendering, no SvelteKit"
  statement and the frontend structure section describe the SvelteKit routes, layout,
  and manual PWA registration.

## Migration Order

1. Add SvelteKit and the static adapter, `svelte.config.js`, `app.html`, `+layout.ts`,
   and the layout shell alongside the current entry. Verify `vite build` produces
   `build/index.html` and hashed assets.
2. Verify the PWA integration early: build, serve, confirm `sw.js` is emitted,
   registration works, and the app loads offline. This is the riskiest part.
3. Move the header and tab bar into the layout, create the three route pages, add the
   `/` redirect, and wire the shell context. Delete `App.svelte`, `App.test.mts`,
   `main.mts`, and `index.html`.
4. Add the service-worker navigation fallback and the manifest changes.
5. Update tests, tsconfig, scripts, Dockerfile, and nginx.
6. Run `bun run typecheck`, `bun run lint:all`, `bun run test`, and `bun run build`;
   then do a manual PWA smoke test against a preview build.

## Acceptance Criteria

- `/gym`, `/nutrition`, and `/extractor` render, including direct URL loads and browser
  back/forward.
- Tab links change the route without a full page reload; the active tab reflects the
  URL.
- The tab bar hides during an active session; leaving and returning to `/gym` recovers
  the session.
- The PWA manifest is served with `start_url: /gym`, the service worker registers and
  updates, and the shell loads offline for all three routes.
- `bun run typecheck`, `bun run lint:all`, `bun run test`, and `bun run build` pass.
- The built web bundle still excludes Zod (ADR-0048).
- No API, database, or shared-contract changes.

## Risks

- **PWA build integration.** `vite-plugin-pwa` with SvelteKit's build output and manual
  registration is the highest-risk part. Step 2 verifies it before the rest of the
  migration.
- **SvelteKit 2 versus 3.** Staying on Kit 2 avoids a repo-wide toolchain upgrade now.
  The Kit 3 upgrade is deferred and will touch Vite, TypeScript, and Vitest, but it does
  not require route or component restructuring.
- **Test environment.** SvelteKit modules (`$app/state`) need mocks in happy-dom. Keep
  tests at the layout and route level rather than asserting router internals.
- **Offline deep links.** Without the navigation fallback, only `/` works offline. The
  fallback route and its denylist are required and are covered by the manual smoke
  test.
- **Resolution conditions.** The custom `resolve.conditions: ["browser"]` is removed;
  the build must be checked for the ADR-0048 Zod-free property.
