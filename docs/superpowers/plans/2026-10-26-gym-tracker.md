# Gym Tracker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first end-to-end GymOS slice: create training plans, start free or plan-based sessions, log sets, and review history on a mobile-first PWA.

**Architecture:** Add `WorkoutPlan` / `WorkoutPlanExercise` templates and a nullable `planId` on sessions. Split the Hono gym module into routes, service, and Prisma repository; the service returns DTOs typed by shared Zod contracts. The React app gets a typed API client and a CSS-only Gym view with overview, plan form, and active-session screens.

**Tech Stack:** Bun, TypeScript (strict), Hono 4, Prisma 6 + PostgreSQL, Zod 4, React 19 + Vite 6 PWA, Vitest 4, plain CSS.

**Spec:** The binding decisions are recorded in ADR-0009, ADR-0010, ADR-0011, and ADR-0012, plus the Global Constraints below. The original scratch vision file (`tmp/design.txt`) was removed on 2026-10-26 and is not part of the repository.

## Global Constraints

- **Single user, no authentication.** Resolve the user from `process.env.GYMOS_USER_EMAIL`, default `demo@gymos.app`. Every plan/session query filters by `userId`.
- **Online-only.** Do not add IndexedDB, background sync, or offline mutation queues. The existing PWA shell caching stays as-is.
- **Styling is plain CSS with CSS variables.** No Tailwind, CSS-in-JS, or component library.
- **API contracts live in `packages/shared`; Prisma models remain storage.** Map explicitly at the module boundary. The web app never imports Prisma types.
- **All request bodies and query parameters are validated with Zod** via Hono middleware. No unvalidated `await c.req.json()`.
- **Database access only through Prisma inside `modules/*/repository.ts`.** No raw SQL, no Prisma calls in route handlers.
- **Only one active session per user** (`completedAt === null`).
- **Set numbers are per exercise within a session** and start at 1.
- **UI copy stays English**, matching the existing app. Weights are in kg.
- **Never read or modify `.env` files**; update `.env.example` only. **Never run `git push`.**
- **Commits are small and use `Add|Update|Remove|Move|Fix <target>`.** Run them only when the human explicitly authorizes commits.
- Before a task is done: `bun run typecheck`, `bun run lint:all`, and the task's tests pass.

## Review Focus

1. Starting a second session while one is active → `409`, and the UI shows/resumes the active session (Task 5 tests, Task 9 UI).
2. Logging a set on a completed session → `409`; the UI must not allow it (Task 5, Task 9).
3. Unknown exercise IDs in a plan or set → `400` with a readable error, never a Prisma `500` (Task 4, Task 5).
4. Duplicate plan names for the same user → `409`, surfaced in the UI (Task 4, Task 8).
5. API unavailable while opening the Gym tab → visible error state with a retry, no blank screen or lost active session (Task 8).

---

### Task 1: Record MVP decisions and repair docs

**Files:**
- Create: `docs/adr/0009-single-user-mvp.md`
- Create: `docs/adr/0010-workout-plans-and-sessions.md`
- Modify: `docs/adr/0000-use-madr.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: accepted ADRs referenced by later tasks; a working root `bun run build`.

- [ ] **Step 1: Write `docs/adr/0009-single-user-mvp.md`**

Use the MADR sections required by `AGENTS.md`. The decision section must state:

```markdown
## Decision

GymOS is a single-user application for its MVP. The API resolves the current
user from `GYMOS_USER_EMAIL`, defaulting to `demo@gymos.app`. There is no login,
session cookie, or password handling. Every feature query is still scoped by
`userId` so authentication can be added later without a data migration.

Public deployment requires an access gate (reverse-proxy basic auth or an
application-level login) before the API is exposed to the internet.
```

Consequences must mention: tests use a unique user per test file via the same env override; adding auth later only replaces `getCurrentUser`.

- [ ] **Step 2: Write `docs/adr/0010-workout-plans-and-sessions.md`**

The decision section must state:

```markdown
## Decision

- `WorkoutPlan` and `WorkoutPlanExercise` store reusable targets: exercise,
  position, target sets, target reps, and an optional target weight.
- `WorkoutSession` optionally references a plan (`planId`, `onDelete: SetNull`).
  Sessions store their own title, start time, and completion time.
- Logged `WorkoutSet` rows are independent records. Editing or deleting a plan
  later must never rewrite past sessions.
- A user has at most one active session (`completedAt IS NULL`).
- Set numbers are assigned per exercise within a session, starting at 1, and
  enforced by a unique constraint.
```

Consequences must mention: stable history without plan versioning; plan editing/deletion can be added later without touching historical sets.

- [ ] **Step 3: Fix the stale script name in ADR-0000**

In `docs/adr/0000-use-madr.md`, replace every `lint:arch` with `lint:adr`.

- [ ] **Step 4: Add the missing root build script**

In the root `package.json` `scripts` block, add:

```json
"build": "bun --filter @gymos/web build",
```

- [ ] **Step 5: Verify ADR and build**

Run: `bun run lint:adr`
Expected: `All 13 ADR(s) conform to MADR format.`

Run: `bun run build`
Expected: Vite build completes with exit code 0.

- [ ] **Step 6: Commit (only if the human authorized commits)**

```bash
git add docs/adr/0000-use-madr.md docs/adr/0009-single-user-mvp.md docs/adr/0010-workout-plans-and-sessions.md
git commit -m "Add MVP architecture decisions"
git add package.json
git commit -m "Fix build script"
```

---

### Task 2: Add workout plan models and seed data

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/seed.ts`
- Create: `apps/api/prisma/migrations/<timestamp>_add_workout_plans/migration.sql` (generated)
- Modify: `apps/api/.env.example`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma delegates `prisma.workoutPlan` / `prisma.workoutPlanExercise`; `WorkoutSession.planId: string | null`; compound unique `(workoutSessionId, exerciseId, setNumber)`; a seeded `Push Day` plan for `demo@gymos.app` with 3 exercises.

- [ ] **Step 1: Extend the Prisma schema**

Add to `model User`:

```prisma
plans WorkoutPlan[]
```

Add to `model Exercise`:

```prisma
planExercises WorkoutPlanExercise[]
```

Add to `model WorkoutSession`:

```prisma
planId String?
plan   WorkoutPlan? @relation(fields: [planId], references: [id], onDelete: SetNull)

@@index([userId, completedAt])
```

Add to `model WorkoutSet`:

```prisma
@@unique([workoutSessionId, exerciseId, setNumber])
```

Add the new models:

```prisma
model WorkoutPlan {
  id          String                @id @default(uuid())
  userId      String
  user        User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt
  exercises   WorkoutPlanExercise[]
  sessions    WorkoutSession[]

  @@unique([userId, name])
  @@map("workout_plans")
}

model WorkoutPlanExercise {
  id             String      @id @default(uuid())
  planId         String
  plan           WorkoutPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  exerciseId     String
  exercise       Exercise    @relation(fields: [exerciseId], references: [id], onDelete: Restrict)
  position       Int
  targetSets     Int
  targetReps     Int
  targetWeightKg Float?
  notes          String?

  @@unique([planId, position])
  @@map("workout_plan_exercises")
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `cd apps/api && bunx prisma migrate dev --name add_workout_plans`
Expected: migration created under `apps/api/prisma/migrations/`, applied, and Prisma Client regenerated.

If the migration fails because existing `workout_sets` rows contain duplicate `(workoutSessionId, exerciseId, setNumber)` combinations, clear the local `workout_sets` table first; this is development-only data.

- [ ] **Step 3: Seed a demo plan**

In `apps/api/prisma/seed.ts`, collect the upserted exercises in a `Map<string, { id: string }>` named `exercisesByName`. Add a `requireExercise(name)` helper that throws when the map entry is missing (do not use non-null assertions).

After seeding the exercises, upsert:

```ts
const pushDay = await prisma.workoutPlan.upsert({
  where: { userId_name: { userId: demoUser.id, name: "Push Day" } },
  update: {},
  create: {
    userId: demoUser.id,
    name: "Push Day",
    description: "Chest, shoulders, and triceps",
    exercises: {
      create: [
        { exerciseId: requireExercise("Barbell Bench Press").id, position: 0, targetSets: 4, targetReps: 8, targetWeightKg: 80 },
        { exerciseId: requireExercise("Overhead Shoulder Press").id, position: 1, targetSets: 3, targetReps: 10, targetWeightKg: 40 },
        { exerciseId: requireExercise("Tricep Rope Pushdown").id, position: 2, targetSets: 3, targetReps: 12 },
      ],
    },
  },
});
console.log(`🏋️ Demo plan: ${pushDay.name}`);
```

- [ ] **Step 4: Add the user override to env templates**

Append to both `.env.example` and `apps/api/.env.example`:

```bash
# Current user (single-user MVP)
GYMOS_USER_EMAIL=demo@gymos.app
```

- [ ] **Step 5: Run the seed and verify**

Run: `bun run db:seed`
Expected: output contains `Demo plan: Push Day`.

Run:

```bash
cd apps/api && bun -e 'import { PrismaClient } from "@prisma/client"; const p = new PrismaClient(); const plan = await p.workoutPlan.findFirst({ include: { exercises: true } }); console.log(plan?.name, plan?.exercises.length); await p.$disconnect();'
```

Expected: `Push Day 3`.

- [ ] **Step 6: Commit (only if authorized)**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/seed.ts apps/api/prisma/migrations .env.example apps/api/.env.example
git commit -m "Add workout plan models"
```

---

### Task 3: Define shared workout contracts

**Files:**
- Modify: `packages/shared/src/schemas/workout.ts`
- Create: `packages/shared/src/schemas/workout.test.ts`
- Create: `packages/shared/vitest.config.ts`
- Modify: `vitest.config.ts`
- Modify: `packages/shared/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces these exports from `@gymos/shared`:

```ts
Exercise
CreateWorkoutPlanInput
WorkoutPlan
WorkoutPlanExercise
CreateWorkoutSessionInput
CreateWorkoutSetInput
LoggedSet
WorkoutSessionDetail
WorkoutSessionSummary
```

- [ ] **Step 1: Add the shared test project**

Create `packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

Add `"packages/shared/vitest.config.ts"` to the `test.projects` array in the root `vitest.config.ts`.

In `packages/shared/package.json`, add:

```json
"scripts": { "test": "vitest run" },
"devDependencies": { "vitest": "^4.1.11" }
```

Run `bun install` after editing the package file.

- [ ] **Step 2: Write the failing schema tests**

Create `packages/shared/src/schemas/workout.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import {
  CreateWorkoutPlanSchema,
  CreateWorkoutSetSchema,
  WorkoutSessionDetailSchema,
} from "./workout.ts";

describe("CreateWorkoutPlanSchema", () => {
  it("accepts a plan with one exercise", () => {
    const result = CreateWorkoutPlanSchema.safeParse({
      name: "Push Day",
      exercises: [{ exerciseId: "00000000-0000-4000-8000-000000000001", targetSets: 4, targetReps: 8 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty exercise list", () => {
    expect(CreateWorkoutPlanSchema.safeParse({ name: "Empty", exercises: [] }).success).toBe(false);
  });
});

describe("CreateWorkoutSetSchema", () => {
  it("accepts bodyweight sets with zero weight", () => {
    const result = CreateWorkoutSetSchema.safeParse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 10,
      weightKg: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects RPE above 10", () => {
    const result = CreateWorkoutSetSchema.safeParse({
      exerciseId: "00000000-0000-4000-8000-000000000001",
      reps: 10,
      weightKg: 20,
      rpe: 11,
    });
    expect(result.success).toBe(false);
  });
});

describe("WorkoutSessionDetailSchema", () => {
  it("accepts ISO timestamps and a null completion time", () => {
    const result = WorkoutSessionDetailSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000002",
      title: "Push Day",
      planId: null,
      startedAt: "2026-10-26T18:00:00.000Z",
      completedAt: null,
      sets: [],
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun --filter @gymos/shared test`
Expected: FAIL because the new exports do not exist.

- [ ] **Step 4: Implement the contracts**

Replace the contents of `packages/shared/src/schemas/workout.ts` with:

```ts
import { z } from "zod";

export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  muscleGroup: z.enum(["chest", "back", "legs", "shoulders", "arms", "core"]),
  description: z.string().nullable(),
});

export const CreateWorkoutPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().uuid(),
        targetSets: z.number().int().positive(),
        targetReps: z.number().int().positive(),
        targetWeightKg: z.number().nonnegative().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1),
});

export const WorkoutPlanExerciseSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  targetSets: z.number().int().positive(),
  targetReps: z.number().int().positive(),
  targetWeightKg: z.number().nonnegative().nullable(),
  notes: z.string().nullable(),
  exercise: ExerciseSchema,
});

export const WorkoutPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  exercises: z.array(WorkoutPlanExerciseSchema),
});

export const CreateWorkoutSessionSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  planId: z.string().uuid().optional(),
});

export const CreateWorkoutSetSchema = z.object({
  exerciseId: z.string().uuid(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).optional(),
});

export const LoggedSetSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).nullable(),
  createdAt: z.iso.datetime(),
});

export const WorkoutSessionDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  planId: z.string().uuid().nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  sets: z.array(LoggedSetSchema),
});

export const WorkoutSessionSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  planId: z.string().uuid().nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  totalSets: z.number().int().nonnegative(),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type CreateWorkoutPlanInput = z.infer<typeof CreateWorkoutPlanSchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
export type WorkoutPlanExercise = z.infer<typeof WorkoutPlanExerciseSchema>;
export type CreateWorkoutSessionInput = z.infer<typeof CreateWorkoutSessionSchema>;
export type CreateWorkoutSetInput = z.infer<typeof CreateWorkoutSetSchema>;
export type LoggedSet = z.infer<typeof LoggedSetSchema>;
export type WorkoutSessionDetail = z.infer<typeof WorkoutSessionDetailSchema>;
export type WorkoutSessionSummary = z.infer<typeof WorkoutSessionSummarySchema>;
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `bun --filter @gymos/shared test`
Expected: PASS.

Run: `bun run typecheck`
Expected: no type errors.

- [ ] **Step 6: Commit (only if authorized)**

```bash
git add packages/shared vitest.config.ts
git commit -m "Add workout plan and session schemas"
```

---

### Task 4: Add gym plan endpoints

**Files:**
- Create: `apps/api/src/lib/current-user.ts`
- Create: `apps/api/src/lib/validation.ts`
- Create: `apps/api/src/modules/gym/repository.ts`
- Create: `apps/api/src/modules/gym/service.ts`
- Modify: `apps/api/src/modules/gym/index.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/test/helpers.ts`
- Create: `apps/api/test/gym-plans.test.ts`

**Interfaces:**
- Consumes: `CreateWorkoutPlanSchema`, `WorkoutPlan`, `Exercise` from `@gymos/shared`.
- Produces:
  - `GET /api/gym/exercises` → `{ exercises: Exercise[] }`
  - `GET /api/gym/plans` → `{ plans: WorkoutPlan[] }`
  - `POST /api/gym/plans` → `{ plan: WorkoutPlan }` (201)
  - Error body: `{ error: string, issues?: unknown[] }`
  - `getCurrentUser(): Promise<{ id: string; email: string; name: string }>`
  - `zJson(schema)` / `zQuery(schema)` Hono middleware factories.

- [ ] **Step 1: Write the failing plan tests**

Create `apps/api/test/helpers.ts`:

```ts
import { prisma } from "../src/db/client.ts";

export const TEST_EMAIL = `test-${crypto.randomUUID()}@gymos.app`;
let testUserId: string | null = null;

export async function createTestUser() {
  process.env.GYMOS_USER_EMAIL = TEST_EMAIL;
  const user = await prisma.user.create({ data: { email: TEST_EMAIL, name: "Test User" } });
  testUserId = user.id;
}

export async function clearTestUserData() {
  if (!testUserId) return;
  await prisma.workoutSession.deleteMany({ where: { userId: testUserId } });
  await prisma.workoutPlan.deleteMany({ where: { userId: testUserId } });
}

export async function cleanupTestUser() {
  if (testUserId) {
    await prisma.user.deleteMany({ where: { id: testUserId } });
  }
  delete process.env.GYMOS_USER_EMAIL;
  await prisma.$disconnect();
}

export async function firstExercise() {
  return prisma.exercise.findFirstOrThrow({ orderBy: { name: "asc" } });
}
```

Create `apps/api/test/gym-plans.test.ts` covering:

1. `POST /api/gym/plans` with a valid body returns 201 and echoes the plan with one exercise.
2. `GET /api/gym/plans` includes the created plan.
3. `POST /api/gym/plans` with `exercises: []` returns 400.
4. `POST /api/gym/plans` with an unknown exercise UUID returns 400.
5. Posting the same plan name twice returns 409 for the second request.

Use `beforeAll(createTestUser)`, `beforeEach(clearTestUserData)`, and `afterAll(cleanupTestUser)`. Use `firstExercise()` for a real exercise ID. Send JSON requests with `headers: { "Content-Type": "application/json" }`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --filter @gymos/api test`
Expected: the new plan tests fail with 404 responses.

- [ ] **Step 3: Implement the current-user and validation helpers**

`apps/api/src/lib/current-user.ts`:

```ts
import { HTTPException } from "hono/http-exception";
import { prisma } from "../db/client.ts";

const DEFAULT_USER_EMAIL = "demo@gymos.app";

export async function getCurrentUser() {
  const email = process.env.GYMOS_USER_EMAIL ?? DEFAULT_USER_EMAIL;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HTTPException(500, {
      message: `User ${email} not found. Run bun run db:seed.`,
    });
  }
  return user;
}
```

`apps/api/src/lib/validation.ts`:

```ts
import { validator } from "hono/validator";
import type { z } from "zod";

export function zJson<T extends z.ZodType>(schema: T) {
  return validator("json", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
    }
    return parsed.data;
  });
}

export function zQuery<T extends z.ZodType>(schema: T) {
  return validator("query", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: "Invalid query parameters", issues: parsed.error.issues }, 400);
    }
    return parsed.data;
  });
}
```

- [ ] **Step 4: Implement repository and service for plans and exercises**

Repository responsibilities:

```ts
findExercises(): Promise<Exercise[]>
findPlansByUser(userId: string): Promise<WorkoutPlan[]>
findPlanById(userId: string, planId: string): Promise<WorkoutPlan | null>
createPlanWithExercises(userId: string, input: CreateWorkoutPlanInput): Promise<WorkoutPlan>
findExerciseIds(ids: string[]): Promise<string[]>
```

Rules:
- `findExercises` orders by `name` and returns only `{ id, name, muscleGroup, description }` (cast `muscleGroup` to `Exercise["muscleGroup"]`); do not return `createdAt`.
- `findPlansByUser` includes `exercises` with `exercise`, ordered by `position`, and maps dates with `.toISOString()`.
- `createPlanWithExercises` assigns `position` from the array index, stores optional fields as `null`, and returns the mapped plan.
- `findExerciseIds` returns the subset of IDs that exist.

Service responsibilities:

```ts
listExercises(): Promise<Exercise[]>
listPlans(): Promise<WorkoutPlan[]>
createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan>
```

Rules:
- `createPlan` resolves the current user, rejects unknown exercise IDs with `HTTPException(400, { message: "Unknown exercise IDs: ..." })`, and maps Prisma `P2002` (unique plan name) to `HTTPException(409, { message: "A plan with this name already exists" })`.
- Catch `Prisma.PrismaClientKnownRequestError` for `P2002`.

- [ ] **Step 5: Wire the routes and error handler**

In `apps/api/src/modules/gym/index.ts`, keep the router but move logic into `service.ts`:

```ts
gymModule.get("/exercises", async (c) => c.json({ exercises: await listExercises() }));

gymModule.get("/plans", async (c) => c.json({ plans: await listPlans() }));

gymModule.post("/plans", zJson(CreateWorkoutPlanSchema), async (c) => {
  const plan = await createPlan(c.req.valid("json"));
  return c.json({ plan }, 201);
});
```

In `apps/api/src/index.ts`, add before the routes:

```ts
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  logger.error({ err }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --filter @gymos/api test`
Expected: all API tests pass, including the existing `/health` and `/exercises` tests.

- [ ] **Step 7: Commit (only if authorized)**

```bash
git add apps/api/src/lib apps/api/src/modules/gym apps/api/src/index.ts apps/api/test
git commit -m "Add gym plan routes"
```

---

### Task 5: Add gym session and set endpoints

**Files:**
- Modify: `apps/api/src/modules/gym/repository.ts`
- Modify: `apps/api/src/modules/gym/service.ts`
- Modify: `apps/api/src/modules/gym/index.ts`
- Create: `apps/api/test/gym-sessions.test.ts`

**Interfaces:**
- Consumes: the helpers and plan endpoints from Task 4; shared types from Task 3.
- Produces:
  - `POST /api/gym/sessions` body `CreateWorkoutSessionInput` → `{ session: WorkoutSessionDetail }` (201)
  - `GET /api/gym/sessions/active` → `{ session: WorkoutSessionDetail | null }`
  - `GET /api/gym/sessions?limit=10` → `{ sessions: WorkoutSessionSummary[] }`
  - `GET /api/gym/sessions/:id` → `{ session: WorkoutSessionDetail }`
  - `POST /api/gym/sessions/:id/sets` body `CreateWorkoutSetInput` → `{ set: LoggedSet }` (201)
  - `POST /api/gym/sessions/:id/complete` → `{ session: WorkoutSessionDetail }`

- [ ] **Step 1: Write the failing session tests**

Create `apps/api/test/gym-sessions.test.ts` covering:

1. Starting a free session with `{}` returns 201, title `Free Workout`, `planId: null`.
2. Starting a second session while one is active returns 409.
3. Starting a session with a plan returns the plan name as the title and the `planId`.
4. Logging a set returns `setNumber: 1`; logging another set for the same exercise returns `setNumber: 2`.
5. Logging a set on a completed session returns 409.
6. Logging a set with an unknown exercise ID returns 400.
7. Completing a session sets `completedAt`; `GET /sessions/active` then returns `{ session: null }`.
8. `GET /sessions` returns the completed session with `totalSets` and excludes the active session.
9. `GET /sessions/:id` returns the logged sets.
10. A request for an unknown session ID returns 404.

Use `beforeAll(createTestUser)` and `afterAll(cleanupTestUser)` from `test/helpers.ts`. Create the plan through `POST /api/gym/plans`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --filter @gymos/api test`
Expected: the session tests fail with 404 responses.

- [ ] **Step 3: Implement repository functions**

Add:

```ts
findActiveSession(userId: string): Promise<WorkoutSessionDetail | null>
findSessionById(userId: string, sessionId: string): Promise<WorkoutSessionDetail | null>
findRecentSessions(userId: string, limit: number): Promise<WorkoutSessionSummary[]>
createSession(userId: string, input: { title: string; planId: string | null }): Promise<WorkoutSessionDetail>
createSet(sessionId: string, input: { exerciseId: string; reps: number; weightKg: number; rpe?: number }): Promise<LoggedSet>
markSessionCompleted(sessionId: string): Promise<WorkoutSessionDetail>
maxSetNumber(sessionId: string, exerciseId: string): Promise<number>
```

Rules:
- Session detail includes `sets` ordered by `exerciseId` then `setNumber`, and maps all dates with `.toISOString()`.
- Recent sessions filter `completedAt: { not: null }`, order by `startedAt: "desc"`, take `limit`, and use `_count.sets` for `totalSets`.
- `createSet` computes `maxSetNumber + 1`; the unique constraint is the concurrency guard. Catch `P2002` and throw `HTTPException(409, { message: "Set was already logged, retry" })`.
- Include the `planId` field on all session DTOs.

- [ ] **Step 4: Implement service rules**

Add:

```ts
startSession(input: CreateWorkoutSessionInput): Promise<WorkoutSessionDetail>
getActiveSession(): Promise<WorkoutSessionDetail | null>
listSessions(limit: number): Promise<WorkoutSessionSummary[]>
getSession(sessionId: string): Promise<WorkoutSessionDetail>
logSet(sessionId: string, input: CreateWorkoutSetInput): Promise<LoggedSet>
completeSession(sessionId: string): Promise<WorkoutSessionDetail>
```

Rules:
- `startSession`: reject if an active session exists (409 `An active session is already in progress`). If `planId` is set, verify the plan belongs to the current user (404 if not) and default the title to the plan name. Default title is `Free Workout`.
- `logSet`: 404 for an unknown session, 409 if the session is completed, 400 for an unknown exercise.
- `completeSession`: 404 for unknown, 409 if already completed.
- `getSession`: 404 for unknown.
- All lookups are scoped by the current user's `userId`.

- [ ] **Step 5: Wire the routes**

Add in this order so `/sessions/active` is matched before `/sessions/:id`:

```ts
gymModule.post("/sessions", zJson(CreateWorkoutSessionSchema), async (c) => {
  const session = await startSession(c.req.valid("json"));
  return c.json({ session }, 201);
});

gymModule.get("/sessions/active", async (c) =>
  c.json({ session: await getActiveSession() })
);

gymModule.get("/sessions", zQuery(ListSessionsQuerySchema), async (c) => {
  const { limit } = c.req.valid("query");
  return c.json({ sessions: await listSessions(limit) });
});

gymModule.get("/sessions/:id", async (c) =>
  c.json({ session: await getSession(c.req.param("id")) })
);

gymModule.post("/sessions/:id/sets", zJson(CreateWorkoutSetSchema), async (c) => {
  const set = await logSet(c.req.param("id"), c.req.valid("json"));
  return c.json({ set }, 201);
});

gymModule.post("/sessions/:id/complete", async (c) =>
  c.json({ session: await completeSession(c.req.param("id")) })
);
```

Define locally in `modules/gym/index.ts`:

```ts
const ListSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --filter @gymos/api test`
Expected: all plan and session tests pass.

- [ ] **Step 7: Commit (only if authorized)**

```bash
git add apps/api/src/modules/gym apps/api/test/gym-sessions.test.ts
git commit -m "Add gym session routes"
```

---

### Task 6: Add the web API client

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/gym.ts`
- Create: `apps/web/src/api/gym.test.ts`

**Interfaces:**
- Consumes: all types from `@gymos/shared` listed in Task 3.
- Produces these functions from `apps/web/src/api/gym.ts`:

```ts
listExercises(): Promise<Exercise[]>
listPlans(): Promise<WorkoutPlan[]>
createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlan>
startSession(input: CreateWorkoutSessionInput): Promise<WorkoutSessionDetail>
getActiveSession(): Promise<WorkoutSessionDetail | null>
listSessions(limit?: number): Promise<WorkoutSessionSummary[]>
getSession(sessionId: string): Promise<WorkoutSessionDetail>
addSet(sessionId: string, input: CreateWorkoutSetInput): Promise<LoggedSet>
completeSession(sessionId: string): Promise<WorkoutSessionDetail>
```

- [ ] **Step 1: Write the failing client tests**

Create `apps/web/src/api/gym.test.ts` with:

1. `listExercises` fetches `/api/gym/exercises` and returns the unwrapped array.
2. `createPlan` posts JSON to `/api/gym/plans` and returns the unwrapped plan.
3. A non-2xx response throws `ApiError` with the status and server `error` message.

Stub `fetch` with `vi.stubGlobal("fetch", vi.fn())` and restore it with `vi.unstubAllGlobals()` in `afterEach`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --filter @gymos/web test`
Expected: FAIL because the API client does not exist.

- [ ] **Step 3: Implement the client**

`apps/web/src/api/client.ts`:

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};
```

`apps/web/src/api/gym.ts` unwraps each envelope:

```ts
export async function listExercises(): Promise<Exercise[]> {
  const { exercises } = await api.get<{ exercises: Exercise[] }>("/gym/exercises");
  return exercises;
}
```

Implement the remaining functions with the same pattern. Build query strings with `URLSearchParams` for `listSessions`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --filter @gymos/web test`
Expected: PASS.

- [ ] **Step 5: Commit (only if authorized)**

```bash
git add apps/web/src/api
git commit -m "Add web gym api client"
```

---

### Task 7: Build the mobile app shell and CSS foundation

**Files:**
- Create: `apps/web/src/styles.css`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: CSS variables and class names used by Tasks 8–9:
  `app`, `app-header`, `content`, `tab-bar`, `tab`, `tab-active`, `card`, `card-title`, `stack`, `row`, `btn`, `btn-primary`, `btn-ghost`, `btn-danger`, `field`, `input`, `label`, `muted`, `error`, `badge`, `empty`.

- [ ] **Step 1: Add a failing navigation test**

In `apps/web/src/App.test.tsx`, add:

```tsx
it("shows the three main tabs in the navigation", () => {
  render(<App />);
  const nav = screen.getByRole("navigation", { name: /main navigation/i });
  expect(nav).toBeInTheDocument();
  expect(within(nav).getAllByRole("button")).toHaveLength(3);
});
```

Add `within` to the Testing Library import in `App.test.tsx`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --filter @gymos/web test`
Expected: FAIL because no navigation element exists.

- [ ] **Step 3: Create the CSS foundation**

Create `apps/web/src/styles.css` with:

```css
:root {
  color-scheme: dark;
  --bg: #0f172a;
  --surface: #1e293b;
  --surface-2: #273449;
  --text: #f8fafc;
  --muted: #94a3b8;
  --accent: #3b82f6;
  --accent-strong: #2563eb;
  --danger: #ef4444;
  --success: #22c55e;
  --radius: 12px;
  --radius-sm: 8px;
  --space: 16px;
  --font: system-ui, -apple-system, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--font); }
button, input, select, textarea { font: inherit; }

.app { max-width: 640px; min-height: 100dvh; margin: 0 auto; display: flex; flex-direction: column; }
.app-header { padding: 20px var(--space) 8px; text-align: center; }
.content { flex: 1; padding: var(--space); padding-bottom: calc(88px + env(safe-area-inset-bottom)); }
.tab-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 640px; display: flex;
  background: var(--surface); border-top: 1px solid var(--surface-2);
  padding-bottom: env(safe-area-inset-bottom);
}
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 4px; background: none; border: 0; color: var(--muted); cursor: pointer; }
.tab-active { color: var(--accent); }
.card { background: var(--surface); border-radius: var(--radius); padding: var(--space); }
.card-title { margin: 0 0 4px; font-size: 1.05rem; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.btn { border: 0; border-radius: var(--radius-sm); padding: 10px 14px; cursor: pointer; font-weight: 600; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
.btn-ghost { background: var(--surface-2); color: var(--text); }
.btn-danger { background: var(--danger); color: white; }
.field { display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 0.8rem; color: var(--muted); }
.input { width: 100%; padding: 9px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--surface-2); background: var(--bg); color: var(--text); }
.muted { color: var(--muted); }
.error { background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger);
  border-radius: var(--radius-sm); padding: 10px 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px;
  background: var(--surface-2); color: var(--muted); font-size: 0.75rem; }
.empty { text-align: center; color: var(--muted); padding: 20px 0; }
```

Import it in `apps/web/src/main.tsx`:

```ts
import "./styles.css";
```

- [ ] **Step 4: Replace the inline-styled shell in `App.tsx`**

Keep the three tab buttons and placeholder content for Nutrition and Extractor. Structure:

```tsx
<div className="app">
  <header className="app-header">
    <h1>🏋️ GymOS</h1>
    <p className="muted">All-in-one Gym & Nutrition OS</p>
  </header>
  <main className="content">
    {activeTab === "gym" && <div className="card">Workout Tracker</div>}
    {activeTab === "nutrition" && <div className="card">Nutrition & Mealprep</div>}
    {activeTab === "extractor" && <div className="card">TikTok / Reels AI Extractor</div>}
  </main>
  <nav className="tab-bar" aria-label="Main navigation">
    <button type="button" className={activeTab === "gym" ? "tab tab-active" : "tab"} onClick={() => setActiveTab("gym")}>
      <Dumbbell size={20} /> Gym
    </button>
    {/* Nutrition and Extractor buttons use the same pattern */}
  </nav>
</div>
```

Keep the exact placeholder strings `Nutrition & Mealprep` and `TikTok / Reels AI Extractor` so the existing tests keep passing.

- [ ] **Step 5: Clean `index.html`**

Remove the inline `style` attribute from `<body>` and add `viewport-fit=cover` to the viewport meta tag. The CSS now owns the background, color, and font.

- [ ] **Step 6: Run the tests**

Run: `bun --filter @gymos/web test`
Expected: PASS, including the new navigation test.

- [ ] **Step 7: Commit (only if authorized)**

```bash
git add apps/web/src/styles.css apps/web/src/main.tsx apps/web/src/App.tsx apps/web/index.html apps/web/src/App.test.tsx
git commit -m "Add app shell styles"
```

---

### Task 8: Build the Gym overview and plan form

**Files:**
- Create: `apps/web/src/features/gym/GymView.tsx`
- Create: `apps/web/src/features/gym/PlanForm.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Create: `apps/web/src/features/gym/GymView.test.tsx`

**Interfaces:**
- Consumes: `listExercises`, `listPlans`, `createPlan`, `startSession`, `getActiveSession`, `listSessions` from `../../api/gym.ts`; `Exercise`, `WorkoutPlan`, `CreateWorkoutPlanInput`, `WorkoutSessionSummary`, `WorkoutSessionDetail` from `@gymos/shared`.
- Produces:
  - `GymView` component with no props.
  - `PlanForm` props:

```ts
type PlanFormProps = {
  exercises: Exercise[];
  onSubmit: (input: CreateWorkoutPlanInput) => Promise<void>;
};
```

- [ ] **Step 1: Write the failing GymView tests**

Create `apps/web/src/features/gym/GymView.test.tsx` with `vi.mock("../../api/gym.ts", ...)` and these cases:

1. Renders the seeded plan name and exercise count after `listPlans` resolves.
2. Clicking a plan's start button calls `startSession` with `{ planId }` and renders the active-session placeholder.
3. Submitting the plan form calls `createPlan` with the entered name, target sets, and target reps.
4. When `listPlans` rejects, an error message with a retry button is shown.

Set default mocks in `beforeEach`: `listExercises` resolves one exercise, `listPlans` resolves one plan, `getActiveSession` resolves `null`, `listSessions` resolves `[]`, `startSession` resolves a session detail.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --filter @gymos/web test`
Expected: FAIL because `GymView` does not exist.

- [ ] **Step 3: Implement `PlanForm.tsx`**

Requirements:
- Name input (required), optional description.
- At least one exercise row. Each row: exercise `<select>` (required), target sets (number, min 1), target reps (number, min 1), optional target weight (number, min 0), remove button.
- "Add exercise" appends a row using the first exercise ID.
- Remove is disabled when only one row remains.
- Submit calls `onSubmit` with `{ name, description: description || undefined, exercises }`. Trim the name.
- Disable submit while pending or when the name is empty or no rows exist.
- If `exercises` is empty, disable the form and show `No exercises available. Run the seed.`
- On success, reset the form.
- Show the error message if `onSubmit` rejects.

- [ ] **Step 4: Implement `GymView.tsx`**

Requirements:
- Load `listExercises`, `listPlans`, `getActiveSession`, and `listSessions(10)` with `Promise.all` in a `useEffect`.
- Show a loading state while the initial request is in flight.
- Show an error card with a "Retry" button when loading fails.
- If `activeSession` is non-null, render a temporary card with the session title and `Workout in progress`. Task 9 replaces this card with `SessionView`.
- Overview order:
  1. "Start free workout" button → `startSession({})`.
  2. Plans section: plan cards with name, description, exercise count, and a "Start plan" button → `startSession({ planId })`.
  3. "Create plan" toggle revealing `PlanForm`; on submit call `createPlan` and prepend the result to `plans`.
  4. "Recent workouts" list from `listSessions`: title, date (`toLocaleDateString`), and `totalSets`.
- If starting a session returns 409, call `getActiveSession()` and render it.
- Empty states: "No plans yet" and "No completed workouts yet".

- [ ] **Step 5: Wire into `App.tsx` and update App tests**

Render `<GymView />` in the gym tab. In `App.test.tsx`, mock `./api/gym.ts` with empty results (`listExercises: []`, `listPlans: []`, `getActiveSession: null`, `listSessions: []`) so the existing tab tests remain deterministic. Use `findByText` where the Gym view loads asynchronously.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --filter @gymos/web test`
Expected: PASS.

Run: `bun run typecheck`
Expected: no type errors.

- [ ] **Step 7: Commit (only if authorized)**

```bash
git add apps/web/src/features/gym apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "Add gym overview and plan form"
```

---

### Task 9: Build the active session view and set logging

**Files:**
- Create: `apps/web/src/features/gym/SessionView.tsx`
- Modify: `apps/web/src/features/gym/GymView.tsx`
- Create: `apps/web/src/features/gym/SessionView.test.tsx`
- Modify: `apps/web/src/features/gym/GymView.test.tsx`

**Interfaces:**
- Consumes: `addSet`, `completeSession` from `../../api/gym.ts`; shared types.
- Produces:

```ts
type SessionViewProps = {
  session: WorkoutSessionDetail;
  plan: WorkoutPlan | null;
  exercises: Exercise[];
  onLogSet: (input: CreateWorkoutSetInput) => Promise<void>;
  onComplete: () => Promise<void>;
};
```

- [ ] **Step 1: Write the failing SessionView tests**

Create `apps/web/src/features/gym/SessionView.test.tsx` with props (no API mocks needed) covering:

1. Renders the plan's target line, e.g. `4 × 8` and the plan exercise name.
2. Filling weight, reps, and RPE and submitting calls `onLogSet` with the selected exercise ID and numeric values.
3. Clicking "Finish workout" calls `onComplete`.
4. A completed session (`completedAt` non-null) hides the set form and finish button.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --filter @gymos/web test`
Expected: FAIL because `SessionView` does not exist.

- [ ] **Step 3: Implement `SessionView.tsx`**

Requirements:
- Header: session title, started time, and a "Finish workout" button (hidden when completed).
- If `plan` is non-null, render its exercises in `position` order. Each shows the exercise name, target `targetSets × targetReps` plus optional `@ targetWeightKg kg`, and the logged sets for that exercise.
- If `plan` is null, render logged sets grouped by exercise using the `exercises` lookup; show a "No sets logged yet" empty state.
- Logged set row: `Set N: reps × weight kg` plus `@ RPE x` when present.
- Set form: exercise `<select>` (plan exercises when a plan exists, otherwise all exercises), weight (number, min 0, step 0.5), reps (number, min 1), optional RPE (number, min 1, max 10, step 0.5), submit "Log set". Initialize the select to the plan's first exercise ID, or `exercises[0]?.id ?? ""`, and keep the selected exercise after a successful log.
- Submit calls `onLogSet({ exerciseId, weightKg, reps, rpe: rpe || undefined })`; reset weight/reps/RPE after success; keep the exercise selected.
- Disable the form and buttons while a request is pending.
- Show inline error text if `onLogSet` or `onComplete` rejects.

- [ ] **Step 4: Wire `GymView` handlers**

In `GymView`:
- Replace the Task 8 active-session placeholder with `<SessionView session={activeSession} plan={matchingPlan} exercises={exercises} onLogSet={handleLogSet} onComplete={handleComplete} />`.
- `handleLogSet(input)` calls `addSet(activeSession.id, input)` and appends the returned set to `activeSession.sets`.
- `handleComplete()` calls `completeSession(activeSession.id)`, sets `activeSession` to `null`, and refreshes `listSessions(10)`.
- `matchingPlan` is `plans.find((p) => p.id === activeSession.planId) ?? null`.

- [ ] **Step 5: Extend GymView tests**

Add a case where `getActiveSession` resolves an active session and assert that the `SessionView` title renders, logging a set calls `addSet`, and finishing calls `completeSession`, then the overview returns.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --filter @gymos/web test`
Expected: PASS.

Run: `bun run typecheck`
Expected: no type errors.

- [ ] **Step 7: Commit (only if authorized)**

```bash
git add apps/web/src/features/gym
git commit -m "Add workout session view"
```

---

### Task 10: Full verification and smoke test

**Files:**
- No source changes expected.
- Modify: `README.md` only if the verification exposes a stale instruction.

- [ ] **Step 1: Run the full quality gate**

```bash
bun run typecheck
bun run lint:all
bun run test
bun run build
```

Expected:
- `bun check`: no type errors.
- `oxlint`: no errors.
- ADR linter: `All 13 ADR(s) conform to MADR format.`
- Vitest: all API, web, and shared suites pass.
- Vite build: exit code 0.

- [ ] **Step 2: Smoke-test the API**

Ensure PostgreSQL is running and migrations/seeds are applied:

```bash
bun run db:up
bun run db:migrate
bun run db:seed
bun run dev
```

In a second terminal:

```bash
curl -s http://localhost:3000/api/gym/exercises
curl -s http://localhost:3000/api/gym/plans
```

Expected: the exercises array contains the 8 seeded exercises; the plans array contains `Push Day` with 3 exercises.

- [ ] **Step 3: Smoke-test the UI**

Open `http://localhost:5173`:
1. Gym tab shows the `Push Day` plan and the "Start free workout" button.
2. Start `Push Day`; the session view shows the three exercises and their targets.
3. Log a set; it appears under the exercise with `Set 1`.
4. Finish the workout; the overview shows it under "Recent workouts".
5. Reload the page; the completed session remains in history and no active session is shown.

- [ ] **Step 4: Report results**

Report the exact command outputs and any deviations. Do not claim success without the verification output.

---

## Deferred Cleanups (not part of this plan)

- Add the missing PWA icons (`apps/web/public/pwa-192x192.png`, `pwa-512x512.png`).
- Collapse the two `.env` files into a single root source.
- Isolate API tests with a dedicated test database before adding CI.
- Add Dockerfiles and K3s manifests (ADR-0008).
- Nutrition/mealprep slice and the text-first recipe extractor (ADR-0010 is unrelated; the extractor gets its own ADR).
