import type {
  Macros,
  NutritionLogEntry,
  NutritionLogInput,
  NutritionLogUpdate,
  NutritionSummary,
  Recipe,
  RecipeInput,
  RecipeUpdate,
} from "@gymos/shared";
import {
  MacrosSchema,
  NutritionLogEntrySchema,
  NutritionSummarySchema,
  RecipeSchema,
} from "@gymos/shared";
import { api } from "./client.mts";

function rangeQuery(from: Date, to: Date): string {
  return `?${new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  }).toString()}`;
}

export async function getSummary(
  from: Date,
  to: Date
): Promise<NutritionSummary> {
  return NutritionSummarySchema.parse(
    await api.get<unknown>(`/nutrition/summary${rangeQuery(from, to)}`)
  );
}

export async function listLogs(
  from: Date,
  to: Date
): Promise<NutritionLogEntry[]> {
  return NutritionLogEntrySchema.array().parse(
    await api.get<unknown>(`/nutrition/logs${rangeQuery(from, to)}`)
  );
}

export async function createLog(
  input: NutritionLogInput
): Promise<NutritionLogEntry> {
  return NutritionLogEntrySchema.parse(
    await api.post<unknown>("/nutrition/logs", input)
  );
}

export async function updateLog(
  id: string,
  input: NutritionLogUpdate
): Promise<NutritionLogEntry> {
  return NutritionLogEntrySchema.parse(
    await api.patch<unknown>(`/nutrition/logs/${id}`, input)
  );
}

export function deleteLog(id: string): Promise<void> {
  return api.delete<void>(`/nutrition/logs/${id}`);
}

export async function getTargets(): Promise<Macros | null> {
  return MacrosSchema.nullable().parse(
    await api.get<unknown>("/nutrition/targets")
  );
}

export async function setTargets(input: Macros): Promise<Macros> {
  return MacrosSchema.parse(
    await api.put<unknown>("/nutrition/targets", input)
  );
}

export async function listRecipes(): Promise<Recipe[]> {
  return RecipeSchema.array().parse(
    await api.get<unknown>("/nutrition/recipes")
  );
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  return RecipeSchema.parse(
    await api.post<unknown>("/nutrition/recipes", input)
  );
}

export async function updateRecipe(
  id: string,
  input: RecipeUpdate
): Promise<Recipe> {
  return RecipeSchema.parse(
    await api.patch<unknown>(`/nutrition/recipes/${id}`, input)
  );
}

export function deleteRecipe(id: string): Promise<void> {
  return api.delete<void>(`/nutrition/recipes/${id}`);
}
