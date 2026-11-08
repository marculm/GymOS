# Edit a Logged Set in Completed History

## Status

Accepted

## Context

Logged sets become immutable when a session completes. ADR-0010 keeps past sessions as
records of what was performed, and ADR-0037 only allows deleting a set while its session
is active. A wrong weight or rep count entered before finishing therefore has no
correction path, although it still feeds history, volume, and personal records.

The set's identity is `(workoutSessionId, exerciseId, setNumber)`, enforced by a unique
constraint. Any correction must leave that identity untouched so set numbering stays
contiguous and the constraint cannot be violated. ADR-0011 already establishes how the
backend checks session state and writes in one serializable transaction.

## Decision

- `PUT /api/gym/sessions/:id/sets/:setId` accepts `{ reps, weightKg }` with the same
  limits as logging a set (ADR-0022) and returns `200` with the updated `LoggedSet`.
- Only `reps` and `weightKg` are editable. `exerciseId`, `setNumber`, and the session are
  immutable, so the unique invariant is preserved without renumbering. Body fields other
  than the two editable values are ignored.
- Only sets in completed sessions can be edited. An active session keeps its existing
  delete-and-relog correction (ADR-0037) and an update returns `409`. A missing session,
  a set from another session, or another user's set returns `404`.
- The ownership, completion, and update checks run in one serializable transaction
  (ADR-0011). Completed sessions are final, so the update cannot race a completion.
- The history detail shows an Edit action on every set row with inline reps and weight
  fields, Save and Cancel. Success replaces the set in local state without reloading; a
  failure keeps the form open and shows a `role="alert"` message. Every control has an
  accessible name that includes the set number and exercise name.
- A correction does not recalculate exercise defaults, which were derived when the
  session completed (ADR-0039); the defaults change only when that exercise next appears
  in a completed session. Progress and personal records read logged sets directly, so a
  fresh load reflects the correction.

## Consequences

- A mistake in completed history can be corrected without database access, and set
  numbering stays intact because identity fields never change.
- Deleting a set from a completed session remains impossible; editing is now the only
  correction path for history, while active workouts still delete and relog.
- The previous values are not kept, so history shows the corrected set only.
- No schema or migration change is required; the API gains one route and the history UI
  gains inline editing.
