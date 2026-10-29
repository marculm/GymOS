# GymOS 🏋️

An all-in-one Gym & Nutrition Operating System designed for mobile-first workout tracking, mealprep management, and recipe extraction.

Built as a TypeScript Monorepo powered by **Bun**, **Hono**, **React (Vite PWA)**, and **PostgreSQL (Prisma)**.

---

## Current Status

The **Gym Tracker** slice is implemented on `feature/gym-tracker`:

- Browse exercises and training plans
- Create plans with target sets, reps, and optional weight
- Start free or plan-based workouts
- Log sets with weight, reps, and RPE
- Finish workouts and review recent history

Nutrition, the AI recipe extractor, authentication, and offline logging are not implemented yet. The API is single-user (no login) and must be protected before public deployment. See [`docs/known-issues.md`](docs/known-issues.md) for known limitations.

---

## Prerequisites

* **[Bun](https://bun.com)** (v1.2+)
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
   bun run db:seed       # Populates exercises, demo user & Push Day plan
   ```

   The seed provisions `demo@gymos.app`. The API resolves the current user from `GYMOS_USER_EMAIL` (default `demo@gymos.app`); see [`docs/known-issues.md`](docs/known-issues.md) before changing it.

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
| `bun run db:seed` | Seeds the database with default exercises |
| `bun run db:studio` | Opens Prisma Studio GUI at [http://localhost:5555](http://localhost:5555) |

### Code Quality & Validation

| Command | Description |
| :--- | :--- |
| `bun run typecheck` | Validates TypeScript across all workspaces (`bun check`) |
| `bun run lint:all` | Runs `oxlint` and the architectural ADR linter |
| `bun run lint:adr` | Validates MADR format compliance in `docs/adr/` |

---

## Gym API

All routes are under `/api/gym` and validate their input with Zod. Errors use `{ "error": "..." }`.

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/gym/exercises` | List exercises |
| `GET` | `/api/gym/plans` | List the current user's plans |
| `POST` | `/api/gym/plans` | Create a plan (`{ name, description?, exercises[] }`) |
| `POST` | `/api/gym/sessions` | Start a session (`{ title?, planId? }`) |
| `GET` | `/api/gym/sessions/active` | Get the active session or `null` |
| `GET` | `/api/gym/sessions?limit=10` | List completed sessions |
| `GET` | `/api/gym/sessions/:id` | Get a session with its sets |
| `POST` | `/api/gym/sessions/:id/sets` | Log a set (`{ exerciseId, reps, weightKg, rpe? }`) |
| `POST` | `/api/gym/sessions/:id/complete` | Finish a session |

There is no authentication; the API resolves a single user from `GYMOS_USER_EMAIL` (ADR-0009).

---

## Repository Structure

```
GymOS/
├── apps/
│   ├── api/             # Backend service (Hono, Prisma, Pino logging)
│   └── web/             # Frontend app (React, Vite, PWA, Lucide icons)
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
