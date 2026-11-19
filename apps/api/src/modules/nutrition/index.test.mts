import { beforeEach, describe, expect, it, vi } from "vitest";

const { estimateMeal, extractRecipe, getUser } = vi.hoisted(() => ({
  estimateMeal: vi.fn(),
  extractRecipe: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("../../config/prisma-client.mts", () => ({ prisma: {} }));
vi.mock("../../container.mts", () => ({
  container: {
    currentUserService: { get: getUser },
    nutritionService: {},
    aiService: { estimateMeal, extractRecipe },
  },
}));

import { nutritionModule } from "./index.mts";

const estimate = {
  name: "Skyr bowl",
  macros: {
    calories: 410,
    proteinGrams: 38,
    carbsGrams: 44,
    fatGrams: 6,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: "user-1" });
});

function postEstimate(body: unknown) {
  return nutritionModule.request("/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /recipes/extract", () => {
  it("extracts a recipe from trimmed text", async () => {
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
    extractRecipe.mockResolvedValue(draft);

    const response = await nutritionModule.request("/recipes/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "  Mix the batter.  " }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(draft);
    expect(extractRecipe).toHaveBeenCalledWith("Mix the batter.");
  });
});

describe("POST /estimate", () => {
  it("estimates a described meal", async () => {
    estimateMeal.mockResolvedValue(estimate);

    const response = await postEstimate({
      description: "  300g skyr with berries  ",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(estimate);
    expect(estimateMeal).toHaveBeenCalledWith("300g skyr with berries");
  });
});
