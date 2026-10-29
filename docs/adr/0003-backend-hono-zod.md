# Backend: Hono Framework with Zod Validation

## Status

Accepted

## Context

We need a lightweight, type-safe HTTP framework for the API server. The framework should work well with Bun, support middleware, and integrate naturally with TypeScript and Zod for request/response validation.

## Decision

We will use **Hono** as the backend API framework and **Zod** for all runtime validation.

- Route handlers use Hono's typed middleware for request validation.
- All API request/response bodies are validated with Zod schemas from `packages/shared`.
- No raw `JSON.parse()` or manual type assertions on external input.
- Amended by ADR-0013: routers validate input with Zod `parse`; `ZodError` is mapped to
  `422` problem details.

### Rules

1. Every API endpoint must validate its input using a Zod schema.
2. Zod schemas used across apps live in `packages/shared/src/schemas/`.
3. No Express, Fastify, or other HTTP frameworks — Hono only.

## Consequences

- Type-safe API contracts shared between frontend and backend.
- Runtime validation catches malformed input before it hits business logic.
- Hono's small footprint keeps the API server fast and lightweight.
