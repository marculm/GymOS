# Backend Layering and Module Structure

## Status

Accepted

## Context

The GymOS API currently uses flat module files with free functions: an `index.mts` with
route handlers, a `service.mts`, and a `repository.mts`. As nutrition and extractor
features are added, this shape makes layer boundaries and service-level testing harder.
The target architecture in [`docs/architecture.md`](../architecture.md) defines the
intended structure.

## Decision

The API is organized into a composition root and feature modules:

- `src/app.mts` assembles middleware, routers, and the central error handler.
  `src/index.mts` only starts the Bun server and manages the database connection.
- Each feature module owns `router/`, `service/`, and `repository/` folders and exposes
  one `index.mts` that composes its routers.
- Routers are split into a read router (`GET`) and a write router (`POST`, `PUT`,
  `DELETE`). They parse HTTP input, validate it with Zod, and never access the database.
- Services are classes with constructor injection, split into read and write services.
  They own business rules, throw domain errors, and never import Hono or Prisma.
- `src/container.mts` wires repositories into read services and read services into write
  services. Routers import the container.
- The repository layer is retained. Repositories are the only place that accesses Prisma
  (ADR-0007). They map rows to shared contract types and translate Prisma errors into
  domain errors.
- The current user is resolved in `security/current-user.mts` and passed to services as
  a `userId`. Services never resolve identity (ADR-0009).
- Configuration, logging, error mapping, pagination, and testing follow ADR-0015,
  ADR-0016, and ADR-0018.
- TypeScript source and test files use `.mts` with explicit `.mts` imports. Tool
  configuration files (`vite.config.ts`, `vitest.config.ts`, `oxlint.config.ts`) stay
  `.ts`. The web app uses `.svelte` components and `.mts` modules (ADR-0014).

## Consequences

- Services become testable without HTTP or a database because repositories can be
  replaced with fakes.
- Layer boundaries are explicit: routers do not know Prisma, services do not know Hono,
  and repositories do not know HTTP.
- The `.mts` rename touches every relative import. The compiler already supports it
  (`allowImportingTsExtensions`, `moduleResolution: "bundler"`, `noEmit`).
- ADR-0006 is refined: the module entry point remains, but the internal layers are
  folders. ADR-0003 is amended: validation happens in routers with Zod `parse`, not in
  route-handler middleware.
- ADR-0011 is unchanged: serializable transactions and `409` semantics remain.
