import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import { container } from "../../../src/container.mts";
import { UnknownPlanError } from "../../../src/modules/gym/service/errors.mts";
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

function sendJson(method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putRotation(planIds: string[]) {
  return sendJson("PUT", "/api/gym/rotation", { planIds });
}

async function getRotation() {
  const res = await app.request("/api/gym/rotation");
  expect(res.status).toBe(200);
  return (await res.json()) as {
    plans: Array<{ id: string; name: string }>;
    nextPlanId: string | null;
  };
}

async function createPlan(name: string) {
  const res = await sendJson("POST", "/api/gym/plans", {
    name,
    exercises: [{ exerciseId, targetSets: 3, targetReps: 8 }],
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; name: string };
}

async function startSession(planId?: string) {
  const res = await sendJson(
    "POST",
    "/api/gym/sessions",
    planId ? { planId } : {}
  );
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; planId: string | null };
}

async function completeSession(sessionId: string) {
  const res = await sendJson(
    "POST",
    `/api/gym/sessions/${sessionId}/complete`,
    {}
  );
  expect(res.status).toBe(200);
}

describe("Gym rotation routes", () => {
  it("stores an ordered rotation and suggests the first plan without history", async () => {
    const push = await createPlan("Push");
    const pull = await createPlan("Pull");

    const res = await putRotation([pull.id, push.id]);
    expect(res.status).toBe(200);
    const rotation = (await res.json()) as {
      plans: Array<{ id: string; name: string }>;
      nextPlanId: string | null;
    };
    expect(rotation.plans.map((plan) => plan.name)).toEqual(["Pull", "Push"]);
    expect(rotation.nextPlanId).toBe(pull.id);

    const stored = await getRotation();
    expect(stored.plans.map((plan) => plan.id)).toEqual([pull.id, push.id]);
    expect(stored.nextPlanId).toBe(pull.id);
  });

  it("clears the rotation with an empty list", async () => {
    const push = await createPlan("Push");
    await putRotation([push.id]);

    expect((await putRotation([])).status).toBe(200);

    expect(await getRotation()).toEqual({ plans: [], nextPlanId: null });
  });

  it("rejects unknown and duplicate plans", async () => {
    const push = await createPlan("Push");

    const unknown = await putRotation([crypto.randomUUID()]);
    expect(unknown.status).toBe(422);
    expect(((await unknown.json()) as { detail: string }).detail).toContain(
      "Unknown plan"
    );

    const duplicate = await putRotation([push.id, push.id]);
    expect(duplicate.status).toBe(422);
    expect(
      ((await duplicate.json()) as { detail: Array<{ message: string }> }).detail.map(
        (issue) => issue.message
      )
    ).toContain("Each plan can only appear once in the rotation");
  });

  it("suggests the next plan after a completed planned workout", async () => {
    const push = await createPlan("Push");
    const pull = await createPlan("Pull");
    await putRotation([push.id, pull.id]);

    const session = await startSession(push.id);
    await completeSession(session.id);

    expect((await getRotation()).nextPlanId).toBe(pull.id);
  });

  it("wraps to the first plan after the last rotation item", async () => {
    const push = await createPlan("Push");
    const pull = await createPlan("Pull");
    await putRotation([push.id, pull.id]);

    await completeSession((await startSession(pull.id)).id);

    expect((await getRotation()).nextPlanId).toBe(push.id);
  });

  it("ignores free workouts", async () => {
    const push = await createPlan("Push");
    const pull = await createPlan("Pull");
    await putRotation([push.id, pull.id]);

    await completeSession((await startSession()).id);
    expect((await getRotation()).nextPlanId).toBe(push.id);

    await completeSession((await startSession(push.id)).id);
    await completeSession((await startSession()).id);
    expect((await getRotation()).nextPlanId).toBe(pull.id);
  });

  it("uses the deviated plan's position", async () => {
    const push = await createPlan("Push");
    const pull = await createPlan("Pull");
    const legs = await createPlan("Legs");
    await putRotation([push.id, pull.id, legs.id]);

    await completeSession((await startSession(pull.id)).id);

    expect((await getRotation()).nextPlanId).toBe(legs.id);
  });

  it("falls back to the first plan for a workout outside the rotation", async () => {
    const push = await createPlan("Push");
    const pull = await createPlan("Pull");
    const arms = await createPlan("Arms");
    await putRotation([push.id, pull.id]);

    await completeSession((await startSession(arms.id)).id);

    expect((await getRotation()).nextPlanId).toBe(push.id);
  });

  it("drops a deleted plan from the rotation", async () => {
    const push = await createPlan("Push");
    const pull = await createPlan("Pull");
    const legs = await createPlan("Legs");
    await putRotation([push.id, pull.id, legs.id]);
    await completeSession((await startSession(push.id)).id);

    expect(
      (await app.request(`/api/gym/plans/${pull.id}`, { method: "DELETE" }))
        .status
    ).toBe(204);

    const rotation = await getRotation();
    expect(rotation.plans.map((plan) => plan.id)).toEqual([push.id, legs.id]);
    expect(rotation.nextPlanId).toBe(legs.id);
  });

  it("isolates rotations by user", async () => {
    const push = await createPlan("Push");
    await putRotation([push.id]);
    const other = await createUser(`other-${crypto.randomUUID()}@gymos.app`);

    try {
      expect(await container.readService.getRotation(other.id)).toEqual({
        plans: [],
        nextPlanId: null,
      });
      await expect(
        container.writeService.setRotation(other.id, { planIds: [push.id] })
      ).rejects.toBeInstanceOf(UnknownPlanError);
    } finally {
      await deleteUser(other.id);
    }
  });
});
