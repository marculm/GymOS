# Single-User MVP Without Authentication

## Status

Accepted

## Context

GymOS is a personal gym and nutrition app. The MVP must be usable on a phone in the gym without a login flow. Multi-user accounts, password storage, email verification, and session management would add significant backend and UI work without improving the personal use case.

The deployment target is a private instance on free infrastructure, initially reachable only by the owner.

## Decision

GymOS is a single-user application for its MVP. The API resolves the current user from `GYMOS_USER_EMAIL`, defaulting to `demo@gymos.app`. There is no login, session cookie, or password handling. Every feature query is still scoped by `userId` so authentication can be added later without a data migration.

Public deployment requires an access gate (reverse-proxy basic auth or an application-level login) before the API is exposed to the internet.

## Consequences

- The local demo user must exist; `bun run db:seed` creates it.
- Tests use a unique user per test file through the same `GYMOS_USER_EMAIL` override.
- Adding authentication later only replaces `getCurrentUser`; plan and session data already carry a `userId`.
