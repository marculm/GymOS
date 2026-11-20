import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../../src/app.mts";
import { prisma } from "../../../src/config/prisma-client.mts";
import {
  cleanupTestUser,
  clearTestUserData,
  createTestUser,
  createUser,
  deleteUser,
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

  describe("recipe folders", () => {
    it("creates top-level and nested folders and renames one", async () => {
      const breakfast = await sendJson(
        "POST",
        "/api/nutrition/recipe-folders",
        { name: "  Breakfast  " }
      );
      expect(breakfast.status).toBe(201);
      const breakfastFolder = await breakfast.json();
      expect(breakfastFolder).toMatchObject({
        name: "Breakfast",
        parentId: null,
        position: 0,
      });

      const lunch = await sendJson(
        "POST",
        "/api/nutrition/recipe-folders",
        { name: "Lunch" }
      );
      expect(lunch.status).toBe(201);
      expect((await lunch.json()).position).toBe(1);

      const oats = await sendJson(
        "POST",
        "/api/nutrition/recipe-folders",
        { name: "Oats", parentId: breakfastFolder.id }
      );
      expect(oats.status).toBe(201);
      expect(await oats.json()).toMatchObject({
        name: "Oats",
        parentId: breakfastFolder.id,
        position: 0,
      });

      const list = await get("/api/nutrition/recipe-folders");
      expect(list.status).toBe(200);
      const folders = await list.json();
      expect(
        folders.map(
          (folder: { name: string; parentId: string | null }) =>
            `${folder.name}:${folder.parentId ?? "root"}`
        )
      ).toEqual(
        expect.arrayContaining([
          "Breakfast:root",
          "Lunch:root",
          `Oats:${breakfastFolder.id}`,
        ])
      );

      const folderId = folders.find(
        (folder: { name: string }) => folder.name === "Lunch"
      ).id;
      const renamed = await sendJson(
        "PATCH",
        `/api/nutrition/recipe-folders/${folderId}`,
        { name: "Lunch & dinner" }
      );
      expect(renamed.status).toBe(200);
      expect((await renamed.json()).name).toBe("Lunch & dinner");

      const reloaded = await get("/api/nutrition/recipe-folders");
      expect(
        (await reloaded.json()).find(
          (folder: { id: string }) => folder.id === folderId
        ).name
      ).toBe("Lunch & dinner");
    });

    it("rejects a blank folder name and an unknown parent", async () => {
      const blank = await sendJson(
        "POST",
        "/api/nutrition/recipe-folders",
        { name: "   " }
      );
      expect(blank.status).toBe(422);

      const unknownParent = await sendJson(
        "POST",
        "/api/nutrition/recipe-folders",
        {
          name: "Dinner",
          parentId: "00000000-0000-4000-8000-000000000000",
        }
      );
      expect(unknownParent.status).toBe(404);
    });

    it("reorders sibling folders and persists the order", async () => {
      async function createFolder(name: string, parentId: string | null = null) {
        const response = await sendJson(
          "POST",
          "/api/nutrition/recipe-folders",
          { name, parentId }
        );
        return response.json() as Promise<{ id: string; name: string }>;
      }

      const dinner = await createFolder("Dinner");
      const breakfast = await createFolder("Breakfast");
      const lunch = await createFolder("Lunch");
      const second = await createFolder("Second", breakfast.id);
      const first = await createFolder("First", breakfast.id);

      const reordered = await sendJson(
        "PUT",
        "/api/nutrition/recipe-folders/order",
        { parentId: null, ids: [lunch.id, dinner.id, breakfast.id] }
      );
      expect(reordered.status).toBe(200);

      const list = (await (
        await get("/api/nutrition/recipe-folders")
      ).json()) as Array<{
        id: string;
        name: string;
        parentId: string | null;
        position: number;
      }>;
      const topLevel = list
        .filter((folder) => folder.parentId === null)
        .sort((a, b) => a.position - b.position);
      expect(topLevel.map((folder) => folder.name)).toEqual([
        "Lunch",
        "Dinner",
        "Breakfast",
      ]);

      const children = list
        .filter((folder) => folder.parentId === breakfast.id)
        .sort((a, b) => a.position - b.position);
      expect(children.map((folder) => folder.name)).toEqual(["Second", "First"]);
      expect(children.map((folder) => folder.id)).toEqual([
        second.id,
        first.id,
      ]);
    });

    it("rejects a reorder that mixes in a folder from another parent", async () => {
      const parent = await (
        await sendJson("POST", "/api/nutrition/recipe-folders", {
          name: "Parent",
        })
      ).json();
      const child = await (
        await sendJson("POST", "/api/nutrition/recipe-folders", {
          name: "Child",
          parentId: parent.id,
        })
      ).json();

      const response = await sendJson(
        "PUT",
        "/api/nutrition/recipe-folders/order",
        { parentId: null, ids: [parent.id, child.id] }
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain(
        "application/problem+json"
      );
    });

    it("assigns a recipe to a folder and moves it back to the top level", async () => {
      const folder = await (
        await sendJson("POST", "/api/nutrition/recipe-folders", {
          name: "Dinner",
        })
      ).json();
      const body = {
        title: "Salmon",
        servings: 1,
        macrosPerServing: secondMeal.macros,
        ingredients: [{ name: "Salmon", amount: 200, unit: "g" }],
        instructions: ["Bake the salmon."],
      };

      const created = await sendJson("POST", "/api/nutrition/recipes", {
        ...body,
        folderId: folder.id,
      });
      expect(created.status).toBe(201);
      const recipe = await created.json();
      expect(recipe.folderId).toBe(folder.id);

      const listed = (await (
        await get("/api/nutrition/recipes")
      ).json()) as Array<{ id: string; folderId: string | null }>;
      expect(listed.find((item) => item.id === recipe.id)?.folderId).toBe(
        folder.id
      );

      const cleared = await sendJson(
        "PATCH",
        `/api/nutrition/recipes/${recipe.id}`,
        { folderId: null }
      );
      expect(cleared.status).toBe(200);
      expect((await cleared.json()).folderId).toBeNull();

      const unknown = "00000000-0000-4000-8000-000000000000";
      const badCreate = await sendJson("POST", "/api/nutrition/recipes", {
        ...body,
        folderId: unknown,
      });
      expect(badCreate.status).toBe(404);

      const badUpdate = await sendJson(
        "PATCH",
        `/api/nutrition/recipes/${recipe.id}`,
        { folderId: unknown }
      );
      expect(badUpdate.status).toBe(404);
    });

    it("keeps another user's folders inaccessible", async () => {
      const other = await createUser(
        `folders-${crypto.randomUUID()}@gymos.app`
      );
      const foreign = await prisma.recipeFolder.create({
        data: { userId: other.id, name: "Secret", position: 0 },
      });

      try {
        const list = await get("/api/nutrition/recipe-folders");
        expect(
          (await list.json()).some(
            (folder: { id: string }) => folder.id === foreign.id
          )
        ).toBe(false);

        const rename = await sendJson(
          "PATCH",
          `/api/nutrition/recipe-folders/${foreign.id}`,
          { name: "Stolen" }
        );
        expect(rename.status).toBe(404);

        const remove = await app.request(
          `/api/nutrition/recipe-folders/${foreign.id}`,
          { method: "DELETE" }
        );
        expect(remove.status).toBe(404);

        const nesting = await sendJson(
          "POST",
          "/api/nutrition/recipe-folders",
          { name: "Nested", parentId: foreign.id }
        );
        expect(nesting.status).toBe(404);
      } finally {
        await prisma.recipeFolder.deleteMany({ where: { userId: other.id } });
        await deleteUser(other.id);
      }
    });
  });
});
