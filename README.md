# GymOS 🏋️

An all-in-one Gym & Nutrition Operating System designed for mobile-first workout tracking, mealprep management, and recipe extraction.

Built as a TypeScript Monorepo powered by **Bun**, **Hono**, **Svelte 5 (Vite PWA)**, and **PostgreSQL (Prisma)**.

---

## Current Status

The **Gym Tracker** slice is implemented:

- Manage the exercise register: create, edit, and soft-delete exercises with default
  sets, reps, and weight
- Browse exercises and training plans
- Create plans with target sets, reps, and optional weight (prefilled from exercise
  defaults)
- Start free or plan-based workouts
- Log sets with weight, reps, and RPE
- Finish workouts and review recent history

Nutrition, the AI recipe extractor, authentication, and offline logging are not implemented yet. The API is single-user (no login) and must be protected before public deployment. See [`docs/known-issues.md`](docs/known-issues.md) for known limitations.

---

## Prerequisites

* **[Bun](https://bun.com)** (v1.4.3+)
* **[Docker](https://www.docker.com/)** (for local PostgreSQL database)

---

## Quickstart

1. **Clone & install dependencies:**
   ```bash
   bun install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *(Adjust passwords/ports in `.env` if needed).*

3. **Start local database & seed data:**
   ```bash
   bun run db:up         # Starts PostgreSQL 17 in Docker (Port 5433)
   bun run db:migrate    # Applies Prisma migrations
   bun run db:seed       # Populates exercises, the configured owner & Push Day plan
   ```

   The seed provisions the user configured by `GYMOS_USER_EMAIL` (default `demo@gymos.app`), including the starter Push Day plan. To provision a custom owner, set `GYMOS_USER_EMAIL` in `.env` before running the seed (ADR-0023).

4. **Start development servers:**
   ```bash
   bun run dev
   ```
   * **Web App (PWA):** [http://localhost:5173](http://localhost:5173)
   * **API Server:** [http://localhost:3000](http://localhost:3000)

---

## Scripts

### Development & Running

| Command | Description |
| :--- | :--- |
| `bun run dev` | Starts API (`:3000`) and Web (`:5173`) concurrently |
| `bun run dev:api` | Starts only the Hono API server with hot-reload |
| `bun run dev:web` | Starts only the Vite frontend dev server |
| `bun run build` | Builds the frontend PWA for production |

### Testing (Vitest)

| Command | Description |
| :--- | :--- |
| `bun run test` | Runs all Vitest suites (API, Web, Shared) in parallel |
| `bun run test:watch` | Runs Vitest in interactive watch mode |

### Database Management (PostgreSQL & Prisma)

| Command | Description |
| :--- | :--- |
| `bun run db:up` | Starts the PostgreSQL Docker container |
| `bun run db:down` | Stops the PostgreSQL container |
| `bun run db:migrate` | Runs pending Prisma migrations |
| `bun run db:seed` | Seeds exercises, the configured owner, and a Push Day plan |
| `bun run db:studio` | Opens Prisma Studio GUI at [http://localhost:5555](http://localhost:5555) |

### Code Quality & Validation

| Command | Description |
| :--- | :--- |
| `bun run typecheck` | Validates API/shared with `bun check` and the web app with `svelte-check` |
| `bun run lint:all` | Runs `oxlint` and the architectural ADR linter |
| `bun run lint:adr` | Validates MADR format compliance in `docs/adr/` |

---

## Gym API

All routes are under `/api/gym` and validate their input with Zod. List routes accept
`page` and `size` and return `{ content, page }`. Errors use RFC 9457 Problem Details
(`application/problem+json`). See [`docs/architecture.md`](docs/architecture.md) for the
full contract.

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/gym/exercises?page=&size=` | List active exercises as a page |
| `POST` | `/api/gym/exercises` | Create an exercise (`{ name, muscleGroup, description?, defaultSets?, defaultReps?, defaultWeightKg? }`); `201` + `Location` |
| `PUT` | `/api/gym/exercises/:id` | Edit an exercise; omitted optional fields are preserved |
| `DELETE` | `/api/gym/exercises/:id` | Soft-delete an exercise |
| `GET` | `/api/gym/plans?page=&size=&name=` | List the current user's plans |
| `POST` | `/api/gym/plans` | Create a plan (`{ name, description?, exercises[] }`); `201` + `Location` |
| `PUT` | `/api/gym/plans/:id` | Replace a plan's name, description, and exercises |
| `DELETE` | `/api/gym/plans/:id` | Delete a plan; past sessions keep their records |
| `GET` | `/api/gym/rotation` | Rotation with `plans` and `nextPlanId` |
| `PUT` | `/api/gym/rotation` | Replace the ordered rotation (`{ planIds[] }`); empty clears it |
| `POST` | `/api/gym/sessions` | Start a session (`{ title?, planId? }`); `201` + `Location` |
| `GET` | `/api/gym/sessions/active` | Active session, or `404` when none exists |
| `GET` | `/api/gym/sessions?page=&size=&planId=&from=&to=` | List completed sessions |
| `GET` | `/api/gym/sessions/:id` | Get a session with its sets |
| `POST` | `/api/gym/sessions/:id/sets` | Log a set (`{ exerciseId, reps, weightKg, rpe? }`) |
| `POST` | `/api/gym/sessions/:id/complete` | Finish a session |

`GET /health/liveness`, `GET /health/readiness`, and `GET /prometheus` are available for
operations. There is no authentication; the API resolves a single user from
`GYMOS_USER_EMAIL` (ADR-0009).

---

## Repository Structure

```
GymOS/
├── apps/
│   ├── api/             # Backend service (Hono, Prisma, Pino logging)
│   └── web/             # Frontend app (Svelte 5, Vite, PWA, Lucide icons)
├── packages/
│   └── shared/          # Shared Zod schemas, domain types, constants
├── deploy/
│   └── docker/          # Docker Compose configurations (PostgreSQL)
├── docs/
│   ├── adr/             # Architecture Decision Records (MADR format)
│   └── known-issues.md  # Known limitations and deferred work
├── AGENTS.md            # Guidelines and rules for AI pair programming
└── .env.example         # Template for environment variables
```
