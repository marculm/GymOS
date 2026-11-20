import { describe, expect, it } from "vitest";
import { MealEstimateInputSchema, MealEstimateSchema } from "./nutrition.mts";

describe("MealEstimateInputSchema", () => {
  it("trims the description and rejects blank text", () => {
    expect(
      MealEstimateInputSchema.parse({ description: "  Big Mac  " })
    ).toEqual({ description: "Big Mac" });
    expect(
      MealEstimateInputSchema.safeParse({ description: "   " }).success
    ).toBe(false);
  });

  it("rejects descriptions over 2000 characters", () => {
    expect(
      MealEstimateInputSchema.safeParse({ description: "a".repeat(2001) })
        .success
    ).toBe(false);
  });

  it("accepts an image alone or with a description", () => {
    const image = "data:image/jpeg;base64,AAAA";
    expect(MealEstimateInputSchema.parse({ image })).toEqual({ image });
    expect(
      MealEstimateInputSchema.parse({ description: "  burger  ", image })
    ).toEqual({ description: "burger", image });
  });

  it("rejects an input without text or image", () => {
    expect(MealEstimateInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an image that is not a base64 data URL", () => {
    expect(
      MealEstimateInputSchema.safeParse({
        description: "burger",
        image: "https://example.com/meal.jpg",
      }).success
    ).toBe(false);
  });

  it("rejects an image over 2 MB", () => {
    expect(
      MealEstimateInputSchema.safeParse({
        description: "burger",
        image: `data:image/jpeg;base64,${"A".repeat(2_800_000)}`,
      }).success
    ).toBe(false);
  });
});

describe("MealEstimateSchema", () => {
  it("accepts macros without a name", () => {
    expect(
      MealEstimateSchema.parse({
        macros: {
          calories: 560,
          proteinGrams: 26,
          carbsGrams: 45,
          fatGrams: 30,
        },
      })
    ).toEqual({
      macros: {
        calories: 560,
        proteinGrams: 26,
        carbsGrams: 45,
        fatGrams: 30,
      },
    });
  });

  it("rejects negative macros", () => {
    expect(
      MealEstimateSchema.safeParse({
        macros: {
          calories: -1,
          proteinGrams: 0,
          carbsGrams: 0,
          fatGrams: 0,
        },
      }).success
    ).toBe(false);
  });
});
