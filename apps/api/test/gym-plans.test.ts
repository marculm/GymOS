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

function postJson(body: unknown) {
  return app.request("/api/gym/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Gym plan routes", () => {
  it("creates a plan with one exercise", async () => {
    const res = await postJson({
      name: "Test Plan",
      description: "Test",
      exercises: [{ exerciseId, targetSets: 4, targetReps: 8, targetWeightKg: 80 }],
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as {
      plan: {
        name: string;
        exercises: Array<{ position: number; exercise: { id: string } }>;
      };
    };
    expect(data.plan.name).toBe("Test Plan");
    expect(data.plan.exercises).toHaveLength(1);
    expect(data.plan.exercises[0]?.position).toBe(0);
    expect(data.plan.exercises[0]?.exercise.id).toBe(exerciseId);
  });

  it("lists created plans", async () => {
    await postJson({
      name: "Listed Plan",
      exercises: [{ exerciseId, targetSets: 3, targetReps: 10 }],
    });

    const res = await app.request("/api/gym/plans");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { plans: Array<{ name: string }> };
    expect(data.plans.map((plan) => plan.name)).toContain("Listed Plan");
  });

  it("rejects an empty exercise list", async () => {
    const res = await postJson({ name: "Empty", exercises: [] });
    expect(res.status).toBe(400);
  });

  it("rejects unknown exercise IDs", async () => {
    const res = await postJson({
      name: "Unknown",
      exercises: [
        {
          exerciseId: "00000000-0000-4000-8000-000000000099",
          targetSets: 3,
          targetReps: 10,
        },
      ],
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Unknown exercise IDs");
  });

  it("rejects duplicate plan names", async () => {
    const body = {
      name: "Duplicate",
      exercises: [{ exerciseId, targetSets: 3, targetReps: 10 }],
    };

    const first = await postJson(body);
    expect(first.status).toBe(201);

    const second = await postJson(body);
    expect(second.status).toBe(409);
    const data = (await second.json()) as { error: string };
    expect(data.error).toBe("A plan with this name already exists");
  });

  it("still lists exercises", async () => {
    const res = await app.request("/api/gym/exercises");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { exercises: Array<{ id: string; name: string }> };
    expect(data.exercises.length).toBeGreaterThan(0);
  });
});
