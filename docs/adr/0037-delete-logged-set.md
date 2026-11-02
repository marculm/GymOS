# Delete a Logged Set During an Active Workout

## Status

Accepted

## Context

A logged set is immutable while its session is active. A wrong weight or rep count
therefore stays in the session and in the workout history. The database enforces one
set number per exercise in a session (`(workoutSessionId, exerciseId, setNumber)`), so
removing a set in the middle of a sequence would leave a gap and break the numbering
that the session screen and history rely on. Editing a logged set remains out of scope;
this decision covers deletion only.

## Decision

- `DELETE /api/gym/sessions/:id/sets/:setId` deletes one set owned by the current user.
  The set must belong to the session named in the path; a set from another session or
  another user is reported as `404`, like a missing session.
- A completed session is immutable. Deleting from it returns `409` with the same
  `SessionCompletedError` mapping used when logging to it.
- The delete, the ownership check, and the renumbering run in one serializable
  transaction. After the delete, the remaining sets of that exercise are renumbered
  from `1` in ascending order, so the numbering stays contiguous and the unique
  invariant holds. Sets of other exercises in the session are untouched.
- The session screen shows a Delete action on every set row while the session is
  active. The action asks for confirmation with the set number and exercise name, the
  shared pending state disables the other controls, and a successful delete removes the
  set from the client state and renumbers the remaining sets locally, without reloading
  the session.
- Completed sessions render their sets without delete actions.

## Consequences

- A wrongly logged set can be removed before finishing the workout, and the history no
  longer keeps it.
- Deleting a set can drop an exercise below its target again; the card's collapsed or
  done state follows the new count (ADR-0019, ADR-0029).
- The API contract gains one route and no schema change. Client state mirrors the
  server's renumbering for immediate feedback; a later read returns the same result.
- Editing a logged set still requires the separate change in #6.
