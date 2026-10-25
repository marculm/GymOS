# GymOS 🏋️

An all-in-one Gym & Nutrition Operating System designed for mobile-first workout tracking, mealprep management, and recipe extraction.

Built as a TypeScript Monorepo powered by **Bun**, **Hono**, **React (Vite PWA)**, and **PostgreSQL (Prisma)**.

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
   bun run db:seed       # Populates default exercises & demo user
   ```

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
| `bun run test` | Runs all Vitest suites (API & Web) in parallel |
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
│   └── adr/             # Architecture Decision Records (MADR format)
├── AGENTS.md            # Guidelines and rules for AI pair programming
└── .env.example         # Template for environment variables
```
