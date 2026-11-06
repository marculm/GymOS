import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import { prisma } from "../../../src/config/prisma-client.mts";
import {
  cleanupTestUser,
  clearTestUserData,
  createTestUser,
} from "../helpers.mts";

type ExerciseBody = {
  id: string;
  name: string;
  muscleGroup: string;
  description: string | null;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
};

const createdIds: string[] = [];

beforeAll(createTestUser);
beforeEach(clearTestUserData);
afterAll(async () => {
  await clearTestUserData();
  await prisma.exercise.deleteMany({ where: { id: { in: createdIds } } });
  await cleanupTestUser();
});

function uniqueName(label: string) {
  return `zz-test-${crypto.randomUUID()}-${label}`;
}

function jsonRequest(path: string, method: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createExercise(overrides: Record<string, unknown> = {}) {
  const body = {
    name: uniqueName("exercise"),
    muscleGroup: "chest",
    ...overrides,
  };
  const res = await jsonRequest("/api/gym/exercises", "POST", body);
  expect(res.status).toBe(201);

  const exercise = (await res.json()) as ExerciseBody;
  createdIds.push(exercise.id);
  return { exercise, res };
}

describe("Gym exercise register", () => {
  it("creates an exercise with defaults and sets Location", async () => {
    const { exercise, res } = await createExercise({ description: "Pec isolation" });

    expect(exercise.name).toContain("zz-test-");
    expect(exercise.muscleGroup).toBe("chest");
    expect(exercise.description).toBe("Pec isolation");
    expect(exercise.defaultSets).toBe(3);
    expect(exercise.defaultReps).toBe(8);
    expect(exercise.defaultWeightKg).toBeNull();
    expect(res.headers.get("location")).toContain(
      `/api/gym/exercises/${exercise.id}`
    );
  });

  it("creates an exercise with explicit defaults", async () => {
    const { exercise } = await createExercise({
      defaultSets: 4,
      defaultReps: 12,
      defaultWeightKg: 15,
    });

    expect(exercise.defaultSets).toBe(4);
    expect(exercise.defaultReps).toBe(12);
    expect(exercise.defaultWeightKg).toBe(15);
  });

  it("lists an exercise and hides it after deletion", async () => {
    const { exercise } = await createExercise();

    const listed = (await (
      await app.request("/api/gym/exercises?size=100")
    ).json()) as {
      content: ExerciseBody[];
      page: { totalElements: number };
    };
    expect(listed.content.map((entry) => entry.id)).toContain(exercise.id);

    expect(
      (await jsonRequest(`/api/gym/exercises/${exercise.id}`, "DELETE")).status
    ).toBe(200);

    const afterDelete = (await (
      await app.request("/api/gym/exercises?size=100")
    ).json()) as {
      content: ExerciseBody[];
      page: { totalElements: number };
    };
    expect(afterDelete.content.map((entry) => entry.id)).not.toContain(
      exercise.id
    );
    expect(afterDelete.page.totalElements).toBe(listed.page.totalElements - 1);
  });

  it("updates an exercise", async () => {
    const { exercise } = await createExercise();
    const name = uniqueName("edited");

    const res = await jsonRequest(
      `/api/gym/exercises/${exercise.id}`,
      "PUT",
      {
        name,
        muscleGroup: "back",
        description: null,
        defaultSets: 5,
        defaultReps: 6,
        defaultWeightKg: 40.5,
      }
    );
    expect(res.status).toBe(200);

    const updated = (await res.json()) as ExerciseBody;
    expect(updated).toMatchObject({
      id: exercise.id,
      name,
      muscleGroup: "back",
      defaultSets: 5,
      defaultReps: 6,
      defaultWeightKg: 40.5,
    });
  });

  it("preserves omitted fields when updating", async () => {
    const { exercise } = await createExercise({
      description: "Keep me",
      defaultSets: 5,
      defaultReps: 12,
      defaultWeightKg: 15,
    });
    const name = uniqueName("partial");

    const res = await jsonRequest(
      `/api/gym/exercises/${exercise.id}`,
      "PUT",
      { name, muscleGroup: "back" }
    );
    expect(res.status).toBe(200);

    expect(await res.json()).toMatchObject({
      name,
      muscleGroup: "back",
      description: "Keep me",
      defaultSets: 5,
      defaultReps: 12,
      defaultWeightKg: 15,
    });
  });

  it("rejects a duplicate name on update", async () => {
    const first = await createExercise();
    const second = await createExercise();

    const res = await jsonRequest(
      `/api/gym/exercises/${second.exercise.id}`,
      "PUT",
      { name: first.exercise.name, muscleGroup: "legs" }
    );

    expect(res.status).toBe(409);
  });

  it("rejects duplicate exercise names", async () => {
    const { exercise } = await createExercise();

    const res = await jsonRequest("/api/gym/exercises", "POST", {
      name: exercise.name,
      muscleGroup: "legs",
    });

    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(((await res.json()) as { detail: string }).detail).toContain(
      "already exists"
    );
  });

  it("returns 404 for an unknown exercise on update and delete", async () => {
    const missing = "00000000-0000-4000-8000-000000000098";

    expect(
      (
        await jsonRequest(`/api/gym/exercises/${missing}`, "PUT", {
          name: uniqueName("missing"),
          muscleGroup: "core",
        })
      ).status
    ).toBe(404);
    expect(
      (await jsonRequest(`/api/gym/exercises/${missing}`, "DELETE")).status
    ).toBe(404);
  });

  it("treats an already deleted exercise as missing", async () => {
    const { exercise } = await createExercise();
    await jsonRequest(`/api/gym/exercises/${exercise.id}`, "DELETE");

    expect(
      (await jsonRequest(`/api/gym/exercises/${exercise.id}`, "DELETE")).status
    ).toBe(404);
    expect(
      (
        await jsonRequest(`/api/gym/exercises/${exercise.id}`, "PUT", {
          name: uniqueName("again"),
          muscleGroup: "core",
        })
      ).status
    ).toBe(404);
  });

  it("rejects a deleted exercise in a new plan", async () => {
    const { exercise } = await createExercise();
    await jsonRequest(`/api/gym/exercises/${exercise.id}`, "DELETE");

    const res = await jsonRequest("/api/gym/plans", "POST", {
      name: "Deleted Exercise Plan",
      exercises: [{ exerciseId: exercise.id }],
    });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { detail: string }).detail).toContain(
      "Unknown exercise"
    );
  });

  it("keeps a deleted exercise in an existing plan", async () => {
    const { exercise } = await createExercise();
    const planRes = await jsonRequest("/api/gym/plans", "POST", {
      name: "Existing Plan",
      exercises: [{ exerciseId: exercise.id }],
    });
    expect(planRes.status).toBe(201);

    await jsonRequest(`/api/gym/exercises/${exercise.id}`, "DELETE");

    const plans = (await (await app.request("/api/gym/plans")).json()) as {
      content: Array<{
        exercises: Array<{ exercise: { id: string; name: string } }>;
      }>;
    };
    const planExercise = plans.content[0]?.exercises[0];
    expect(planExercise?.exercise.id).toBe(exercise.id);
    expect(planExercise?.exercise.name).toBe(exercise.name);
  });

  it("relabels history when an exercise is renamed", async () => {
    const { exercise } = await createExercise();
    const session = (await (
      await jsonRequest("/api/gym/sessions", "POST", {})
    ).json()) as { id: string };
    await jsonRequest(`/api/gym/sessions/${session.id}/sets`, "POST", {
      exerciseId: exercise.id,
      reps: 10,
      weightKg: 20,
    });

    const name = uniqueName("renamed");
    await jsonRequest(`/api/gym/exercises/${exercise.id}`, "PUT", {
      name,
      muscleGroup: "chest",
    });

    const detail = (await (
      await app.request(`/api/gym/sessions/${session.id}`)
    ).json()) as { sets: Array<{ exerciseName: string }> };
    expect(detail.sets[0]?.exerciseName).toBe(name);
  });

  it("keeps deleted exercise names in session history", async () => {
    const { exercise } = await createExercise();
    const sessionRes = await jsonRequest("/api/gym/sessions", "POST", {});
    const session = (await sessionRes.json()) as { id: string };

    await jsonRequest(`/api/gym/exercises/${exercise.id}`, "DELETE");

    const setRes = await jsonRequest(
      `/api/gym/sessions/${session.id}/sets`,
      "POST",
      { exerciseId: exercise.id, reps: 10, weightKg: 20 }
    );
    expect(setRes.status).toBe(201);
    expect(((await setRes.json()) as { exerciseName: string }).exerciseName).toBe(
      exercise.name
    );

    const detail = (await (
      await app.request(`/api/gym/sessions/${session.id}`)
    ).json()) as { sets: Array<{ exerciseId: string; exerciseName: string }> };
    expect(detail.sets[0]?.exerciseId).toBe(exercise.id);
    expect(detail.sets[0]?.exerciseName).toBe(exercise.name);
  });
});
