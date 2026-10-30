# Workout Concurrency Control with Serializable Transactions

## Status

Accepted

## Context

GymOS allows at most one active workout session per user and forbids logging sets against a completed session. The first implementation checked these rules and then wrote in a separate statement, so two concurrent requests could both pass the check and create two active sessions, or attach a set after another request completed the session.

The alternatives were:

- A partial unique index on `workout_sessions ("userId") WHERE "completedAt" IS NULL`.
- A transaction that serializes the check and the write.

Prisma's schema language cannot express partial indexes, ADR-0007 forbids raw SQL, and a hand-written index would drift from Prisma's migration history. The single-user MVP also has a very low write volume.

## Decision

The gym repository wraps the state-changing operations in Prisma interactive transactions with `Serializable` isolation:

- `createSessionIfNoActive` checks for an active session and creates the new one in the same transaction.
- `createSetIfSessionOpen` checks session ownership and completion, validates the exercise, computes the next set number, and creates the set in the same transaction.
- `completeSessionIfOpen` checks ownership and completion and sets `completedAt` in the same transaction.

Transactions retry up to three times on Prisma error `P2034` (serialization failure). If the conflict persists, the service returns `409 Concurrent update, retry`. The existing unique constraint on `(workoutSessionId, exerciseId, setNumber)` remains a second guard and its `P2002` is mapped to `409`.

Replacing a rotation uses the same serializable transaction. Concurrent replaces can collide on the `(userId, position)` unique constraint before a serialization failure is raised, so it also retries `P2002` up to three times and maps an exhausted retry to the same `409`.

## Consequences

- Concurrent starts produce exactly one active session; the loser returns 409 and the UI resumes the winner.
- A set cannot be attached to a session that is completed concurrently.
- Serialization conflicts add retries and can return 409 under heavy contention; for this single-user app the cost is negligible.
- If GymOS moves to a database or ORM that models partial unique indexes cleanly, the transaction approach can be replaced by a database constraint.
