# API Error Model and Response Contract

## Status

Accepted

## Context

The current API throws `HTTPException` from services and returns `{ "error": "..." }`
for failures. List endpoints accept a `limit` without an offset, return unbounded
arrays, and wrap resources in envelopes such as `{ "plan": ... }`. The target
architecture uses a transport-neutral service layer, standardized errors, and paginated
collections.

## Decision

### Errors

- Services and repositories throw domain errors, not Hono `HTTPException`.
- `app.onError` maps domain errors to RFC 9457 Problem Details with
  `Content-Type: application/problem+json`:
  `{ title, status, detail, instance }`. The standard `status` field is used.
- `ZodError` maps to `422 Unprocessable Content` with the issues in `detail`.
- Status mapping: `NotFoundError` → `404`; `ActiveSessionExistsError`,
  `SessionCompletedError`, `DuplicateSetError`, `DuplicatePlanNameError`, and
  `ConcurrentUpdateError` → `409`; `UnknownExerciseError` and `ZodError` → `422`;
  `CurrentUserNotFoundError` → `500`; unknown errors → `500` with server-side logging.

### Collections and filtering

- List endpoints return `Page<T>`:
  `{ content, page: { size, number, totalElements, totalPages } }`.
- Query parameters: `page` (1-based input, 0-based internal) and `size`.
- Defaults: `size = 20`; maximum `size = 100`.
- Plans filter by `name`; sessions filter by `planId`, `from`, and `to`.
- `pageable.mts`, `slice.mts`, `page.mts`, `search-params.mts`, and
  `where-builder.mts` implement the pattern.
- Out-of-range `page` and `size` values are normalized to the defaults; malformed or
  unknown query parameters are rejected with `422`.

### Responses

- Successful item endpoints return the bare resource, not an envelope.
- `POST` create endpoints return `201`, a `Location` header, and the created resource in
  the body.
- `POST /sessions/:id/complete` returns `200` with the completed session.
- `GET /sessions/active` returns the active session or `404` problem details when none
  exists.
- Errors never return `{ error }`.

### Not adopted

- ETag, `If-Match`, `304`, `412`, and `428` resource versioning. Concurrency is handled
  by serializable transactions and `409` (ADR-0011).
- `Accept` negotiation and `406`. GymOS has a single JSON representation.
- GraphQL. The API remains REST with Zod contracts (ADR-0003).
- Response envelopes.

## Consequences

- The web client and its tests must parse problem details, consume `Page<T>`, handle a
  `404` for the active session, and stop reading envelopes.
- Error handling and pagination are defined in one place instead of per route.
- The API contract is documented in `docs/architecture.md` and is stable for the web
  client.
