import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/index.ts";
import {
  cleanupTestUser,
  clearTestUserData,
  createTestUser,
  firstExercise,
} from "./helpers.ts";

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

  const data = (await res.json()) as { plan: { id: string; name: string } };
  return data.plan;
}

async function startSession(body: Record<string, unknown> = {}) {
  const res = await postJson("/api/gym/sessions", body);
  expect(res.status).toBe(201);

  const data = (await res.json()) as {
    session: { id: string; title: string; planId: string | null; sets: unknown[] };
  };
  return data.session;
}

describe("Gym session routes", () => {
  it("starts a free session", async () => {
    const session = await startSession();
    expect(session.title).toBe("Free Workout");
    expect(session.planId).toBeNull();
  });

  it("rejects a second active session", async () => {
    await startSession();

    const res = await postJson("/api/gym/sessions", {});
    expect(res.status).toBe(409);
  });

  it("starts a session from a plan", async () => {
    const plan = await createPlan("Plan Session");
    const session = await startSession({ planId: plan.id });

    expect(session.title).toBe("Plan Session");
    expect(session.planId).toBe(plan.id);
  });

  it("numbers sets per exercise", async () => {
    const session = await startSession();

    const first = await postJson(`/api/gym/sessions/${session.id}/sets`, {
      exerciseId,
      reps: 10,
      weightKg: 20,
    });
    expect(first.status).toBe(201);
    const firstData = (await first.json()) as { set: { setNumber: number } };
    expect(firstData.set.setNumber).toBe(1);

    const second = await postJson(`/api/gym/sessions/${session.id}/sets`, {
      exerciseId,
      reps: 10,
      weightKg: 22.5,
    });
    expect(second.status).toBe(201);
    const secondData = (await second.json()) as { set: { setNumber: number } };
    expect(secondData.set.setNumber).toBe(2);
  });

  it("rejects sets on a completed session", async () => {
    const session = await startSession();
    const complete = await postJson(`/api/gym/sessions/${session.id}/complete`, {});
    expect(complete.status).toBe(200);

    const res = await postJson(`/api/gym/sessions/${session.id}/sets`, {
      exerciseId,
      reps: 10,
      weightKg: 20,
    });
    expect(res.status).toBe(409);
  });

  it("rejects unknown exercise IDs", async () => {
    const session = await startSession();

    const res = await postJson(`/api/gym/sessions/${session.id}/sets`, {
      exerciseId: "00000000-0000-4000-8000-000000000099",
      reps: 10,
      weightKg: 20,
    });
    expect(res.status).toBe(400);
  });

  it("completes a session and clears the active session", async () => {
    const session = await startSession();

    const complete = await postJson(`/api/gym/sessions/${session.id}/complete`, {});
    expect(complete.status).toBe(200);
    const completeData = (await complete.json()) as {
      session: { completedAt: string | null };
    };
    expect(completeData.session.completedAt).not.toBeNull();

    const active = await app.request("/api/gym/sessions/active");
    expect(active.status).toBe(200);
    const activeData = (await active.json()) as { session: unknown };
    expect(activeData.session).toBeNull();
  });

  it("lists completed sessions with total sets", async () => {
    const session = await startSession();
    await postJson(`/api/gym/sessions/${session.id}/sets`, {
      exerciseId,
      reps: 10,
      weightKg: 20,
    });
    await postJson(`/api/gym/sessions/${session.id}/complete`, {});

    const history = await app.request("/api/gym/sessions");
    expect(history.status).toBe(200);
    const data = (await history.json()) as {
      sessions: Array<{ id: string; totalSets: number }>;
    };
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]?.id).toBe(session.id);
    expect(data.sessions[0]?.totalSets).toBe(1);
  });

  it("returns a session with its logged sets", async () => {
    const session = await startSession();
    await postJson(`/api/gym/sessions/${session.id}/sets`, {
      exerciseId,
      reps: 8,
      weightKg: 60,
      rpe: 8,
    });

    const res = await app.request(`/api/gym/sessions/${session.id}`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      session: { sets: Array<{ setNumber: number; reps: number }> };
    };
    expect(data.session.sets).toHaveLength(1);
    expect(data.session.sets[0]?.setNumber).toBe(1);
    expect(data.session.sets[0]?.reps).toBe(8);
  });

  it("returns 404 for an unknown session", async () => {
    const res = await app.request(
      "/api/gym/sessions/00000000-0000-4000-8000-000000000099"
    );
    expect(res.status).toBe(404);
  });
});
