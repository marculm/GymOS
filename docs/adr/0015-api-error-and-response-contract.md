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

### Request bodies

- `POST` and `PUT` requests to the gym write routes must declare
  `Content-Type: application/json`; otherwise the API returns `415 Unsupported Media Type`
  problem details without reading or persisting the body.
- `DELETE` requests carry no body and are not checked.
- This blocks the CORS "simple request" path: a cross-site `text/plain` write skips the
  preflight and would otherwise reach the route, which matters because the API has no
  authentication (ADR-0009).

### Client requests

- Every web API request has a 10-second default timeout, exported as
  `REQUEST_TIMEOUT_MS` and overridable per request. Each request runs under an
  `AbortController`; a timeout aborts the fetch and rejects with `ApiTimeoutError`,
  which carries a timeout-specific user message.
- The web client retries a `GET` exactly once when the first attempt fails with a
  network error or a `5xx` response. A retried request runs with a fresh timeout.
- The web client never retries `POST`, `PUT`, or `DELETE` requests automatically. It
  also does not retry `4xx` responses or timeouts, so a hung request fails after about
  one timeout rather than two.

### Not adopted

- ETag, `If-Match`, `304`, `412`, and `428` resource versioning. Concurrency is handled
  by serializable transactions and `409` (ADR-0011).
- `Accept` negotiation and `406`. GymOS has a single JSON representation.
- GraphQL. The API remains REST with Zod contracts (ADR-0003).
- Response envelopes.

## Consequences

- The web client and its tests must parse problem details, consume `Page<T>`, handle a
  `404` for the active session, stop reading envelopes, and apply the client request
  timeout and retry rules.
- A hung API surfaces a visible, retryable error after about 10 seconds instead of
  leaving the Gym screen loading.
- The web client already sends `Content-Type: application/json`, so the content-type rule
  needs no client change.
- Error handling and pagination are defined in one place instead of per route.
- The API contract is documented in `docs/architecture.md` and is stable for the web
  client.
