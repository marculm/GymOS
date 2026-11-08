# Generate the Prisma Client Before Typecheck and Tests

## Status

Accepted

## Context

The typed Prisma Client is generated from `apps/api/prisma/schema.prisma` into
`node_modules`. It is not committed and is not part of the installed `@prisma/client`
package, so a fresh checkout has no generated types until `db:generate` runs. Without it,
`bun run typecheck` fails on the Prisma types and the API test suites fail on the missing
client. `AGENTS.md` requires both commands before every task, so they must work on a
fresh checkout without a manual generate step.

Generating needs no database connection. A root `postinstall` script was considered, but
both Dockerfiles run `bun install` before copying `apps/api/prisma`, so the generate would
fail in the image builds.

## Decision

The root `typecheck` and `test` scripts run `bun --filter @gymos/api db:generate` before
their existing commands. Generating before every check also picks up schema changes made
since the last install. The explicit generate step in CI stays in place; repeated runs
are harmless.

## Consequences

- A fresh checkout passes `bun run typecheck` and `bun run test` without a manual
  generate.
- Each check pays a few seconds for generation, even when the client is current.
- `postinstall` stays free for dependency installation, and the Docker image builds are
  unaffected.
- Scripts that bypass the root commands (`vitest` or `bun check` called directly) still
  need a generated client.
