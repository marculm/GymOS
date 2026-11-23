# Override effect in the Prisma Dependency Graph

## Status

Accepted

## Context

`bun audit --audit-level=high` fails on `effect@3.20.0`: GHSA-7589-6fvf-x4pw, a
high-severity ReDoS in the `Schema.TemplateLiteral` compiled regex, affecting versions up
to `3.22.0`. The dependency path is
`workspace:@gymos/api > prisma > @prisma/config@7.10.1 > effect`, and `@prisma/config`
pins `effect` to exactly `3.20.0`. `@prisma/config@7.10.1` is the newest stable release
and still pins it; Prisma 8 exists only as a release candidate (ADR-0053 forbids adopting
RCs). `effect` is used by the Prisma CLI config loader: no application source imports it
and `@prisma/client` does not depend on it, so API request handling never executes the
vulnerable code.

ADR-0053 removed the earlier `deepmerge-ts` override and recorded that the audit passes
without an override while Prisma's pinned graph is used unmodified. That statement no
longer holds for `effect` until a stable Prisma release pins a fixed version, and it is
the only outstanding audit finding.

## Decision

- The root `package.json` pins `effect` to exactly `3.22.5` through `overrides`, and
  `bun.lock` resolves a single `effect@3.22.5` for the `@prisma/config` chain.
- `3.22.5` is the newest 3.x release and above the first patched `3.22.1`. Staying on
  major 3 keeps the Prisma CLI's usage of effect unchanged. The exact pin mirrors
  Prisma's own exact pin and keeps the resolution deterministic while the override is
  temporary.
- No other dependency changes, and the threshold stays `bun audit --audit-level=high`.
- The override is a temporary deviation from Prisma's tested dependency graph. It is
  verified through `bun audit`, through `bun --filter @gymos/api db:generate` (which loads
  `prisma.config.ts` and therefore the overridden `effect`), and through the regular
  checks.
- Remove the override when a stable Prisma 7.x release pins `effect >= 3.22.1`, or with
  the Prisma 8 migration (#192), whose CLI no longer depends on `@prisma/config`. Remove
  it earlier if the Prisma CLI breaks.
- The advisory is not suppressed and the audit step is not lowered or skipped.

## Consequences

- `bun audit --audit-level=high` passes again without ignoring the advisory.
- ADR-0053's consequence that the audit passes without an override is superseded for
  `effect` until this override is removed. The rest of ADR-0053 stands.
- The Prisma CLI runs with a dependency combination Prisma does not test. The risk is
  limited to CLI commands (`db:generate`, migrations) and surfaces in CI rather than in
  API request handling.
- A future Prisma 7 patch may make the override unnecessary; every Prisma update must
  re-check it and remove the override when possible.
- Prisma 8 removes the chain entirely; the override must not survive that migration.
- The security job remains informational for deploys (ADR-0035) but is green again.
