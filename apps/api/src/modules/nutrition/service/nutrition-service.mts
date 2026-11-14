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
import type { NutritionRepository } from "../repository/nutrition-repository.mts";
import { NutritionNotFoundError } from "./errors.mts";

export class NutritionService {
  constructor(private readonly repository: NutritionRepository) {}

  getTargets(userId: string): Promise<Macros | null> {
    return this.repository.getTarget(userId);
  }

  setTargets(userId: string, input: Macros): Promise<Macros> {
    return this.repository.upsertTarget(userId, input);
  }

  async summary(
    userId: string,
    from: Date,
    to: Date
  ): Promise<NutritionSummary> {
    const [totals, targets] = await Promise.all([
      this.repository.sumLogs(userId, from, to),
      this.repository.getTarget(userId),
    ]);

    return {
      from,
      to,
      totals,
      targets,
      remaining: targets
        ? {
            calories: targets.calories - totals.calories,
            proteinGrams: targets.proteinGrams - totals.proteinGrams,
            carbsGrams: targets.carbsGrams - totals.carbsGrams,
            fatGrams: targets.fatGrams - totals.fatGrams,
          }
        : null,
    };
  }

  listLogs(
    userId: string,
    from: Date,
    to: Date
  ): Promise<NutritionLogEntry[]> {
    return this.repository.listLogs(userId, from, to);
  }

  createLog(
    userId: string,
    input: NutritionLogInput
  ): Promise<NutritionLogEntry> {
    return this.repository.createLog(userId, input);
  }

  async updateLog(
    userId: string,
    id: string,
    input: NutritionLogUpdate
  ): Promise<NutritionLogEntry> {
    const entry = await this.repository.updateLog(userId, id, input);
    if (!entry) throw new NutritionNotFoundError("Meal not found");
    return entry;
  }

  async deleteLog(userId: string, id: string): Promise<void> {
    const deleted = await this.repository.deleteLog(userId, id);
    if (!deleted) throw new NutritionNotFoundError("Meal not found");
  }

  listRecipes(userId: string): Promise<Recipe[]> {
    return this.repository.listRecipes(userId);
  }

  createRecipe(userId: string, input: RecipeInput): Promise<Recipe> {
    return this.repository.createRecipe(userId, input);
  }

  async updateRecipe(
    userId: string,
    id: string,
    input: RecipeUpdate
  ): Promise<Recipe> {
    const recipe = await this.repository.updateRecipe(userId, id, input);
    if (!recipe) throw new NutritionNotFoundError("Recipe not found");
    return recipe;
  }

  async deleteRecipe(userId: string, id: string): Promise<void> {
    const deleted = await this.repository.deleteRecipe(userId, id);
    if (!deleted) throw new NutritionNotFoundError("Recipe not found");
  }
}
