# Workout Set Reps and Weight Limits

## Status

Accepted

## Context

`CreateWorkoutSetSchema` accepted any positive integer for `reps` and any
non-negative number for `weightKg`. `reps` values above Prisma's 32-bit `Int` range
made the insert fail and the API returned `500`; extreme weights, stored as `Float`,
were accepted. ADR-0017 bounded plan targets but left logged set limits open, tracked
as known issue 5 in `docs/known-issues.md`.

## Decision

The limits live in `packages/shared/src/limits.mts` and are exported as
`MAX_SET_REPS` and `MAX_SET_WEIGHT_KG`:

- `reps` is an integer from 1 to 1000.
- `weightKg` is from 0 to 1000.

Both maxima are above any realistic human set and far below the 32-bit limit, so they
block pathological input without rejecting real training. `CreateWorkoutSetSchema`
uses them, and the session form imports them from the `@gymos/shared/limits` subpath
for the `max` attributes on the reps and weight inputs. The subpath keeps Zod out of
the web bundle. Out-of-range input fails Zod validation in the router and is returned
as `422` problem details before it reaches the repository or the database.

Plan targets keep the ADR-0017 limits (100 target reps) and are unchanged.

## Consequences

- Extreme values can no longer reach Prisma, so an oversized set no longer returns
  `500`.
- The API remains the authority, and the API and UI read the same constants, so their
  limits cannot drift.
- Raising a limit is a one-constant change in `packages/shared`.
- Sets above 1000 reps or 1000 kg are rejected even though they are not real training
  data.
