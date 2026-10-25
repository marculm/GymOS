# Monorepo Structure with Workspaces

## Status

Accepted

## Context

GymOS consists of multiple deployable units (API server, web frontend) and shared code (types, schemas). We need a project structure that allows code sharing without publishing packages, while keeping clear boundaries between components.

## Decision

We will use a **monorepo** with the following workspace layout:

```
apps/
  api/          # Backend service (Hono API server)
  web/          # Frontend app (React + Vite PWA)
packages/
  shared/       # Shared types, Zod schemas, constants
```

Managed via **Bun workspaces** (defined in `package.json`).

### Rules

1. `apps/web` may import from `packages/shared` — never from `apps/api`.
2. `apps/api` may import from `packages/shared` — never from `apps/web`.
3. `packages/shared` must not import from any `apps/*` package.
4. Each workspace has its own `package.json` and `tsconfig.json`.

## Consequences

- Shared code changes are immediately available to all apps (no publish step).
- Build and deploy pipelines can target individual workspaces.
- Import boundaries prevent accidental coupling between apps.
