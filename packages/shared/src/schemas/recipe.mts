import { z } from "zod";
import { MacrosSchema } from "./nutrition.mts";

export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
});

export const RecipeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  servings: z.number().int().positive().default(1),
  macrosPerServing: MacrosSchema,
  ingredients: z.array(RecipeIngredientSchema),
  instructions: z.array(z.string()),
});

export const RecipeInputSchema = RecipeSchema.omit({ id: true });

export const RecipeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  servings: z.number().int().positive().optional(),
  macrosPerServing: MacrosSchema.optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  instructions: z.array(z.string()).optional(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
export type RecipeUpdate = z.infer<typeof RecipeUpdateSchema>;
