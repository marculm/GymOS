# Update Exercise Defaults After Correcting a Completed Set

## Status

Accepted

## Context

ADR-0039 derives exercise defaults when a session completes, and ADR-0043 lets a user
correct `reps` and `weightKg` of a set in completed history. ADR-0043 decided that a
correction leaves the defaults alone, so a set corrected from 100 kg to 80 kg still
prefilled the next workout with 100 kg until the exercise appeared in another completed
session. The correction path and the default derivation therefore disagreed about what
the user actually lifted.

## Decision

- Editing a set in a completed session recomputes the defaults of the edited exercise
  inside the same serializable transaction as the set update (ADR-0011), using the
  derivation of ADR-0039.
- Only the edited exercise's defaults are written; exercises outside that set keep their
  current defaults.
- A rejected edit returns before the set update, so its defaults and the set stay
  unchanged.
- Logging or deleting a set in an active session still does not touch defaults; defaults
  change on session completion (ADR-0039) and now on correcting a completed set.

This supersedes the decision in ADR-0043 that a correction does not recalculate exercise
defaults.

## Consequences

- History reloads the exercise and plan lists after a successful correction, so the next
  workout's targets and prefilled weight reflect the corrected set, as after completion
  (ADR-0039).
- Default weight and reps can change outside session completion. A manual edit to them is
  overwritten by the next completion or correction of that exercise.
- Every correction rescans the user's completed sets to group the last two sessions per
  exercise. That is acceptable at single-user scale (ADR-0039).
