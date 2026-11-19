# Check the Configured User in Readiness

## Status

Accepted

## Context

`GET /health/readiness` only verified that the database answered by running
`prisma.user.count()` (ADR-0016). The API resolves the single owner from
`GYMOS_USER_EMAIL` on every request (ADR-0009). When no row matches, every API call
fails with `CurrentUserNotFoundError` and returns `500`, yet readiness still reported
`up`, so an orchestrator kept a broken instance in rotation.

Resolving the owner is a lookup by a unique column, so it costs the same class of query
as the previous count.

## Decision

- Readiness resolves `currentUserEmail()` with `user.findUnique` and returns
  `{ "status": "up" }` only when a row exists.
- A missing owner returns `503` problem details, like an unavailable database.
- The response detail is a fixed message; it does not expose the configured email or
  database details.
- The check runs per request, so repairing the seed or changing `GYMOS_USER_EMAIL` is
  visible without a restart.

## Consequences

- An instance whose owner row is missing is removed from rotation instead of serving
  `500`s.
- Deleting the owner row takes the instance out of rotation until the seed runs again.
- Readiness still performs one indexed query per request, as before.
