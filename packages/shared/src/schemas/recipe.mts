import { z } from "zod";
import { MacrosSchema } from "./nutrition.mts";

export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
});

export const RecipeFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  parentId: z.string().uuid().nullable(),
  position: z.number().int().nonnegative(),
});

export const RecipeFolderInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.string().uuid().nullable().optional(),
});

export const RecipeFolderUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const RecipeFolderOrderSchema = z.object({
  parentId: z.string().uuid().nullable(),
  ids: z.array(z.string().uuid()).min(1),
});

export const RecipeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  servings: z.number().int().positive().default(1),
  macrosPerServing: MacrosSchema,
  ingredients: z.array(RecipeIngredientSchema),
  instructions: z.array(z.string()),
  folderId: z.string().uuid().nullable().optional(),
});

export const RecipeInputSchema = RecipeSchema.omit({ id: true });

export const RecipeExtractionInputSchema = z.object({
  text: z.string().trim().min(1).max(8000),
});

export const RecipeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  servings: z.number().int().positive().optional(),
  macrosPerServing: MacrosSchema.optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  instructions: z.array(z.string()).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
export type RecipeFolder = z.infer<typeof RecipeFolderSchema>;
export type RecipeFolderInput = z.infer<typeof RecipeFolderInputSchema>;
export type RecipeFolderUpdate = z.infer<typeof RecipeFolderUpdateSchema>;
export type RecipeFolderOrder = z.infer<typeof RecipeFolderOrderSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
export type RecipeExtractionInput = z.infer<typeof RecipeExtractionInputSchema>;
export type RecipeUpdate = z.infer<typeof RecipeUpdateSchema>;
