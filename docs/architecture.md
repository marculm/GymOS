# GymOS Target Architecture

This document describes the target architecture of GymOS. It is a description, not a
migration plan. Decisions are recorded in `docs/adr/`; this document shows how those
decisions fit together. The implementation may lag behind the target until the migration
is complete.

---

## 1. System Context

GymOS is a single-user gym and nutrition application. The first slice is a gym tracker:
create a plan, start a workout, log sets, and finish. History and progress views sit at
the bottom of the Gym page (ADR-0032).

```text
┌──────────────────────────────┐
│  apps/web                    │
│  Svelte 5 + Vite PWA         │
│  installable, client-side    │
└──────────────┬───────────────┘
               │  /api (same origin via reverse proxy)
               ▼
┌──────────────────────────────┐
│  apps/api                    │
│  Hono on Bun                 │
│  routers → services →        │
│  repositories → Prisma       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  PostgreSQL                  │
└──────────────────────────────┘

packages/shared: Zod schemas and contract types used by api and web.
Tailscale Serve terminates TLS for the tailnet; Traefik routes `/api` and `/health` to the
API and everything else to the static PWA served by nginx.
```

The system is deployed as containers (ADR-0008, ADR-0035). The API is single-user until
authentication is added (ADR-0009). Deployment details live in
[`deployment.md`](deployment.md).

---

## 2. Repository Layout

```text
apps/
  api/                 # Hono + Prisma backend
  web/                 # Svelte 5 + Vite PWA
packages/
  shared/              # Zod schemas, contract types, constants
deploy/
  docker/              # local development infrastructure
  k8s/                 # production manifests
docs/
  adr/                 # architecture decision records
  architecture.md      # this document
```

`packages/shared` is a leaf package. It must not import from `apps/*` (ADR-0001,
ADR-0005). `apps/web` must not import from `apps/api`, and vice versa.

---

## 3. Backend

### 3.1 Composition Root

The backend is split into an application assembly and a server bootstrap:

- `src/app.mts` creates the Hono app, registers middleware, mounts routers, registers the
  central error handler, and exports `app`. Tests call `app.request(...)` directly.
- `src/index.mts` imports `app`, connects Prisma, starts `Bun.serve`, and disconnects on
  `SIGINT` and `SIGTERM`.
- `src/container.mts` wires repositories, read services, write services, and the current
  user service as singletons.

Routers import the container; they never construct services or repositories themselves.

### 3.2 Directory Layout

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── seed.mts
│   └── migrations/
├── test/
│   └── integration/
│       ├── helpers.mts
│       └── rest/
│           ├── app.test.mts
│           ├── gym-plans.test.mts
│           └── gym-sessions.test.mts
└── src/
    ├── app.mts
    ├── index.mts
    ├── container.mts
    ├── problem-details.mts
    ├── admin/
    │   └── health-router.mts
    ├── config/
    │   ├── app.mts
    │   ├── cors.mts
    │   ├── env.mts
    │   ├── paths.mts
    │   ├── prisma-client.mts
    │   └── server.mts
    ├── logger/
    │   ├── logger.mts
    │   ├── request-logger.mts
    │   └── response-time.mts
    ├── monitoring/
    │   ├── prometheus-metrics.mts
    │   └── prometheus-router.mts
    ├── security/
    │   ├── current-user.mts
    │   └── errors.mts
    └── modules/
        ├── gym/
        │   ├── index.mts
        │   ├── router/
        │   │   ├── read-router.mts
        │   │   ├── write-router.mts
        │   │   ├── validation.mts
        │   │   ├── page.mts
        │   │   ├── statuscode.mts
        │   │   └── create-base-url.mts
        │   ├── service/
        │   │   ├── errors.mts
        │   │   ├── read-service.mts
        │   │   ├── rotation.mts
        │   │   ├── rotation.test.mts
        │   │   ├── write-service.mts
        │   │   ├── pageable.mts
        │   │   ├── slice.mts
        │   │   ├── search-params.mts
        │   │   ├── read-service.test.mts
        │   │   └── write-service.test.mts
        │   └── repository/
        │       ├── exercise-repository.mts
        │       ├── plan-repository.mts
        │       ├── rotation-repository.mts
        │       ├── session-repository.mts
        │       ├── transaction.mts
        │       ├── where-builder.mts
        │       └── mapping.mts
        ├── nutrition/
        │   ├── index.mts
        │   └── router/read-router.mts
        └── extractor/
            ├── index.mts
            └── router/read-router.mts
```

### 3.3 Layer Model

| Layer | Files | Responsibility | Must not |
|---|---|---|---|
| Composition root | `app.mts`, `index.mts`, `container.mts` | Middleware, route mounting, wiring, server bootstrap | Contain business logic |
| Router | `modules/*/router/*` | HTTP parsing, DTO validation, status codes, headers, pagination input, DTO → service input | Access the database or contain business rules |
| Service | `modules/*/service/*` | Business rules, orchestration, transactions, domain errors | Import Hono or read the HTTP context |
| Repository | `modules/*/repository/*` | Prisma queries, row → contract mapping, Prisma error translation | Contain HTTP or business policy |
| Config | `config/*` | Environment, paths, CORS, server, Prisma client | Contain business logic |
| Cross-cutting | `logger/`, `security/`, `monitoring/`, `admin/`, `problem-details.mts` | Logging, identity, metrics, health, error format | Depend on a feature module |

Each feature module exposes a single `index.mts` that composes its routers. Modules do
not import each other (ADR-0006). Shared code lives in `src/lib/` or
`packages/shared`.

### 3.4 Request Lifecycle

Global middleware is registered before routes, in this order:

```text
secureHeaders → cors → securityHeaders → compress → trackMetrics
              → responseTime → requestLogger → route
```

- `secureHeaders` and the custom security headers set `X-Content-Type-Options` and
  `X-Frame-Options`.
- `cors` uses `config/cors.mts` and the `CORS_ORIGINS` environment variable.
- `compress` compresses compressible responses.
- `trackMetrics` records Prometheus counters and histograms.
- `responseTime` logs the duration and status; `requestLogger` logs method and URL.
- `app.onError` maps errors to problem details (section 3.8).

### 3.5 Routers

Each feature module has a read router and a write router:

- `router/read-router.mts` handles `GET` requests.
- `router/write-router.mts` handles `POST`, `PUT`, and `DELETE` requests.
- `index.mts` composes both routers into the module.

Router responsibilities:

- Parse and validate input with Zod schemas from `router/validation.mts`. Schemas are
  composed from `packages/shared` contracts (ADR-0005).
- Map the HTTP DTO to the service input where the two differ (defaults, nullable
  fields).
- Parse pagination and filter query parameters.
- Set status codes, `Location` on created resources, and `ETag` only where a resource
  version exists (GymOS does not use ETag; see ADR-0015).
- Never import Prisma, repositories, or Hono request context into services.

`statuscode.mts` holds named status constants. `create-base-url.mts` builds the
`Location` value from the request URL and the module path.

### 3.6 Services

Services are classes with constructor injection:

- `GymReadService` handles queries: exercises, plans, rotation with its next-plan
  suggestion, active session, session list, session detail, and progress analytics
  (personal records and per-session volume).
- `GymWriteService` handles commands: create, edit, and soft-delete exercises; create,
  edit, and delete plans; set rotation; start session; log set; complete session. It may
  receive the read service for read-side checks.
- Dependencies, includes, and the logger are `readonly #private` fields.
- Each class uses `getLogger(ClassName.name)`.
- Services are stateless. The container creates one instance each.

The service layer throws domain errors and never imports Prisma or Hono (ADR-0013,
ADR-0015). Transactional rules from ADR-0011 are enforced in the repository layer:
checking for an active session, assigning set numbers, and completing a session happen
inside a serializable transaction.

### 3.7 Repositories

Repositories own all Prisma access (ADR-0007):

- One repository per aggregate: exercises, plans, rotation, sessions.
- They map Prisma rows to `packages/shared` contract types.
- They translate Prisma errors into domain errors:
  - `P2002` → duplicate plan name, duplicate exercise name, or duplicate set; a
    rotation unique conflict is retried and, if it persists, becomes a concurrent
    update.
  - `P2034` after retries → concurrent update.
- `transaction.mts` owns `withSerializableRetry`, which retries `P2034` up to three
  times. Rotation replacement also retries `P2002` conflicts up to three times.
- Repositories never throw `HTTPException`.
- Exercise reads exclude rows with `deletedAt` set. Hard deletion is never exposed;
  `WorkoutSet` and `WorkoutPlanExercise` keep `onDelete: Restrict`.

### 3.8 Error Model

All client errors use RFC 9457 Problem Details with
`Content-Type: application/problem+json`:

```json
{
  "title": "Not Found",
  "status": 404,
  "detail": "Session not found",
  "instance": "/api/gym/sessions/abc"
}
```

`problem-details.mts` exposes status constants and
`createProblemDetails(c, status, detail)`. The central `app.onError` maps:

| Error | Status |
|---|---|
| `NotFoundError` | `404` |
| `ActiveSessionExistsError` | `409` |
| `SessionCompletedError` | `409` |
| `DuplicateSetError` | `409` |
| `DuplicatePlanNameError` | `409` |
| `DuplicateExerciseNameError` | `409` |
| `ConcurrentUpdateError` | `409` |
| `UnknownExerciseError` | `422` |
| `UnknownPlanError` | `422` |
| `ZodError` | `422` |
| `CurrentUserNotFoundError` | `500` |
| anything else | `500`, logged with the error object |

Services and repositories do not import `HTTPException`. See ADR-0015.

### 3.9 Pagination and Filtering

List endpoints return `Page<T>`:

```json
{
  "content": [],
  "page": {
    "size": 20,
    "number": 0,
    "totalElements": 0,
    "totalPages": 0
  }
}
```

- Query parameters: `page` (1-based input, 0-based internal) and `size`.
- Defaults: `size = 20`; maximum `size = 100`.
- `pageable.mts` parses and normalizes out-of-range page and size values to the
  defaults.
- `slice.mts` defines `Slice<T> = { content, totalElements }`.
- `page.mts` creates `Page<T>` with `totalPages`.
- `search-params.mts` defines the allowed filters; `repository/where-builder.mts` maps
  them to Prisma `where` objects.
- Plans filter by `name`; sessions filter by `planId`, `from`, and `to`.
- Malformed or unknown query parameters are rejected with `422`.

See ADR-0015.

### 3.10 Configuration

`config/env.mts` is the single source of environment values. It parses `process.env`
once with a Zod schema and fails fast on invalid values:

- `NODE_ENV`: `development | test | production`, default `production`
- `PORT`: positive integer, default `3000`
- `DATABASE_URL`: non-empty string, required when the server starts
- `GYMOS_USER_EMAIL`: email, default `demo@gymos.app`
- `LOG_LEVEL`: Pino level
- `CORS_ORIGINS`: comma-separated origins

Other configuration modules:

- `config/app.mts` — pagination defaults, runtime settings.
- `config/paths.mts` — route prefixes (`/api/gym`, `/health`, `/prometheus`, ...).
- `config/cors.mts` — CORS options.
- `config/server.mts` — port, host, and `NODE_ENV`.
- `config/prisma-client.mts` — Prisma client, `connectDB`, `disconnectDB`, and the
  `globalThis` cache used by `bun --watch`.

TLS is terminated by the reverse proxy/ingress; the API does not load certificates. See
ADR-0016.

### 3.11 Logging and Observability

- `logger/logger.mts` builds the parent Pino logger and exports
  `getLogger(context, kind = "class")`, which returns a child logger with
  `{ [kind]: context }` bindings.
- Logs go to stdout. `pino-pretty` is enabled only in development; production never
  loads dev dependencies.
- `logger/request-logger.mts` logs method and URL.
- `logger/response-time.mts` logs duration and status and sets `X-Response-Time`.
- `admin/health-router.mts` exposes:
  - `GET /health/liveness` → `{ "status": "up" }`
  - `GET /health/readiness` → `{ "status": "up" }` after a cheap Prisma query
    (`prisma.user.count()`); `503` problem details when the database is unavailable.
  - `GET /health` → liveness alias.
- `monitoring/prometheus-metrics.mts` registers default metrics, an
  `http_requests_total` counter, an `http_request_duration_seconds` histogram, and
  `trackMetrics`.
- `monitoring/prometheus-router.mts` serves `GET /prometheus`.

The metrics endpoint is unauthenticated. It must stay on a private network or be blocked
at the reverse proxy before public exposure. See ADR-0016.

### 3.12 Current User

`security/current-user.mts` resolves the single user from `GYMOS_USER_EMAIL` and throws
`CurrentUserNotFoundError` when the seeded user is missing. `prisma/seed.mts` provisions
that same email with `currentUserEmail()` and upserts the starter plan for it, so a
configured address is usable after seeding (ADR-0023). A router middleware resolves the
user once per request and stores it on the Hono context; routers pass `user.id` to
services. Services never resolve identity themselves.

This is the only authentication seam. When authentication is added, it replaces this
service without changing service signatures (ADR-0009).

### 3.13 Unimplemented Feature Endpoints

The nutrition and extractor modules keep their module boundaries but return
`501 Not Implemented` problem details until the features are implemented. They do not
return fabricated data. The nutrition and recipe schemas and tables stay in place until
those slices are built. See ADR-0017.

---

## 4. Frontend

### 4.1 Stack

- Svelte 5 with Vite.
- `vite-plugin-pwa` for the manifest and service worker.
- Plain CSS with custom properties and named component classes (ADR-0012).
- Warm light theme only: warm white background, warm grey surfaces, near-black text
  and actions, no colored accent (ADR-0020).
- No server-side rendering, no SvelteKit. The app is a client-side SPA.
- `lucide-svelte` for icons.
- `@testing-library/svelte`, Vitest, and happy-dom for tests.
- `svelte-check` for type checking.

The PWA is installed from the browser. The service worker caches the app shell; data is
online-only (ADR-0012).

### 4.2 Directory Layout

```text
apps/web/
├── index.html
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.mts
    ├── App.svelte
    ├── App.test.mts
    ├── styles.css
    ├── vite-env.d.ts
    ├── api/
    │   ├── client.mts
    │   ├── gym.mts
    │   └── gym.test.mts
    ├── features/gym/
    │   ├── ExerciseRegister.svelte
    │   ├── ExerciseRegister.test.mts
    │   ├── GymView.svelte
    │   ├── GymView.test.mts
    │   ├── History.svelte
    │   ├── PlanForm.svelte
    │   ├── Progress.svelte
    │   ├── SessionView.svelte
    │   ├── SetLogForm.svelte
    │   └── SessionView.test.mts
    └── test/
        └── setup.mts
```

### 4.3 Components and State

- Components are `.svelte` files.
- State uses Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`.
- Events use attributes (`onclick`, `onsubmit`), not `on:click`.
- Data fetching and mutations live in `src/api/`; components call that layer and never
  call `fetch` directly.
- The exercise register creates, edits, and soft-deletes exercises. Exercise defaults
  provide the targets shown in plans and sessions and the weight placeholder of an
  exercise without history (ADR-0024, ADR-0030, ADR-0038).
- Plans can be edited and deleted from the plan list. Editing replaces the plan's
  exercise selection and order; targets in responses come from the exercise defaults,
  and past sessions and logged sets are unaffected (ADR-0025, ADR-0038).
- The training rotation section shows the next suggested plan and lets the user add,
  remove, and reorder plans. Free workouts never advance it (ADR-0026).
- The start screen leads with the suggested next workout and one primary start action.
  Rotation, plan management, and the exercise register sit in a collapsible "My training
  plan" section; free workouts are a secondary action (ADR-0027).
- A progress section shows personal records and per-workout volume. Below it, history
  lists completed sessions with plan and date filters and a "Load more" action; opening a
  session expands its sets, targets, and duration inline (ADR-0032).
- History is collapsed by default behind a Show/Hide toggle at the bottom of the screen,
  and its list loads only after it is opened (ADR-0033).
- The secondary action opens a modal picker with every plan and a free workout. Choosing
  a plan counts as a deviation; choosing free never advances the rotation (ADR-0028).
- Set logging happens inside each exercise card: plan cards show their target and their
  own form; free sessions build cards with an "Add exercise" control. No global set form
  remains (ADR-0029).
- Every exercise card starts collapsed and the exercise name is its toggle. A collapsed
  card shows only the name, plus a visible "Done" label once the card is done. A planned
  card auto-collapses when its logged sets reach the target; re-expanding it keeps it open
  while extra sets are logged. Done cards use a muted background and text; free and
  ad-hoc cards have no target and are manual-only (ADR-0019, ADR-0029).
- Every weight input shows a suggestion as a placeholder: the average weight of that
  exercise in the most recent completed workout, rounded to 0.5 kg, falling back to the
  exercise default. Reps are not prefilled, and RPE is no longer recorded (ADR-0030,
  ADR-0031).
- Every weight input accepts two decimals (`step=0.01`). The set form places Reps before
  Weight in compact side-by-side fields; displayed weights use up to two decimals without
  trailing zeros across set rows, history, progress, plan targets, and defaults
  (ADR-0022).
- The session screen displays every logged set, including exercises that are not part of
  the session's plan (ADR-0019). Logged sets carry `exerciseName`, so deleted exercises
  stay readable in history.
- While the session is active, each set row offers a confirmed Delete action. The API
  deletes the set and renumbers the remaining sets of that exercise in one transaction;
  the client mirrors the renumbering without reloading (ADR-0037). Completed sessions
  remain read-only.
- After a start conflict (`409`), the screen re-reads the active session; if none exists,
  it retries the start once or shows a message (ADR-0019).
- Plan start actions include the plan name, errors render in `role="alert"` live regions,
  and starting or finishing a session moves focus to the session or next-workout heading
  (ADR-0034).
- While a session is active, a fixed session bar replaces the main tab bar and makes the
  Nutrition and AI Extractor tabs unreachable. It keeps Finish workout and a rest timer
  visible; the timer autostarts after a logged set and offers 120/150/180-second presets
  persisted locally (ADR-0036).

### 4.4 API Layer

`src/api/client.mts` wraps `fetch` and throws `ApiError(status, message)`. It parses
`application/problem+json` and uses `detail` (or `title`) as the message.

`src/api/gym.mts` exposes typed functions for the gym endpoints. It maps the HTTP
contract to UI types and returns `Page<T>` for list endpoints. `getActiveSession`
returns `null` for a `404`.

### 4.5 PWA

- `vite-plugin-pwa` with `registerType: "autoUpdate"`.
- Manifest: name, short name, theme color, background color, 192/512 icons, a maskable
  icon, and an Apple touch icon (`apps/web/public/`).
- `src/pwa.test.mts` fails when a manifest icon or the Apple touch icon is missing or
  has a size that does not match its declaration.
- The service worker caches the app shell. There is no offline data store, background
  sync, or offline mutation queue (ADR-0012).

### 4.6 Testing and Type Checking

- Component tests use `@testing-library/svelte` and render with
  `render(Component, { props })`.
- API client tests are framework-free fetch tests.
- `svelte-check --tsconfig ./tsconfig.json` is the web typecheck gate.
- The root typecheck runs the API, shared, and web checks separately.

---

## 5. Shared Contracts

`packages/shared` is the single source of truth for data contracts (ADR-0005):

- Zod schemas for exercises, workout plans, sessions, sets, nutrition, and recipes.
- Inferred TypeScript types exported from the same files.
- No imports from `apps/*`.
- Source files use `.mts`; package `main`, `types`, and `exports` point to
  `./src/index.mts`.

Routers compose request DTOs from these schemas. The web client uses the same types, so
API and UI cannot drift.

---

## 6. Conventions

- TypeScript source and test files use `.mts` with explicit `.mts` imports.
- Tool configuration files (`vite.config.ts`, `vitest.config.ts`, `oxlint.config.ts`)
  stay `.ts`.
- Svelte components use `.svelte`; plain TypeScript modules use `.mts`.
- TypeScript is strict, with `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`,
  `noImplicitOverride`, and `verbatimModuleSyntax` (ADR-0002).
- Code is self-documenting. Comments explain non-obvious logic only (AGENTS.md).
- No raw SQL; Prisma is the only database access layer (ADR-0007).
- No cross-module imports; shared code goes to `src/lib/` or `packages/shared`
  (ADR-0006).

---

## 7. Testing and Verification

Two test tiers:

1. **Unit tests** live next to services (`*.test.mts`) and use mocked repositories.
2. **Integration tests** live under `test/integration/`: HTTP tests in `rest/` call the
   exported Hono app with a seeded PostgreSQL test user, and `seed.test.mts` spawns the
   seed script and checks the database.

Required regression coverage (ADR-0018):

- Five parallel set posts produce unique, contiguous set numbers or a `409`.
- A log-vs-complete race never leaves a set on a completed session.
- Two-user isolation: user B gets `404` for user A's session and plans.
- Pagination metadata for empty and non-empty pages.
- Problem-details shape for `404`, `409`, and `422`.
- Rotation suggestions: wrap-around, deviations, ignored free workouts, missing plans,
  and empty history (ADR-0026).
- Progress analytics: personal records by weight, then reps, then newest set; per-session
  volume; active sessions excluded (ADR-0032).
- History filters by plan and start-date range, and session detail includes sets, targets,
  and completion time (ADR-0032).

Verification commands:

```bash
bun run typecheck
bun run lint:all
bun run test
bun run build
```

Integration tests require PostgreSQL (`bun run db:up`). Service unit tests run without a
database.

---

## 8. Non-Goals

The target architecture deliberately excludes:

- **GraphQL.** The API is REST with Zod contracts (ADR-0003).
- **Keycloak, JWT, and role-based access.** The MVP is single-user (ADR-0009).
- **ETag, `If-Match`, and resource versioning.** Concurrency is handled by serializable
  transactions and `409` (ADR-0011, ADR-0015).
- **`Accept` negotiation and `406`.** GymOS has a single JSON representation.
- **TOML configuration.** `config/env.mts` is the single configuration source.
- **File logging.** Containers log to stdout.
- **Application-level TLS.** The reverse proxy/ingress terminates TLS (ADR-0008).
- **Mail notifications.** No notification feature exists.
- **A dev HTTP router.** Seeding and tests use scripts and helpers.
- **Offline data synchronization and multi-user accounts.** Deferred (ADR-0009,
  ADR-0012).

---

## 9. Decision Index

| ADR | Decision |
|---|---|
| [0001](adr/0001-monorepo-structure.md) | Monorepo with Bun workspaces |
| [0002](adr/0002-full-stack-typescript-bun.md) | TypeScript and Bun across the stack |
| [0003](adr/0003-backend-hono-zod.md) | Hono and Zod for the API |
| [0004](adr/0004-frontend-react-vite-pwa.md) | Superseded by ADR-0014 |
| [0005](adr/0005-shared-schemas-package.md) | Shared Zod schemas |
| [0006](adr/0006-modular-feature-architecture.md) | Modular feature architecture |
| [0007](adr/0007-database-postgresql-prisma.md) | PostgreSQL and Prisma |
| [0008](adr/0008-deployment-docker-k3s.md) | Docker and K3s deployment |
| [0009](adr/0009-single-user-mvp.md) | Single-user MVP without authentication |
| [0010](adr/0010-workout-plans-and-sessions.md) | Plans as templates, sessions as records |
| [0011](adr/0011-workout-concurrency-serializable-transactions.md) | Serializable transactions |
| [0012](adr/0012-mvp-constraints-online-only-css-english.md) | Online-only, plain CSS, English UI |
| [0013](adr/0013-backend-layering.md) | Backend layering and module structure |
| [0014](adr/0014-frontend-svelte-vite-pwa.md) | Svelte 5 and Vite PWA |
| [0015](adr/0015-api-error-and-response-contract.md) | Error model, pagination, response contract |
| [0016](adr/0016-runtime-configuration-and-observability.md) | Configuration, logging, health, metrics |
| [0017](adr/0017-validation-limits-and-unimplemented-features.md) | Input limits and 501 stubs |
| [0018](adr/0018-testing-strategy.md) | Testing strategy and required coverage |
| [0019](adr/0019-session-ui-behavior.md) | Session screen behavior |
| [0020](adr/0020-warm-light-ui-theme.md) | Warm light UI theme |
| [0021](adr/0021-reject-invalid-muscle-groups.md) | Reject invalid muscle groups on read |
| [0022](adr/0022-workout-set-reps-and-weight-limits.md) | Workout set reps and weight limits |
| [0023](adr/0023-seed-configured-current-user.md) | Seed the configured current user |
| [0024](adr/0024-exercise-register-soft-delete.md) | Exercise register with soft delete |
| [0025](adr/0025-plan-editing-and-deletion.md) | Plan editing and deletion |
| [0026](adr/0026-workout-rotation.md) | Workout rotation and next-workout suggestion |
| [0027](adr/0027-gym-start-screen-hierarchy.md) | Gym start screen hierarchy |
| [0028](adr/0028-alternate-workout-picker.md) | Alternate workout picker |
| [0029](adr/0029-inline-set-logging.md) | Inline set logging in exercise cards |
| [0030](adr/0030-suggested-set-weight.md) | Suggested set weight as a placeholder |
| [0031](adr/0031-remove-rpe.md) | Remove RPE from set logging |
| [0032](adr/0032-workout-history-and-progress.md) | Workout history and progress analytics |
| [0033](adr/0033-collapsed-history-section.md) | Collapsed history section |
| [0034](adr/0034-gym-accessibility-names-alerts-focus.md) | Gym accessibility names, alerts, and focus |
| [0035](adr/0035-deployment-pipeline-and-tailnet-access.md) | Deployment pipeline and tailnet access |
| [0036](adr/0036-session-bar-and-rest-timer.md) | Session bar and rest timer |
| [0037](adr/0037-delete-logged-set.md) | Delete a logged set during an active workout |
