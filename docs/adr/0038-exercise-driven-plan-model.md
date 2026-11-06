# Plans Store Exercise Selection Only

## Status

Accepted

## Context

`WorkoutPlanExercise` stored `targetSets`, `targetReps`, and `targetWeightKg` per plan, duplicating the defaults on `Exercise`. The exercise register already owns the working sets, reps, and weight, and those values update from training history (#64). Duplicated plan targets drift from the register and make the plan form ask for values the register already defines.

ADR-0010 introduced plan targets as reusable templates. ADR-0025 made plan edits replace the plan's exercises and targets. This ADR narrows the plan to the selection and order of exercises.

## Decision

- `WorkoutPlanExercise` stores only the exercise reference, its `position`, and optional `notes`.
- The plan create/update input accepts exercise selection, order (array order), and notes. Legacy `targetSets`, `targetReps`, and `targetWeightKg` fields from older clients are ignored.
- The plan response keeps `targetSets`, `targetReps`, and `targetWeightKg`, derived from the exercise's `defaultSets`, `defaultReps`, and `defaultWeightKg`. Existing screens keep their contract.
- Session targets, including the done threshold, therefore follow the exercise defaults.
- Existing plans keep their exercise selection and order; stored target values are discarded by the migration.
- The plan form simplification and the history target-line cleanup follow in separate issues.

## Consequences

- There is one source of truth for working values: the exercise register.
- Changing an exercise default changes every plan that uses it; plans cannot override the value.
- Past sessions and logged sets remain independent (ADR-0010).
- The response still carries target fields, so the web contract does not change in this step.
- ADR-0017's plan target limits no longer apply; the exercise defaults keep their existing bounds. ADR-0022's plan-target weight input note becomes obsolete once the plan form is simplified.
