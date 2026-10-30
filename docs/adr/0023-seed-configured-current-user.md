# Seed the Configured Current User

## Status

Accepted

## Context

The seed created only `demo@gymos.app`, while the API resolves the current user from
`GYMOS_USER_EMAIL` (ADR-0009, ADR-0016). When the variable named another address, the
first request failed with `500` from `CurrentUserService`, and the error pointed to a
seed that could not create that user.

## Decision

- `apps/api/prisma/seed.mts` resolves the owner with `currentUserEmail()`, the same
  function the API uses, and upserts that user.
- `demo@gymos.app` remains the default address through `GYMOS_USER_EMAIL`. When another
  address is configured, no separate demo user is seeded.
- The starter `Push Day` plan belongs to the provisioned owner.
- The seed stays idempotent: the user, exercises, and plan are upserted.
- A custom owner is provisioned by setting `GYMOS_USER_EMAIL` before `bun run db:seed`.

## Consequences

- Running the seed with a custom `GYMOS_USER_EMAIL` produces a usable first-run state.
- Changing `GYMOS_USER_EMAIL` after seeding requires running the seed again to
  provision the new owner. The previous user and its data remain.
- The seed imports `config/env.mts`, so it applies the same validation and fallback
  rules as the API.
