import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateMeal, extractRecipe } from "./nutrition.mts";

afterEach(() => {
  vi.unstubAllGlobals();
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
