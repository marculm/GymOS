import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import { container } from "../../../src/container.mts";
import { NotFoundError } from "../../../src/modules/gym/service/errors.mts";
import {
  cleanupTestUser,
  clearTestUserData,
  createTestUser,
  createUser,
  deleteUser,
  firstExercise,
} from "../helpers.mts";

let exerciseId: string;

beforeAll(async () => {
  await createTestUser();
  exerciseId = (await firstExercise()).id;
});

beforeEach(clearTestUserData);
afterAll(cleanupTestUser);

function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createPlan(name: string) {
  const res = await postJson("/api/gym/plans", {
    name,
    exercises: [{ exerciseId, targetSets: 3, targetReps: 8 }],
  });
  expect(res.status).toBe(201);

  return (await res.json()) as { id: string; name: string };
}

async function startSession(body: Record<string, unknown> = {}) {
  const res = await postJson("/api/gym/sessions", body);
  expect(res.status).toBe(201);

  return (await res.json()) as {
    id: string;
    title: string;
    planId: string | null;
    completedAt: string | null;
    sets: Array<{ setNumber: number; createdAt: string }>;
  };
}

async function logSet(sessionId: string, overrides: Record<string, unknown> = {}) {
  return postJson(`/api/gym/sessions/${sessionId}/sets`, {
    exerciseId,
    reps: 10,
    weightKg: 20,
    ...overrides,
  });
}

describe("Gym session routes", () => {
  it("starts a free session and sets Location", async () => {
    const res = await postJson("/api/gym/sessions", {});
    expect(res.status).toBe(201);

    const session = (await res.json()) as {
      id: string;
      title: string;
      planId: string | null;
    };
    expect(session.title).toBe("Free Workout");
    expect(session.planId).toBeNull();
    expect(res.headers.get("location")).toContain(`/api/gym/sessions/${session.id}`);
  });

  it("rejects a second active session", async () => {
    await startSession();

    const res = await postJson("/api/gym/sessions", {});
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("allows only one active session under concurrent starts", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => postJson("/api/gym/sessions", {}))
    );
    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(4);
  });

  it("starts a session from a plan", async () => {
    const plan = await createPlan("Plan Session");
    const session = await startSession({ planId: plan.id });

    expect(session.title).toBe("Plan Session");
    expect(session.planId).toBe(plan.id);
  });

  it("returns a 404 problem when there is no active session", async () => {
    const res = await app.request("/api/gym/sessions/active");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("numbers sets per exercise", async () => {
    const session = await startSession();

    const first = await logSet(session.id);
    expect(first.status).toBe(201);
    expect(((await first.json()) as { setNumber: number }).setNumber).toBe(1);

    const second = await logSet(session.id, { weightKg: 22.5 });
    expect(second.status).toBe(201);
    expect(((await second.json()) as { setNumber: number }).setNumber).toBe(2);
  });

  it("keeps set numbers unique under concurrent posts", async () => {
    const session = await startSession();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => logSet(session.id))
    );
    const created = responses.filter((response) => response.status === 201);
    expect(
      responses.every((response) => response.status === 201 || response.status === 409)
    ).toBe(true);
    expect(created.length).toBeGreaterThan(0);

    const numbers = await Promise.all(
      created.map(async (response) => ((await response.json()) as { setNumber: number }).setNumber)
    );
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(new Set(sorted).size).toBe(sorted.length);
    sorted.forEach((number, index) => expect(number).toBe(index + 1));
  });

  it("rejects sets on a completed session", async () => {
    const session = await startSession();
    expect((await postJson(`/api/gym/sessions/${session.id}/complete`, {})).status).toBe(200);

    const res = await logSet(session.id);
    expect(res.status).toBe(409);
    const data = (await res.json()) as { detail: string };
    expect(data.detail).toContain("completed");
  });

  it("rejects unknown exercise IDs", async () => {
    const session = await startSession();

    const res = await logSet(session.id, {
      exerciseId: "00000000-0000-4000-8000-000000000099",
    });
    expect(res.status).toBe(422);
    const data = (await res.json()) as { detail: string };
    expect(data.detail).toContain("Unknown exercise");
  });

  it("never leaves a set on a completed session", async () => {
    const session = await startSession();

    await Promise.all([
      logSet(session.id),
      postJson(`/api/gym/sessions/${session.id}/complete`, {}),
    ]);

    const res = await app.request(`/api/gym/sessions/${session.id}`);
    const final = (await res.json()) as {
      completedAt: string | null;
      sets: Array<{ createdAt: string }>;
    };
    expect(final.sets.length).toBeLessThanOrEqual(1);
    if (final.completedAt && final.sets[0]) {
      expect(new Date(final.sets[0].createdAt).getTime()).toBeLessThanOrEqual(
        new Date(final.completedAt).getTime()
      );
    }
  });

  it("completes a session and clears the active session", async () => {
    const session = await startSession();

    const complete = await postJson(`/api/gym/sessions/${session.id}/complete`, {});
    expect(complete.status).toBe(200);
    const completed = (await complete.json()) as { completedAt: string | null };
    expect(completed.completedAt).not.toBeNull();

    expect((await app.request("/api/gym/sessions/active")).status).toBe(404);
  });

  it("lists completed sessions with total sets as a page", async () => {
    const session = await startSession();
    await logSet(session.id);
    await postJson(`/api/gym/sessions/${session.id}/complete`, {});

    const history = await app.request("/api/gym/sessions");
    expect(history.status).toBe(200);
    const data = (await history.json()) as {
      content: Array<{ id: string; totalSets: number }>;
      page: { totalElements: number };
    };
    expect(data.content).toHaveLength(1);
    expect(data.content[0]?.id).toBe(session.id);
    expect(data.content[0]?.totalSets).toBe(1);
    expect(data.page.totalElements).toBe(1);
  });

  it("filters completed sessions by plan", async () => {
    const plan = await createPlan("Filtered Plan");
    const planned = await startSession({ planId: plan.id });
    await postJson(`/api/gym/sessions/${planned.id}/complete`, {});
    const free = await startSession();
    await postJson(`/api/gym/sessions/${free.id}/complete`, {});

    const res = await app.request(`/api/gym/sessions?planId=${plan.id}`);
    const data = (await res.json()) as { content: Array<{ id: string; planId: string | null }> };
    expect(data.content.map((session) => session.id)).toEqual([planned.id]);
  });

  it("filters sessions by start date range", async () => {
    const session = await startSession();
    await postJson(`/api/gym/sessions/${session.id}/complete`, {});

    const now = Date.now();
    const from = new Date(now - 60_000).toISOString();
    const to = new Date(now + 60_000).toISOString();

    const inside = await app.request(
      `/api/gym/sessions?from=${from}&to=${to}`
    );
    const insideData = (await inside.json()) as {
      content: Array<{ id: string }>;
    };
    expect(insideData.content.map((entry) => entry.id)).toEqual([session.id]);

    const outside = await app.request(
      `/api/gym/sessions?from=${to}&to=${new Date(now + 120_000).toISOString()}`
    );
    const outsideData = (await outside.json()) as { content: unknown[] };
    expect(outsideData.content).toHaveLength(0);
  });

  it("excludes an active session from history", async () => {
    const completed = await startSession();
    await postJson(`/api/gym/sessions/${completed.id}/complete`, {});
    const active = await startSession();

    const history = await app.request("/api/gym/sessions");
    const data = (await history.json()) as { content: Array<{ id: string }> };

    expect(data.content.map((session) => session.id)).toEqual([completed.id]);
    expect(data.content.some((session) => session.id === active.id)).toBe(false);
  });

  it("returns a session with its logged sets", async () => {
    const session = await startSession();
    await logSet(session.id, { reps: 8, weightKg: 60, rpe: 8 });

    const res = await app.request(`/api/gym/sessions/${session.id}`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      sets: Array<{ setNumber: number; reps: number }>;
    };
    expect(data.sets).toHaveLength(1);
    expect(data.sets[0]?.setNumber).toBe(1);
    expect(data.sets[0]?.reps).toBe(8);
  });

  it("returns a 404 problem with all fields for an unknown session", async () => {
    const path = "/api/gym/sessions/00000000-0000-4000-8000-000000000099";
    const res = await app.request(path);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/problem+json");

    const data = (await res.json()) as {
      title: string;
      status: number;
      detail: string;
      instance: string;
    };
    expect(data).toMatchObject({
      title: "Not Found",
      status: 404,
      detail: "Session not found",
      instance: path,
    });
  });

  it("isolates sessions and plans by user", async () => {
    const other = await createUser(`other-${crypto.randomUUID()}@gymos.app`);
    await createPlan("Owner Plan");
    const session = await startSession();

    try {
      const plans = await container.readService.listPlans(other.id, {
        number: 0,
        size: 20,
      });
      expect(plans.content).toHaveLength(0);

      await expect(
        container.readService.getSession(other.id, session.id)
      ).rejects.toBeInstanceOf(NotFoundError);

      await expect(
        container.writeService.logSet(other.id, session.id, {
          exerciseId,
          reps: 10,
          weightKg: 20,
        })
      ).rejects.toBeInstanceOf(NotFoundError);
    } finally {
      await deleteUser(other.id);
    }
  });
});
