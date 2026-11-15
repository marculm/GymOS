import { MealEstimateSchema, type MealEstimate } from "@gymos/shared";

export const MEAL_ESTIMATION_SYSTEM_PROMPT = `Estimate the nutrition of the described meal.
Return only a JSON object with a short meal name and the estimated calories, protein, carbs, and fat in grams.
Use typical portion sizes when the description is vague.
Example json: {"name":"Chicken rice bowl","macros":{"calories":610,"proteinGrams":45,"carbsGrams":62,"fatGrams":20}}`;

export function parseMealEstimate(content: string): MealEstimate | null {
  const text = content.trim();
  if (!text) return null;

  try {
    return MealEstimateSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}
