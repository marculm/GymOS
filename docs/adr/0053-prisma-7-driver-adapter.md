# Prisma 7 with a PostgreSQL Driver Adapter

## Status

Accepted

## Context

Prisma 6.19.3 was the last 6.x release, and its `@prisma/config` dependency pinned
`deepmerge-ts@7.1.5`, which is affected by GHSA-ggr8-5vv4-36mx. The repository worked
around the advisory with a Bun override to `deepmerge-ts@^8.0.2` (ADR-0035), but that
bypasses Prisma's exact pin and is not tested by Prisma. Prisma 7 is ESM-only, requires an
explicit output path for the generated client, moves the datasource URL into
`prisma.config.ts`, and requires a driver adapter for PostgreSQL (#101).

## Decision

- `prisma` and `@prisma/client` track the latest stable 7.x release (`^7.10.1`). Release
  candidates of Prisma 8 are not adopted before GA.
- The `prisma-client` generator writes to `apps/api/src/generated/prisma`, which is
  gitignored. `db:generate` produces it before typecheck and tests (ADR-0045).
- The API connects through `@prisma/adapter-pg`. `apps/api/src/config/prisma-client.mts`
  builds the adapter from `DATABASE_URL` and sets a 5-second connection timeout to keep
  the previous Prisma default. The seed script reuses that client.
- `apps/api/prisma.config.ts` supplies the schema path and datasource URL to the Prisma
  CLI; the schema no longer contains a `url`.
- The `deepmerge-ts` override is removed from the root `package.json`;
  `@prisma/config@7.10.1` depends on the fixed `deepmerge-ts@8.0.2`.

## Consequences

- `bun audit --audit-level=high` passes without an override, and Prisma's own pinned
  dependency graph is used unmodified.
- `prisma migrate dev` no longer generates the client, so `db:migrate` chains
  `prisma generate`.
- The Docker builder generates the client and the runtime image copies it; the runtime
  also carries `prisma.config.ts` for the migration Job.
- Database connections use the `pg` driver, so pooling and TLS behavior follow `pg`.
  Connecting without a timeout is prevented by the explicit 5-second timeout.
