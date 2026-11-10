# Recover the Gym Screen from a Completed-Session Conflict

## Status

Accepted

## Context

`POST /gym/sessions/:id/complete` returns `409 Session is already completed` when the
session is no longer open (ADR-0015). The web client showed that error and kept the
session screen. If the finish response was lost after the server committed, or another
tab completed the session, the retry and every later write (log set, delete set, finish)
received `409`, and only a page reload recovered.

The server is the source of truth for whether a session is still open. Making
`complete` idempotent would change the API contract, which ADR-0015 deliberately keeps
as a `409`.

## Decision

- On a `409` from `completeSession`, `logSet`, or `deleteSet`, the Gym screen re-reads
  `getActiveSession()`.
- If that read returns no active session (`404`), the session was already completed: the
  client clears the active session and runs the same post-finish refresh as a successful
  finish (rotation, exercise and plan defaults, focus on the next-workout heading).
- If an active session still exists, the screen keeps the session and shows the original
  error. That covers a `409` that is not a completed session, such as a duplicate set.
- One shared handler performs the re-read and the refresh for all three writes.
- The API, the error mapping, and the `409` status are unchanged.

## Consequences

- A lost finish response or a session completed in another tab returns the user to the
  gym screen instead of requiring a reload.
- Logging or deleting a set in a session completed elsewhere recovers the same way.
- A recovery costs one extra `GET /gym/sessions/active` plus the post-finish rotation and
  defaults reads.
- If the active-session re-read fails, the original error is shown and the screen does
  not recover.
