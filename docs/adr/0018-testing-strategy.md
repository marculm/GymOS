# Testing Strategy

## Status

Accepted

## Context

The repository has integration tests for the gym routes and a shared-schema test, but no
service-level unit tests. The concurrency rules from ADR-0011 are tested only for two
parallel session starts; set numbering, completion races, and user isolation are not
covered. The Svelte migration changes the frontend test stack.

## Decision

GymOS uses two test tiers:

1. **Unit tests** live next to services (`*.test.mts`) and use hand-rolled typed fakes
   with `vi.fn`. They cover business rules, pagination slicing, filters, error mapping,
   and orchestration without HTTP or a database.
2. **Integration tests** live under `apps/api/test/integration/rest/` and call the
   exported Hono app against a seeded PostgreSQL database. They cover routing,
   validation, status codes, problem details, and Prisma behavior.

Required regression coverage:

- Five parallel `POST /sessions/:id/sets` requests produce unique, contiguous set numbers
  or a `409`.
- A log-set versus complete-session race never leaves a set on a completed session.
- Two-user isolation: user B receives `404` for user A's session, cannot log a set on
  it, and does not see user A's plans.
- Pagination metadata for empty and non-empty pages.
- Problem-details shape for `404`, `409`, and `422`.

Frontend tests use `@testing-library/svelte`, Vitest, and happy-dom. `svelte-check` is
the web typecheck gate; `bun check` alone cannot resolve `.svelte` imports.

Verification commands:

```bash
bun run typecheck
bun run lint:all
bun run test
bun run build
```

## Consequences

- Business logic is testable without a database, so service tests stay fast.
- The riskiest code in the repository (serializable transactions) has direct regression
  tests.
- The user-scoping boundary is tested before authentication is added.
- Integration tests still require a local seeded PostgreSQL (`bun run db:up`).
- The web typecheck runs through `svelte-check`; the root typecheck script must invoke
  the API, shared, and web checks separately.
