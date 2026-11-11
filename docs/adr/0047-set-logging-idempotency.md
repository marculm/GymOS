# Idempotent Set Logging

## Status

Accepted

## Context

`POST /gym/sessions/:id/sets` creates a new set with the next number. The request had no
identity, so a response lost after the server saved the set left the form showing an
error. Tapping "Add set" again created a second set, inflating volume and possibly
changing personal records. Blindly retrying mutations is not acceptable (issue #12), and
the existing unique constraint on `(workoutSessionId, exerciseId, setNumber)` only
protects set numbers.

## Decision

- The web client generates a UUID when a set is submitted and sends it as
  `idempotencyKey` in the request body.
- `WorkoutSet` stores the key; a unique constraint on
  `(workoutSessionId, idempotencyKey)` allows one set per submission per session.
- `logSet` looks up the key inside the serializable transaction and returns the existing
  set when it is already present. A `P2002` from a concurrent insert is resolved the same
  way after the transaction; only a missing key falls back to the duplicate-set error.
- A replay returns the existing set with `201 Created`, the same response as the
  original insert, so the client treats both identically.
- The session view keeps one pending key per exercise while submission fails and clears
  it after success. Collapsing and reopening the card therefore keeps the retry; the next
  set gets a new key.
- Amended by #119: current clients must send the key. A request without one is still
  accepted so a cached web bundle built before the key existed keeps logging sets; the API
  generates a key for that request. Remove the tolerance once no pre-key bundle can still
  be cached. Set numbering and concurrency behavior are unchanged.

## Consequences

- Retrying a submission whose response was lost returns the original set instead of
  creating another.
- Concurrent posts with the same key produce one set; posts with different keys keep the
  existing set-number conflict behavior.
- A request without an idempotency key is accepted for clients built before the key
  existed: the API generates one, so the set is logged without replay protection. Current
  clients still send a key and keep replay protection.
- The migration adds the key as `NOT NULL` before the API rollout. Old API pods still
  running during the overlap fail set inserts. The single-user MVP accepts this transient
  window; an expand/contract migration would remove it.
- If the values are changed before retrying a submission whose response was lost, the
  stored set still wins. Editing requires a successful submission and a new key.
