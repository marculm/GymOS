# Shared Schemas Package

## Status

Accepted

## Context

Both the API and the web frontend need to agree on data shapes — workout plans, recipes, macros, etc. Duplicating types leads to drift and bugs. We need a single source of truth for data contracts.

## Decision

All shared types and Zod schemas live in `packages/shared`.

Structure:

```
packages/shared/src/
  schemas/
    recipe.ts       # Recipe & macro schemas
    workout.ts      # Exercise, set, training plan schemas
    nutrition.ts    # Mealprep & calorie tracking schemas
  index.ts          # Barrel export
```

### Rules

1. `packages/shared` must have **zero dependencies on `apps/*`** — it is a leaf package.
2. Shared schemas are the **only** way to define data contracts between frontend and backend.
3. No duplicated type definitions — if a type is used in both `apps/api` and `apps/web`, it belongs in `packages/shared`.

## Consequences

- Single source of truth for all data shapes.
- Zod schemas provide both TypeScript types (`z.infer<>`) and runtime validation.
- Adding a new data model = adding a schema file in `packages/shared`, immediately available everywhere.
