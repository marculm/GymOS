import { z } from "zod";
import { MacrosSchema, type MealEstimate } from "@gymos/shared";

const MealEstimatePayloadSchema = z.object({
  name: z.unknown().optional(),
  macros: MacrosSchema,
});

export const MEAL_ESTIMATION_SYSTEM_PROMPT = `Estimate the nutrition of the described meal.
Return only a JSON object with a short meal name (at most 120 characters) and the estimated calories, protein, carbs, and fat in grams.
Use typical portion sizes when the description is vague.
Write the meal name in the same language as the description.
Example json: {"name":"Chicken rice bowl","macros":{"calories":610,"proteinGrams":45,"carbsGrams":62,"fatGrams":20}}`;

export const MEAL_PHOTO_SYSTEM_PROMPT = `Estimate the nutrition of the meal in the photo.
When a description is included, use it as additional context and prefer its stated portions.
Return only a JSON object with a short meal name (at most 120 characters) and the estimated calories, protein, carbs, and fat in grams.
Use typical portion sizes when the portion is unclear.
Write the meal name in the same language as the description, or in English when there is no description.
Example json: {"name":"Chicken rice bowl","macros":{"calories":610,"proteinGrams":45,"carbsGrams":62,"fatGrams":20}}`;

export function parseMealEstimate(content: string): MealEstimate | null {
  const text = content.trim();
  if (!text) return null;

  try {
    const payload = MealEstimatePayloadSchema.parse(JSON.parse(text));
    const name =
      typeof payload.name === "string"
        ? payload.name.trim().slice(0, 120) || undefined
        : undefined;
    return name
      ? { name, macros: payload.macros }
      : { macros: payload.macros };
  } catch {
    return null;
  }
}
