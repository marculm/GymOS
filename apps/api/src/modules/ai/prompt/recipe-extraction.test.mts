import { describe, expect, it } from "vitest";
import {
  parseRecipeExtraction,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
} from "./recipe-extraction.mts";

const completion = {
  title: "  Chicken rice bowl  ",
  servings: 4,
  macrosTotal: {
    calories: 2440,
    proteinGrams: 180,
    carbsGrams: 248,
    fatGrams: 80,
  },
  ingredients: [
    { name: "Chicken breast", amount: 600, unit: "g" },
    { name: "Salt", amount: 1, unit: "pinch" },
  ],
  instructions: ["Cook the rice.", "Sear the chicken."],
};

describe("parseRecipeExtraction", () => {
  it("divides the totals into per-serving macros", () => {
    expect(parseRecipeExtraction(JSON.stringify(completion))).toEqual({
      title: "Chicken rice bowl",
      servings: 4,
      macrosPerServing: {
        calories: 610,
        proteinGrams: 45,
        carbsGrams: 62,
        fatGrams: 20,
      },
      ingredients: completion.ingredients,
      instructions: completion.instructions,
    });
  });

  it("rounds per-serving macros to one decimal", () => {
    const result = parseRecipeExtraction(
      JSON.stringify({
        ...completion,
        servings: 3,
        macrosTotal: {
          calories: 610,
          proteinGrams: 46,
          carbsGrams: 62,
          fatGrams: 20,
        },
      })
    );

    expect(result?.macrosPerServing).toEqual({
      calories: 203.3,
      proteinGrams: 15.3,
      carbsGrams: 20.7,
      fatGrams: 6.7,
    });
  });

  it("rejects an unusable completion", () => {
    expect(parseRecipeExtraction("not json")).toBeNull();
    expect(
      parseRecipeExtraction(JSON.stringify({ ...completion, servings: 0 }))
    ).toBeNull();
    expect(
      parseRecipeExtraction(
        JSON.stringify({
          ...completion,
          ingredients: [{ name: "Salt", amount: 0, unit: "pinch" }],
        })
      )
    ).toBeNull();
  });

  it("asks for totals, normalized ingredients, and the input language", () => {
    expect(RECIPE_EXTRACTION_SYSTEM_PROMPT).toContain(
      "same language as the recipe text"
    );
    expect(RECIPE_EXTRACTION_SYSTEM_PROMPT).toContain("pinch");
    expect(RECIPE_EXTRACTION_SYSTEM_PROMPT).toContain("number of servings");
  });
});
