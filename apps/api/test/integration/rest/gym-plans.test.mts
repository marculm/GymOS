import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import { prisma } from "../../../src/config/prisma-client.mts";
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
let exerciseDefaults: {
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
};

beforeAll(async () => {
  await createTestUser();
  const exercise = await firstExercise();
  exerciseId = exercise.id;
  exerciseDefaults = {
    defaultSets: exercise.defaultSets,
    defaultReps: exercise.defaultReps,
    defaultWeightKg: exercise.defaultWeightKg,
  };
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

function sendJson(method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
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

async function createPlan(name: string) {
  const res = await postJson(planBody(name));
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; name: string };
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

  it("updates a plan and replaces its exercises", async () => {
    const created = await createPlan("Old Name");

    const res = await sendJson("PUT", `/api/gym/plans/${created.id}`, {
      name: "New Name",
      description: "Updated",
      exercises: [
        { exerciseId, targetSets: 5, targetReps: 5, targetWeightKg: 100 },
      ],
    });

    expect(res.status).toBe(200);
    const plan = (await res.json()) as {
      id: string;
      name: string;
      description: string | null;
      exercises: Array<{
        position: number;
        targetSets: number;
        targetReps: number;
        targetWeightKg: number | null;
        exercise: { id: string };
      }>;
    };
    expect(plan.id).toBe(created.id);
    expect(plan.name).toBe("New Name");
    expect(plan.description).toBe("Updated");
    expect(plan.exercises).toHaveLength(1);
    expect(plan.exercises[0]).toMatchObject({
      position: 0,
      targetSets: exerciseDefaults.defaultSets,
      targetReps: exerciseDefaults.defaultReps,
      targetWeightKg: exerciseDefaults.defaultWeightKg,
      exercise: { id: exerciseId },
    });

    const list = await app.request("/api/gym/plans");
    const data = (await list.json()) as { content: Array<{ name: string }> };
    expect(data.content.map((entry) => entry.name)).toEqual(["New Name"]);
  });

  it("rejects plan updates with unknown exercise IDs", async () => {
    const created = await createPlan("Guarded");

    const res = await sendJson("PUT", `/api/gym/plans/${created.id}`, {
      name: "Guarded",
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

    const list = await app.request("/api/gym/plans");
    const plans = (await list.json()) as { content: Array<{ name: string }> };
    expect(plans.content.map((plan) => plan.name)).toEqual(["Guarded"]);
  });

  it("keeps an exercise that is already in the plan after it was deleted", async () => {
    const createdExercise = (await (
      await sendJson("POST", "/api/gym/exercises", {
        name: `Plan Exercise ${crypto.randomUUID()}`,
        muscleGroup: "chest",
      })
    ).json()) as { id: string; defaultSets: number };

    try {
      const created = (await (
        await sendJson("POST", "/api/gym/plans", {
          name: "Deleted Exercise Plan",
          exercises: [
            { exerciseId: createdExercise.id, targetSets: 3, targetReps: 10 },
          ],
        })
      ).json()) as { id: string };

      const deleted = await app.request(
        `/api/gym/exercises/${createdExercise.id}`,
        { method: "DELETE" }
      );
      expect(deleted.status).toBe(200);

      const res = await sendJson("PUT", `/api/gym/plans/${created.id}`, {
        name: "Renamed Deleted Exercise Plan",
        exercises: [
          { exerciseId: createdExercise.id, targetSets: 4, targetReps: 8 },
        ],
      });

      expect(res.status).toBe(200);
      const plan = (await res.json()) as {
        name: string;
        exercises: Array<{ targetSets: number; exercise: { id: string } }>;
      };
      expect(plan.name).toBe("Renamed Deleted Exercise Plan");
      expect(plan.exercises[0]).toMatchObject({
        targetSets: createdExercise.defaultSets,
        exercise: { id: createdExercise.id },
      });
    } finally {
      await prisma.workoutPlan.deleteMany({
        where: { name: "Renamed Deleted Exercise Plan" },
      });
      await prisma.exercise.deleteMany({ where: { id: createdExercise.id } });
    }
  });

  it("rejects renaming a plan to an existing name", async () => {
    await createPlan("Taken");
    const created = await createPlan("Renamed");

    const res = await sendJson("PUT", `/api/gym/plans/${created.id}`, {
      name: "Taken",
      exercises: [{ exerciseId, targetSets: 3, targetReps: 10 }],
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as { detail: string };
    expect(data.detail).toContain("already exists");
  });

  it("returns 404 when updating or deleting a missing plan", async () => {
    const missing = crypto.randomUUID();

    expect(
      (
        await sendJson("PUT", `/api/gym/plans/${missing}`, planBody("Missing"))
      ).status
    ).toBe(404);
    expect((await app.request(`/api/gym/plans/${missing}`, { method: "DELETE" })).status).toBe(404);
  });

  it("edits a plan without rewriting past sessions", async () => {
    const plan = await createPlan("Edited Plan");

    const start = await sendJson("POST", "/api/gym/sessions", { planId: plan.id });
    expect(start.status).toBe(201);
    const session = (await start.json()) as { id: string };

    expect(
      (
        await sendJson("POST", `/api/gym/sessions/${session.id}/sets`, {
          exerciseId,
          reps: 8,
          weightKg: 60,
        })
      ).status
    ).toBe(201);
    expect(
      (await sendJson("POST", `/api/gym/sessions/${session.id}/complete`, {}))
        .status
    ).toBe(200);

    const res = await sendJson("PUT", `/api/gym/plans/${plan.id}`, {
      name: "Edited Plan v2",
      exercises: [
        { exerciseId, targetSets: 5, targetReps: 5, targetWeightKg: 70 },
      ],
    });
    expect(res.status).toBe(200);

    const detail = await app.request(`/api/gym/sessions/${session.id}`);
    const kept = (await detail.json()) as {
      title: string;
      planId: string | null;
      sets: Array<{ setNumber: number; reps: number; weightKg: number }>;
    };
    expect(kept.title).toBe("Edited Plan");
    expect(kept.planId).toBe(plan.id);
    expect(kept.sets).toHaveLength(1);
    expect(kept.sets[0]).toMatchObject({ setNumber: 1, reps: 8, weightKg: 60 });
  });

  it("deletes a plan without rewriting past sessions", async () => {
    const plan = await createPlan("History Plan");

    const start = await sendJson("POST", "/api/gym/sessions", { planId: plan.id });
    expect(start.status).toBe(201);
    const session = (await start.json()) as { id: string; title: string };

    const set = await sendJson("POST", `/api/gym/sessions/${session.id}/sets`, {
      exerciseId,
      reps: 8,
      weightKg: 60,
    });
    expect(set.status).toBe(201);
    expect(
      (await sendJson("POST", `/api/gym/sessions/${session.id}/complete`, {})).status
    ).toBe(200);

    const res = await app.request(`/api/gym/plans/${plan.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    const list = await app.request("/api/gym/plans");
    const plans = (await list.json()) as { content: Array<{ id: string }> };
    expect(plans.content).toEqual([]);

    const detail = await app.request(`/api/gym/sessions/${session.id}`);
    const kept = (await detail.json()) as {
      title: string;
      planId: string | null;
      sets: Array<{ reps: number; weightKg: number }>;
    };
    expect(kept.title).toBe("History Plan");
    expect(kept.planId).toBeNull();
    expect(kept.sets).toHaveLength(1);
    expect(kept.sets[0]).toMatchObject({ reps: 8, weightKg: 60 });
  });

  it("isolates plan updates and deletes by user", async () => {
    const plan = await createPlan("Owner Plan");
    const other = await createUser(`other-${crypto.randomUUID()}@gymos.app`);

    try {
      await expect(
        container.writeService.updatePlan(other.id, plan.id, {
          name: "Stolen",
          exercises: [{ exerciseId }],
        })
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        container.writeService.deletePlan(other.id, plan.id)
      ).rejects.toBeInstanceOf(NotFoundError);
    } finally {
      await deleteUser(other.id);
    }
  });

  it("rejects plans over the input limits", async () => {
    const tooManyExercises = Array.from({ length: 51 }, () => ({
      exerciseId: crypto.randomUUID(),
    }));
    const tooMany = await postJson({ name: "Too many", exercises: tooManyExercises });
    expect(tooMany.status).toBe(422);
    const tooManyData = (await tooMany.json()) as {
      detail: Array<{ message: string }>;
    };
    expect(tooManyData.detail.some((issue) => /50/.test(issue.message))).toBe(true);
  });

  it("derives plan targets from the current exercise defaults", async () => {
    const createdExercise = (await (
      await sendJson("POST", "/api/gym/exercises", {
        name: `Default Exercise ${crypto.randomUUID()}`,
        muscleGroup: "chest",
        defaultSets: 5,
        defaultReps: 12,
        defaultWeightKg: 42.5,
      })
    ).json()) as { id: string; name: string };

    try {
      const res = await postJson({
        name: "Derived Targets",
        exercises: [
          {
            exerciseId: createdExercise.id,
            targetSets: 3,
            targetReps: 10,
            targetWeightKg: 100,
          },
        ],
      });
      expect(res.status).toBe(201);
      const plan = (await res.json()) as {
        id: string;
        exercises: Array<{
          targetSets: number;
          targetReps: number;
          targetWeightKg: number | null;
        }>;
      };
      expect(plan.exercises[0]).toMatchObject({
        targetSets: 5,
        targetReps: 12,
        targetWeightKg: 42.5,
      });

      const update = await sendJson(
        "PUT",
        `/api/gym/exercises/${createdExercise.id}`,
        {
          name: createdExercise.name,
          muscleGroup: "chest",
          defaultSets: 4,
          defaultReps: 10,
          defaultWeightKg: 50,
        }
      );
      expect(update.status).toBe(200);

      const list = await app.request("/api/gym/plans");
      const page = (await list.json()) as {
        content: Array<{
          id: string;
          exercises: Array<{
            targetSets: number;
            targetReps: number;
            targetWeightKg: number | null;
          }>;
        }>;
      };
      const updated = page.content.find((entry) => entry.id === plan.id);
      expect(updated?.exercises[0]).toMatchObject({
        targetSets: 4,
        targetReps: 10,
        targetWeightKg: 50,
      });
    } finally {
      await prisma.workoutPlan.deleteMany({ where: { name: "Derived Targets" } });
      await prisma.exercise.deleteMany({ where: { id: createdExercise.id } });
    }
  });
});
