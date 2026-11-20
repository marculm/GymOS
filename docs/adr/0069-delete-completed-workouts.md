# Delete Completed Workouts

## Status

Accepted

## Context

Workout history lists completed sessions, and progress analytics derive personal records
and per-session volume from every completed session (ADR-0032). The API could edit and
delete logged sets but could not delete a whole workout, so test or accidental workouts
stayed in history and kept contributing to progress.

## Decision

- `DELETE /api/gym/sessions/:id` deletes the current user's completed session and, through
  the existing `WorkoutSet` cascade, its logged sets.
- The delete is one scoped `deleteMany` filtered by session id, user id, and
  `completedAt: { not: null }`. A missing, foreign, or active session matches no row and
  returns `404`; a completed session returns `204 No Content`.
- History offers a per-workout delete action with a confirmation prompt, following the
  plan-delete pattern (ADR-0025). A successful delete refetches the first history page so
  the list and its page offsets stay correct, and reloads the gym store so the next-plan
  suggestion reflects the new last completed workout (ADR-0026). A failed delete keeps
  the row and shows the error.
- Exercise defaults are not recomputed when a workout is deleted; they update on the next
  completion or set correction (ADR-0039, ADR-0068).

## Consequences

- A deleted workout stops contributing to history and progress; deletion is permanent and
  has no undo.
- In-progress sessions cannot be deleted; the UI offers the action only on completed
  history rows.
- Deleting the latest planned workout can change the rotation suggestion, which the store
  reload refreshes.
