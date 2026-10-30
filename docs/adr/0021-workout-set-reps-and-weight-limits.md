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

The session form mirrors the same numbers as `max` attributes on the reps and weight
inputs, following the plan form's pattern, so the UI blocks values the API would
reject. Out-of-range input fails Zod validation in the router and is returned as `422`
problem details before it reaches the repository or the database.

Plan targets keep the ADR-0017 limits (100 target reps) and are unchanged.

## Consequences

- Extreme values can no longer reach Prisma, so an oversized set no longer returns
  `500`.
- The API remains the authority; the form mirrors the same numbers.
- Raising a limit means updating the shared schema, the form, and the tests. The
  component test asserts the rendered `max` values, so a one-sided change fails.
- Sets above 1000 reps or 1000 kg are rejected even though they are not real training
  data.
