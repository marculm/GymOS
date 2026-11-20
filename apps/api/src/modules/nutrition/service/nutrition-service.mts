import type {
  Macros,
  NutritionLogEntry,
  NutritionLogInput,
  NutritionLogUpdate,
  NutritionSummary,
  Recipe,
  RecipeFolder,
  RecipeFolderInput,
  RecipeFolderOrder,
  RecipeFolderUpdate,
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

  listFolders(userId: string): Promise<RecipeFolder[]> {
    return this.repository.listFolders(userId);
  }

  async createFolder(
    userId: string,
    input: RecipeFolderInput
  ): Promise<RecipeFolder> {
    if (input.parentId) {
      const parent = await this.repository.findFolder(userId, input.parentId);
      if (!parent) throw new NutritionNotFoundError("Folder not found");
    }
    return this.repository.createFolder(userId, input);
  }

  async renameFolder(
    userId: string,
    id: string,
    input: RecipeFolderUpdate
  ): Promise<RecipeFolder> {
    const folder = await this.repository.updateFolder(userId, id, input);
    if (!folder) throw new NutritionNotFoundError("Folder not found");
    return folder;
  }

  async reorderFolders(
    userId: string,
    input: RecipeFolderOrder
  ): Promise<RecipeFolder[]> {
    const folders = await this.repository.listFolders(userId);
    const siblings = new Set(
      folders
        .filter((folder) => folder.parentId === input.parentId)
        .map((folder) => folder.id)
    );
    if (
      siblings.size !== input.ids.length ||
      input.ids.some((id) => !siblings.has(id))
    ) {
      throw new NutritionNotFoundError("Folder not found");
    }
    return this.repository.reorderFolders(userId, input.parentId, input.ids);
  }

  listRecipes(userId: string): Promise<Recipe[]> {
    return this.repository.listRecipes(userId);
  }

  private async assertFolder(
    userId: string,
    folderId: string | null | undefined
  ): Promise<void> {
    if (!folderId) return;
    const folder = await this.repository.findFolder(userId, folderId);
    if (!folder) throw new NutritionNotFoundError("Folder not found");
  }

  async createRecipe(userId: string, input: RecipeInput): Promise<Recipe> {
    await this.assertFolder(userId, input.folderId);
    return this.repository.createRecipe(userId, input);
  }

  async updateRecipe(
    userId: string,
    id: string,
    input: RecipeUpdate
  ): Promise<Recipe> {
    await this.assertFolder(userId, input.folderId);
    const recipe = await this.repository.updateRecipe(userId, id, input);
    if (!recipe) throw new NutritionNotFoundError("Recipe not found");
    return recipe;
  }

  async deleteRecipe(userId: string, id: string): Promise<void> {
    const deleted = await this.repository.deleteRecipe(userId, id);
    if (!deleted) throw new NutritionNotFoundError("Recipe not found");
  }
}
