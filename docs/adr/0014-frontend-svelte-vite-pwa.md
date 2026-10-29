# Frontend: Svelte 5 + Vite PWA

## Status

Accepted

## Context

ADR-0004 chose React + Vite as the PWA frontend. The owner wants Svelte instead. GymOS
is a mobile-first, installable PWA with a single main view, a client-side SPA, plain
CSS, and online-only data (ADR-0012). It does not need server-side rendering, file-based
routing, or server endpoints.

SvelteKit was considered. It adds a routing layer, an SSR runtime, and server endpoints
that this app does not use. A static Svelte 5 build with Vite keeps the existing PWA
setup (`vite-plugin-pwa`), the same static deployment, and the same `src/api/` boundary.

## Decision

The frontend uses **Svelte 5** with **Vite**:

- `svelte` and `@sveltejs/vite-plugin-svelte` with `vitePreprocess()`.
- `vite-plugin-pwa` remains the PWA layer; manifest, icons, and `registerType:
  "autoUpdate"` are unchanged.
- Components are `.svelte` files. Plain TypeScript modules use `.mts`.
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) and event attributes
  (`onclick`, `onsubmit`) are used throughout.
- `lucide-svelte` replaces `lucide-react` for icons.
- `@testing-library/svelte`, Vitest, and happy-dom replace the React testing stack.
- The `src/api/` layer stays framework-agnostic; components never call `fetch` directly.
- `svelte-check` is the web typecheck gate. The root typecheck script runs the API,
  shared, and web typechecks separately because `bun check` cannot resolve `.svelte`
  imports.
- There is no SSR and no SvelteKit. The app remains a client-side SPA, consistent with
  ADR-0004's original constraint.

React, `react-dom`, the React type packages, `@vitejs/plugin-react`,
`@testing-library/react`, and `lucide-react` are removed.

## Consequences

- ADR-0004 is superseded by this ADR.
- Existing components (`App`, `GymView`, `PlanForm`, `SessionView`) are rewritten as
  Svelte components. The target structure is described in
  [`docs/architecture.md`](../architecture.md).
- The Vite build, PWA manifest, service worker, and static deployment stay the same.
- The frontend no longer needs the `jsx` compiler option in the root `tsconfig.json`.
- SvelteKit can be revisited only if the app needs SSR, file-based routing, or server
  endpoints; that would require a new ADR.
