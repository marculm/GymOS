# Workout Set Reps and Weight Limits

## Status

Accepted

## Context

`CreateWorkoutSetSchema` accepted any positive integer for `reps` and any
non-negative number for `weightKg`. `reps` values above Prisma's 32-bit `Int` range
made the insert fail and the API returned `500`; extreme weights, stored as `Float`,
were accepted. ADR-0017 bounded plan targets but left logged set limits open, tracked
in `docs/known-issues.md` at the time.

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

Plan targets are no longer stored; the plan response derives them from the exercise
defaults (ADR-0038).

The precision rules for weights change:

- Every editable weight input (logged set and exercise default) uses `step=0.01` and
  accepts two decimal places, so values such as `22.25 kg` can be entered.
- `weightKg` stays a `Float` and the API keeps the `0`–`1000` bound without an extra
  precision check. A submitted `22.25` is stored as `22.25`; no rounding happens on the
  way in.
- The web app formats every displayed weight with up to two decimals and without forced
  trailing zeros (`22.5`, not `22.50`). The same formatter is used in set rows, history,
  progress, plan targets, and exercise defaults. Values with more than two decimals are
  rounded for display only.
- Weight suggestions remain rounded to the nearest `0.5 kg` (ADR-0030); the precision
  change applies to input and display, not to the suggestion calculation.
- The set form orders Reps before Weight in two compact side-by-side fields. Its
  accessible names stay "Reps" and "Weight (kg)", and the keyboard order is
  Reps → Weight → Add set.

## Consequences

- Extreme values can no longer reach Prisma, so an oversized set no longer returns
  `500`.
- The API remains the authority, and the API and UI read the same constants, so their
  limits cannot drift.
- Raising a limit is a one-constant change in `packages/shared`.
- Sets above 1000 reps or 1000 kg are rejected even though they are not real training
  data.
- Two-decimal weights such as `22.25 kg` can be entered, stored, and read back exactly,
  and the UI never shows artificial trailing zeros.
- A client that sends more than two decimals still passes validation; the extra
  precision is kept in storage but rounded when displayed.
