import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import {
  cleanupTestUser,
  clearTestUserData,
  createTestUser,
} from "../helpers.mts";

const FROM = new Date("2026-11-14T00:00:00.000Z");
const TO = new Date("2026-11-15T00:00:00.000Z");

const targets = {
  calories: 2400,
  proteinGrams: 160,
  carbsGrams: 260,
  fatGrams: 75,
};

const firstMeal = {
  name: "Oats & whey",
  loggedAt: "2026-11-14T08:10:00.000Z",
  macros: {
    calories: 420,
    proteinGrams: 32,
    carbsGrams: 48,
    fatGrams: 11,
  },
};

const secondMeal = {
  name: "Chicken rice bowl",
  loggedAt: "2026-11-14T12:40:00.000Z",
  macros: {
    calories: 610,
    proteinGrams: 45,
    carbsGrams: 62,
    fatGrams: 20,
  },
};

beforeAll(createTestUser);
beforeEach(clearTestUserData);
afterAll(cleanupTestUser);

function rangeQuery(): string {
  return new URLSearchParams({
    from: FROM.toISOString(),
    to: TO.toISOString(),
  }).toString();
}

function sendJson(method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get(path: string) {
  return app.request(path);
}

describe("nutrition API", () => {
  it("stores and returns daily targets", async () => {
    const empty = await get("/api/nutrition/targets");
    expect(empty.status).toBe(200);
    expect(await empty.json()).toBeNull();

    const saved = await sendJson("PUT", "/api/nutrition/targets", targets);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual(targets);

    const loaded = await get("/api/nutrition/targets");
    expect(await loaded.json()).toEqual(targets);
  });

  it("rejects a negative target", async () => {
    const res = await sendJson("PUT", "/api/nutrition/targets", {
      ...targets,
      calories: -1,
    });
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("logs a day and summarizes the range", async () => {
    await sendJson("PUT", "/api/nutrition/targets", targets);

    const first = await sendJson("POST", "/api/nutrition/logs", firstMeal);
    expect(first.status).toBe(201);
    const firstEntry = await first.json();
    expect(firstEntry.name).toBe(firstMeal.name);
    expect(firstEntry.macros).toEqual(firstMeal.macros);

    const second = await sendJson("POST", "/api/nutrition/logs", secondMeal);
    expect(second.status).toBe(201);
    const secondEntry = await second.json();

    const outside = await sendJson("POST", "/api/nutrition/logs", {
      ...firstMeal,
      name: "Late snack",
      loggedAt: "2026-11-15T01:00:00.000Z",
    });
    expect(outside.status).toBe(201);

    const logs = await get(`/api/nutrition/logs?${rangeQuery()}`);
    expect(logs.status).toBe(200);
    const entries = await logs.json();
    expect(entries.map((entry: { name: string }) => entry.name)).toEqual([
      "Oats & whey",
      "Chicken rice bowl",
    ]);

    const summary = await get(`/api/nutrition/summary?${rangeQuery()}`);
    expect(summary.status).toBe(200);
    const day = await summary.json();
    expect(day.totals).toEqual({
      calories: 1030,
      proteinGrams: 77,
      carbsGrams: 110,
      fatGrams: 31,
    });
    expect(day.targets).toEqual(targets);
    expect(day.remaining).toEqual({
      calories: 1370,
      proteinGrams: 83,
      carbsGrams: 150,
      fatGrams: 44,
    });

    const patched = await sendJson(
      "PATCH",
      `/api/nutrition/logs/${firstEntry.id}`,
      {
        name: "Oats, whey & berries",
        macros: { ...firstMeal.macros, calories: 450 },
      }
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).name).toBe("Oats, whey & berries");

    const afterPatch = await (await get(`/api/nutrition/summary?${rangeQuery()}`)).json();
    expect(afterPatch.totals.calories).toBe(1060);

    const deleted = await app.request(
      `/api/nutrition/logs/${secondEntry.id}`,
      { method: "DELETE" }
    );
    expect(deleted.status).toBe(204);

    const remaining = await (await get(`/api/nutrition/logs?${rangeQuery()}`)).json();
    expect(remaining).toHaveLength(1);
  });

  it("rejects a log without a name and an invalid range", async () => {
    const invalidLog = await sendJson("POST", "/api/nutrition/logs", {
      ...firstMeal,
      name: "",
    });
    expect(invalidLog.status).toBe(422);

    const invalidRange = await get(
      `/api/nutrition/summary?from=${TO.toISOString()}&to=${FROM.toISOString()}`
    );
    expect(invalidRange.status).toBe(422);
  });

  it("manages recipes and returns 404 for another user's recipe", async () => {
    const body = {
      title: "Chicken rice bowl",
      servings: 2,
      macrosPerServing: secondMeal.macros,
      ingredients: [
        { name: "Chicken breast", amount: 300, unit: "g" },
        { name: "Rice", amount: 200, unit: "g" },
      ],
      instructions: ["Cook the rice.", "Sear the chicken."],
    };

    const created = await sendJson("POST", "/api/nutrition/recipes", body);
    expect(created.status).toBe(201);
    const recipe = await created.json();
    expect(recipe.title).toBe(body.title);
    expect(recipe.macrosPerServing).toEqual(body.macrosPerServing);
    expect(recipe.ingredients).toEqual(body.ingredients);

    const list = await get("/api/nutrition/recipes");
    expect(list.status).toBe(200);
    expect((await list.json())).toHaveLength(1);

    const patched = await sendJson(
      "PATCH",
      `/api/nutrition/recipes/${recipe.id}`,
      { title: "Chicken rice bowl, v2" }
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).title).toBe("Chicken rice bowl, v2");

    const removed = await app.request(`/api/nutrition/recipes/${recipe.id}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(204);
    expect(await (await get("/api/nutrition/recipes")).json()).toEqual([]);

    const missing = await sendJson(
      "PATCH",
      "/api/nutrition/recipes/00000000-0000-4000-8000-000000000000",
      { title: "Missing" }
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toContain(
      "application/problem+json"
    );
  });
});
