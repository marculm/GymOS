import { describe, expect, it } from "vitest";
import { RecipeExtractionInputSchema } from "./recipe.mts";

describe("RecipeExtractionInputSchema", () => {
  it("trims pasted recipe text", () => {
    expect(
      RecipeExtractionInputSchema.parse({ text: "  Mix the batter.  " })
    ).toEqual({ text: "Mix the batter." });
  });

  it("rejects blank text", () => {
    expect(() =>
      RecipeExtractionInputSchema.parse({ text: "   " })
    ).toThrow();
  });

  it("rejects text over 8000 characters", () => {
    expect(() =>
      RecipeExtractionInputSchema.parse({ text: "a".repeat(8001) })
    ).toThrow();
  });
});
