# Workout Set Reps and Weight Limits

## Status

Accepted

## Context

`CreateWorkoutSetSchema` accepted any positive integer for `reps` and any
non-negative number for `weightKg`. Values above Prisma's 32-bit `Int` range made the
insert fail and the API returned `500`. Unrealistic weights were also stored without
an error. ADR-0017 bounded plan targets but left logged set limits open, tracked as
known issue 5 in `docs/known-issues.md`.

## Decision

The shared workout contract bounds logged sets:

- `reps` is an integer from 1 to 1000.
- `weightKg` is from 0 to 1000.

`packages/shared` exports `MAX_SET_REPS` and `MAX_SET_WEIGHT_KG`. The session form uses
them as the `max` attributes on the reps and weight inputs, so the UI blocks values the
API would reject. Out-of-range input fails Zod validation in the router and is returned
as `422` problem details before it reaches the repository or the database.

Plan targets keep the ADR-0017 limits (100 target reps) and are unchanged.

## Consequences

- Extreme values can no longer reach Prisma, so an oversized set no longer returns
  `500`.
- The API remains the authority; the form mirrors the same shared constants.
- Raising a limit is a one-constant change in `packages/shared` that both the API and
  the UI pick up.
- Sets above 1000 reps or 1000 kg are rejected even though they are not real training
  data.
