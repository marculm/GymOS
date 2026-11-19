import { z } from "zod";
import {
  MacrosSchema,
  RecipeIngredientSchema,
  type RecipeInput,
} from "@gymos/shared";

const RecipeExtractionPayloadSchema = z.object({
  title: z.string().trim().min(1),
  servings: z.number().int().positive(),
  macrosTotal: MacrosSchema,
  ingredients: z.array(RecipeIngredientSchema),
  instructions: z.array(z.string().trim().min(1)),
});

export const RECIPE_EXTRACTION_SYSTEM_PROMPT = `Extract one recipe from the pasted recipe text.
Return only a JSON object with the recipe title (at most 200 characters), the number of servings, the total calories, protein, carbs, and fat in grams for the whole recipe, the ingredients, and the preparation steps.
Every ingredient needs a name, a positive numeric amount, and a unit. Convert fractions to decimals, pick a value inside a range, and fill in a plausible amount and unit when the text gives none, for example {"name":"salt","amount":1,"unit":"pinch"} or {"name":"onion","amount":1,"unit":"piece"}.
Write the title, ingredients, and instructions in the same language as the recipe text.
Example json: {"title":"Chicken rice bowl","servings":4,"macrosTotal":{"calories":2440,"proteinGrams":180,"carbsGrams":248,"fatGrams":80},"ingredients":[{"name":"Chicken breast","amount":600,"unit":"g"}],"instructions":["Cook the rice.","Sear the chicken."]}`;

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function parseRecipeExtraction(content: string): RecipeInput | null {
  const text = content.trim();
  if (!text) return null;

  try {
    const payload = RecipeExtractionPayloadSchema.parse(JSON.parse(text));
    return {
      title: payload.title.slice(0, 200),
      servings: payload.servings,
      macrosPerServing: {
        calories: roundToTenth(payload.macrosTotal.calories / payload.servings),
        proteinGrams: roundToTenth(
          payload.macrosTotal.proteinGrams / payload.servings
        ),
        carbsGrams: roundToTenth(
          payload.macrosTotal.carbsGrams / payload.servings
        ),
        fatGrams: roundToTenth(payload.macrosTotal.fatGrams / payload.servings),
      },
      ingredients: payload.ingredients,
      instructions: payload.instructions,
    };
  } catch {
    return null;
  }
}
