# Modular Feature Architecture in the API

## Status

Accepted

## Context

The API has three distinct feature areas: gym tracking, nutrition/mealprep, and the AI TikTok/Reels extractor. These features have different concerns and should be independently developable without creating a tangled dependency graph.

## Decision

The API backend organizes business logic into **feature modules**:

```
apps/api/src/modules/
  extractor/    # TikTok/Reels AI recipe extraction
  gym/          # Exercises, sets, training plans
  nutrition/    # Mealprep, calories, recipes
```

Each module is self-contained and exposes its functionality through a clear entry point (e.g., `index.ts` with route definitions).

### Rules

1. **No cross-module imports.** `modules/gym` must not import from `modules/nutrition` or `modules/extractor`, and vice versa.
2. Shared logic between modules goes into `apps/api/src/lib/` or `packages/shared`.
3. Each module owns its own route definitions, service layer, and repository layer.
4. Database access is only allowed through Prisma — no raw SQL queries.

## Consequences

- Features can be developed, tested, and refactored independently.
- Clear ownership boundaries make it easy to find where code lives.
- If a module grows too large, it can be extracted into its own service with minimal refactoring.
