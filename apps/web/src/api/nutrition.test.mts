import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFolder,
  deleteFolder,
  estimateMeal,
  extractRecipe,
  listFolders,
  renameFolder,
  reorderFolders,
} from "./nutrition.mts";

const folder = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Breakfast",
  parentId: null,
  position: 0,
};

const childFolder = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Oats",
  parentId: folder.id,
  position: 0,
};

function jsonResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recipe folders", () => {
  it("lists parsed folders", async () => {
    const fetchMock = jsonResponse([folder, childFolder]);
    vi.stubGlobal("fetch", fetchMock);

    await expect(listFolders()).resolves.toEqual([folder, childFolder]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/nutrition/recipe-folders");
  });

  it("creates a nested folder", async () => {
    const fetchMock = jsonResponse(childFolder, 201);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createFolder({ name: "Oats", parentId: folder.id })
    ).resolves.toEqual(childFolder);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/nutrition/recipe-folders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Oats",
      parentId: folder.id,
    });
  });

  it("renames a folder", async () => {
    const renamed = { ...folder, name: "Morning" };
    const fetchMock = jsonResponse(renamed);
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameFolder(folder.id, { name: "Morning" })).resolves.toEqual(
      renamed
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/nutrition/recipe-folders/${folder.id}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Morning" });
  });

  it("reorders sibling folders", async () => {
    const fetchMock = jsonResponse([childFolder, folder]);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reorderFolders(null, [childFolder.id, folder.id])
    ).resolves.toEqual([childFolder, folder]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/nutrition/recipe-folders/order");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      parentId: null,
      ids: [childFolder.id, folder.id],
    });
  });

  it("deletes a folder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteFolder(folder.id)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/nutrition/recipe-folders/${folder.id}`);
    expect(init.method).toBe("DELETE");
  });
});

describe("extractRecipe", () => {
  it("posts recipe text and parses the draft", async () => {
    const draft = {
      title: "Pancakes",
      servings: 2,
      macrosPerServing: {
        calories: 410,
        proteinGrams: 12,
        carbsGrams: 60,
        fatGrams: 13,
      },
      ingredients: [{ name: "Flour", amount: 200, unit: "g" }],
      instructions: ["Mix the batter."],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(draft), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(extractRecipe({ text: "Mix the batter." })).resolves.toEqual(
      draft
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/nutrition/recipes/extract");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ text: "Mix the batter." });
  });
});

describe("estimateMeal", () => {
  it("posts a meal description and parses the estimate", async () => {
    const estimate = {
      name: "Skyr bowl",
      macros: {
        calories: 410,
        proteinGrams: 38,
        carbsGrams: 44,
        fatGrams: 6,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(estimate), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      estimateMeal({ description: "300g skyr with berries" })
    ).resolves.toEqual(estimate);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/nutrition/estimate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      description: "300g skyr with berries",
    });
  });

  it("posts a meal photo with an optional description", async () => {
    const estimate = {
      macros: { calories: 410, proteinGrams: 38, carbsGrams: 44, fatGrams: 6 },
    };
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(estimate), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = "data:image/jpeg;base64,AAAA";
    await estimateMeal({ image });
    await estimateMeal({ description: "half portion", image });

    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as RequestInit).body))
    );
    expect(bodies).toEqual([{ image }, { description: "half portion", image }]);
  });
});
