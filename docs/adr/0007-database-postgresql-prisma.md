# Database: PostgreSQL with Prisma ORM

## Status

Accepted

## Context

We need a relational database for structured data (workouts, recipes, meal plans, user data). The ORM should provide type-safe queries that integrate with our TypeScript stack and handle schema migrations.

## Decision

We will use **PostgreSQL** as the database and **Prisma** as the ORM.

- Prisma schema lives in `apps/api/prisma/schema.prisma`.
- Migrations are version-controlled in `apps/api/prisma/migrations/`.
- Prisma Client is the only allowed database access layer.

### Rules

1. All database access goes through **Prisma Client** — no raw SQL, no direct `pg` driver usage.
2. Schema changes require a Prisma migration (`prisma migrate dev`).
3. The Prisma schema is the source of truth for the database structure.
4. Database access code lives in `apps/api/src/db/` or within module repositories — never in `apps/web` or `packages/shared`.

## Consequences

- Type-safe database queries with auto-generated Prisma Client.
- Migration history enables reproducible database state across environments.
- Centralized DB access makes it easy to add query logging, caching, or switch ORMs later.
