# Map Concurrent Plan Deletes to Client Errors

## Status

Accepted

## Context

Rotation replacement and plan updates check ownership and then write inside a serializable
transaction (ADR-0011). A plan deleted from another client between the check and the write
does not raise a serialization failure: the rotation insert fails the `planId` foreign key
with `P2003`, and the plan update fails with `P2025` because the row is gone. Both errors
escaped the repositories and became `500` responses.

## Decision

- `RotationRepository.replace` maps `P2003` to `ConcurrentUpdateError`, the same `409`
  result used for exhausted retries. Retrying re-reads ownership and reports the deleted
  plan as unknown (`422`).
- `PlanRepository.update` maps `P2025` to `null`; `GymWriteService.updatePlan` already
  turns a `null` update into `NotFoundError` (`404`).
- The success paths, the plan-delete API, and the existing error mappings are unchanged.
  The related `startSession` `P2003` race stays in `docs/known-issues.md`.

## Consequences

- Saving a rotation that references a just-deleted plan returns `409` problem details
  instead of `500`.
- Updating a just-deleted plan returns `404` problem details instead of `500`.
- Any other foreign-key failure in the rotation write also becomes `409`; it is still a
  client-visible conflict rather than an internal error.
