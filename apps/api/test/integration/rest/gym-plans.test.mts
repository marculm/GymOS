import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import {
  cleanupTestUser,
  clearTestUserData,
  createTestUser,
  firstExercise,
} from "../helpers.mts";

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

function planBody(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    exercises: [{ exerciseId, targetSets: 3, targetReps: 10, ...overrides }],
  };
}

describe("Gym plan routes", () => {
  it("creates a plan, returns it, and sets Location", async () => {
    const res = await postJson({
      name: "Test Plan",
      description: "Test",
      exercises: [{ exerciseId, targetSets: 4, targetReps: 8, targetWeightKg: 80 }],
    });

    expect(res.status).toBe(201);

    const plan = (await res.json()) as {
      id: string;
      name: string;
      exercises: Array<{ position: number; exercise: { id: string } }>;
    };
    expect(plan.name).toBe("Test Plan");
    expect(plan.exercises).toHaveLength(1);
    expect(plan.exercises[0]?.position).toBe(0);
    expect(plan.exercises[0]?.exercise.id).toBe(exerciseId);
    expect(res.headers.get("location")).toContain(`/api/gym/plans/${plan.id}`);
  });

  it("lists created plans as a page", async () => {
    await postJson(planBody("Listed Plan"));

    const res = await app.request("/api/gym/plans");
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      content: Array<{ name: string }>;
      page: { size: number; number: number; totalElements: number; totalPages: number };
    };
    expect(data.content.map((plan) => plan.name)).toContain("Listed Plan");
    expect(data.page.number).toBe(0);
    expect(data.page.size).toBe(20);
  });

  it("paginates plans and filters by name", async () => {
    await postJson(planBody("Push"));
    await postJson(planBody("Pull"));
    await postJson(planBody("Legs"));

    const firstPage = await app.request("/api/gym/plans?page=1&size=2");
    expect(firstPage.status).toBe(200);
    const first = (await firstPage.json()) as {
      content: Array<{ name: string }>;
      page: { totalElements: number; totalPages: number; number: number };
    };
    expect(first.content).toHaveLength(2);
    expect(first.page.totalElements).toBe(3);
    expect(first.page.totalPages).toBe(2);
    expect(first.page.number).toBe(0);

    const secondPage = await app.request("/api/gym/plans?page=2&size=2");
    const second = (await secondPage.json()) as { content: unknown[]; page: { number: number } };
    expect(second.content).toHaveLength(1);
    expect(second.page.number).toBe(1);

    const filtered = await app.request("/api/gym/plans?name=Push");
    const filteredData = (await filtered.json()) as { content: Array<{ name: string }> };
    expect(filteredData.content.map((plan) => plan.name)).toEqual(["Push"]);
  });

  it("returns empty page metadata when there are no plans", async () => {
    const res = await app.request("/api/gym/plans");
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      content: unknown[];
      page: { size: number; number: number; totalElements: number; totalPages: number };
    };
    expect(data.content).toEqual([]);
    expect(data.page).toEqual({
      size: 20,
      number: 0,
      totalElements: 0,
      totalPages: 0,
    });
  });

  it("rejects an empty exercise list with problem details", async () => {
    const res = await postJson({ name: "Empty", exercises: [] });
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("normalizes out-of-range pagination", async () => {
    const res = await app.request("/api/gym/plans?page=0&size=500");
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      page: { number: number; size: number };
    };
    expect(data.page.number).toBe(0);
    expect(data.page.size).toBe(20);
  });

  it("rejects malformed pagination", async () => {
    const res = await app.request("/api/gym/plans?page=abc");
    expect(res.status).toBe(422);
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
    expect(res.status).toBe(422);
    const data = (await res.json()) as { detail: string };
    expect(data.detail).toContain("Unknown exercise");
  });

  it("rejects duplicate plan names", async () => {
    const body = planBody("Duplicate");

    expect((await postJson(body)).status).toBe(201);

    const res = await postJson(body);
    expect(res.status).toBe(409);
    const data = (await res.json()) as { detail: string };
    expect(data.detail).toContain("already exists");
  });

  it("rejects duplicate exercises", async () => {
    const res = await postJson({
      name: "Repeated",
      exercises: [
        { exerciseId, targetSets: 3, targetReps: 8 },
        { exerciseId, targetSets: 4, targetReps: 10 },
      ],
    });

    expect(res.status).toBe(422);
    const data = (await res.json()) as { detail: Array<{ message: string }> };
    expect(data.detail.map((issue) => issue.message)).toContain(
      "Each exercise can only be added once"
    );
  });

  it("rejects plans over the input limits", async () => {
    const tooManyExercises = Array.from({ length: 51 }, () => ({
      exerciseId: crypto.randomUUID(),
      targetSets: 3,
      targetReps: 10,
    }));
    expect((await postJson({ name: "Too many", exercises: tooManyExercises })).status).toBe(422);

    expect((await postJson(planBody("Too many sets", { targetSets: 21 }))).status).toBe(422);
    expect((await postJson(planBody("Too many reps", { targetReps: 101 }))).status).toBe(422);
  });
});
