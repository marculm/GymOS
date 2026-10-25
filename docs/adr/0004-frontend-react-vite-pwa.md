# Frontend: React + Vite as PWA

## Status

Accepted

## Context

GymOS is primarily used on a phone in the gym. It needs to feel like a native app — installable on the home screen, fast to load, and usable with minimal friction. A Progressive Web App (PWA) achieves this without the overhead of native app stores.

## Decision

We will build the frontend with **React** and **Vite**, configured as a **PWA** (via `vite-plugin-pwa`).

- React for the UI component model.
- Vite for fast dev server and optimized production builds.
- PWA manifest + service worker for installability and offline support.

### Rules

1. Frontend code lives exclusively in `apps/web/`.
2. No server-side rendering — this is a client-side SPA.
3. No direct API calls outside of a dedicated `api/` or `hooks/` layer in the frontend.

## Consequences

- Users install GymOS from the browser to their home screen — no app store needed.
- Vite provides instant HMR during development.
- Service worker enables basic offline functionality (cached UI shell).
