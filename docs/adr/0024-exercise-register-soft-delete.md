# Exercise Register with Soft Delete

## Status

Accepted

## Context

The exercise catalog is seed-only: users cannot create, edit, or remove exercises, and
the seed entries have no training defaults. Plan targets and set logging therefore start
from blank values on every use. Workout sets and plan entries reference exercises by ID,
so physical deletion would break history and existing plans. The issue also asks whether
a rename may change historical display.

## Decision

- `Exercise` gains `defaultSets` (integer, default 3), `defaultReps` (integer, default
  8), `defaultWeightKg` (nullable float), and `deletedAt` (nullable timestamp).
- Exercises are global to the single-user MVP (ADR-0009). Seed exercises are ordinary
  rows and can be edited and deleted like user-created ones.
- Deletion is soft: `DELETE /api/gym/exercises/:id` sets `deletedAt`. No exercise route
  hard-deletes a row, and `WorkoutSet`/`WorkoutPlanExercise` keep `onDelete: Restrict`.
- The register lists only rows with `deletedAt IS NULL`. Creating a plan rejects
  deleted exercise IDs as unknown. Existing plan entries and logged sets keep their
  references, and an existing plan session can still log sets for a deleted exercise.
- History is labelled from the live exercise row: `LoggedSet` carries `exerciseName`.
  Renaming an exercise therefore relabels its past sets. Names are not snapshotted,
  because the exercise identity is stable and a snapshot would add a column without a
  requirement to preserve old wording.
- Exercise names remain globally unique, including deleted rows.
- The register form is the shared `ExerciseForm` component. Session cards reuse it to edit
  an exercise inline; both paths apply the same validation, surface errors in the form,
  and save through `PUT /api/gym/exercises/:id`. Inline editing never creates exercises;
  creation stays in the register.

## Consequences

- Deletion never destroys history or existing plans.
- The frontend can show deleted exercises wherever a plan entry or logged set already
  references them, while hiding them from the register and new-plan selection.
- There is no restore action; a deleted exercise stays hidden and its name stays
  reserved by the unique constraint (tracked in `docs/known-issues.md`).
- Renames are visible retroactively in workout history.
- The register and the session share one exercise form, so validation, pending state, and
  error messages cannot drift between them.
