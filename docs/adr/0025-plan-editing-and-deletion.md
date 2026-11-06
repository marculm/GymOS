# Plan Editing and Deletion

## Status

Accepted

## Context

Plans can only be created, listed, and started. Users cannot rename a plan, change its
exercises or targets, or remove it. ADR-0010 keeps sessions and logged sets independent
of the plan so plans can change later without rewriting history; this ADR defines how
those changes happen.

## Decision

- `PUT /api/gym/plans/:id` replaces the whole plan: name, description, and the exercise
  selection and order. It uses the same validation as creation, including the
  exercise-existence check and the unique-name rule.
- Plan exercises are replaced wholesale in one transaction: existing
  `WorkoutPlanExercise` rows are deleted and recreated with new positions. Nothing
  references those rows outside the plan.
- Plan targets are not stored. Responses derive them from the current exercise defaults
  (ADR-0038).
- `DELETE /api/gym/plans/:id` hard-deletes the plan. `WorkoutPlanExercise` rows cascade;
  sessions keep their row and title, and `planId` becomes `NULL` through `onDelete:
  SetNull`. Logged sets are never touched.
- Both routes are scoped to the current user. A plan owned by another user is
  indistinguishable from a missing one and returns `404`.
- Responses follow ADR-0015: `200` with the updated plan, `204` on delete, `404` for a
  missing plan, `409` for a duplicate name, and `422` for invalid input.

## Consequences

- Renaming or restructuring a plan never changes past sessions, their titles, or their
  logged sets.
- Editing a plan cannot change its targets; those follow the exercise register.
- Plan exercise entry IDs change on every edit; no contract exposes them beyond the plan.
- Deleting a plan is permanent and has no soft-delete or restore path.
- A plan session in progress keeps working after its plan is deleted because the session
  already resolved its title and the frontend tolerates a missing plan.
