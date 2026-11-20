import type {
  Macros,
  MealEstimate,
  MealEstimateInput,
  NutritionLogEntry,
  NutritionLogInput,
  NutritionLogUpdate,
  NutritionSummary,
  Recipe,
  RecipeExtractionInput,
  RecipeFolder,
  RecipeInput,
  RecipeUpdate,
} from "@gymos/shared";
import {
  createFolder,
  createLog,
  createRecipe,
  deleteFolder,
  deleteLog,
  deleteRecipe,
  estimateMeal,
  extractRecipe as requestRecipeExtraction,
  getSummary,
  listFolders,
  listLogs,
  listRecipes,
  renameFolder,
  reorderFolders as requestFolderOrder,
  setTargets,
  updateLog,
  updateRecipe,
} from "../../api/nutrition.mts";

export type DayRange = { from: Date; to: Date };

export function dayRange(date = new Date()): DayRange {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export type FolderTreeEntry = { folder: RecipeFolder; depth: number };

export function folderTree(folders: RecipeFolder[]): FolderTreeEntry[] {
  const byParent = new Map<string | null, RecipeFolder[]>();
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    byParent.set(folder.parentId, siblings);
  }

  const entries: FolderTreeEntry[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of byParent.get(parentId) ?? []) {
      entries.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return entries;
}

export function folderPath(
  folders: RecipeFolder[],
  id: string
): RecipeFolder[] {
  const path: RecipeFolder[] = [];
  let parentId: string | null = id;
  while (parentId) {
    const folder = folders.find((item) => item.id === parentId);
    if (!folder) break;
    path.unshift(folder);
    parentId = folder.parentId;
  }
  return path;
}

export type RecipeGroup = {
  key: string;
  label: string;
  recipes: Recipe[];
};

export function groupRecipes(
  recipes: Recipe[],
  folders: RecipeFolder[]
): RecipeGroup[] {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const groups: RecipeGroup[] = [];
  const unfiled = recipes.filter(
    (recipe) => !recipe.folderId || !folderIds.has(recipe.folderId)
  );
  if (unfiled.length > 0) {
    groups.push({ key: "unfiled", label: "Unfiled", recipes: unfiled });
  }

  for (const { folder } of folderTree(folders)) {
    const items = recipes.filter((recipe) => recipe.folderId === folder.id);
    if (items.length === 0) continue;
    groups.push({
      key: folder.id,
      label: folderPath(folders, folder.id)
        .map((item) => item.name)
        .join(" / "),
      recipes: items,
    });
  }
  return groups;
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : "Something went wrong";
}

class NutritionData {
  summary = $state<NutritionSummary | null>(null);
  entries = $state<NutritionLogEntry[]>([]);
  recipes = $state<Recipe[]>([]);
  folders = $state<RecipeFolder[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);

  private loadedDay = "";
  private inFlight: Promise<void> | null = null;

  get range(): DayRange {
    return dayRange();
  }

  async load(force = false): Promise<void> {
    const range = this.range;
    const key = range.from.toISOString();
    if (!force && this.loadedDay === key) return;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchAll(range, key);
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async fetchAll(range: DayRange, key: string): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const [summary, entries, recipes, folders] = await Promise.all([
        getSummary(range.from, range.to),
        listLogs(range.from, range.to),
        listRecipes(),
        listFolders(),
      ]);
      this.summary = summary;
      this.entries = entries;
      this.recipes = recipes;
      this.folders = folders;
      this.loadedDay = key;
    } catch (error) {
      this.error = messageOf(error);
    } finally {
      this.loading = false;
    }
  }

  async refresh(): Promise<void> {
    const range = this.range;
    const [summary, entries] = await Promise.all([
      getSummary(range.from, range.to),
      listLogs(range.from, range.to),
    ]);
    this.summary = summary;
    this.entries = entries;
  }

  async log(input: NutritionLogInput): Promise<NutritionLogEntry> {
    const entry = await createLog(input);
    await this.refresh();
    return entry;
  }

  async updateEntry(
    id: string,
    input: NutritionLogUpdate
  ): Promise<NutritionLogEntry> {
    const entry = await updateLog(id, input);
    await this.refresh();
    return entry;
  }

  async removeEntry(id: string): Promise<void> {
    await deleteLog(id);
    await this.refresh();
  }

  estimate(input: MealEstimateInput): Promise<MealEstimate> {
    return estimateMeal(input);
  }

  extractRecipe(input: RecipeExtractionInput): Promise<RecipeInput> {
    return requestRecipeExtraction(input);
  }

  async saveTargets(input: Macros): Promise<Macros> {
    const targets = await setTargets(input);
    await this.refresh();
    return targets;
  }

  async loadRecipes(): Promise<void> {
    const [recipes, folders] = await Promise.all([
      listRecipes(),
      listFolders(),
    ]);
    this.recipes = recipes;
    this.folders = folders;
  }

  async saveFolder(
    id: string | null,
    name: string,
    parentId: string | null
  ): Promise<RecipeFolder> {
    const folderName = name.trim();
    if (id) {
      const folder = await renameFolder(id, { name: folderName });
      this.folders = this.folders.map((item) =>
        item.id === folder.id ? folder : item
      );
      return folder;
    }
    const folder = await createFolder({ name: folderName, parentId });
    this.folders = [...this.folders, folder];
    return folder;
  }

  async removeFolder(id: string): Promise<void> {
    await deleteFolder(id);
    await this.loadRecipes();
  }

  async reorderFolders(
    parentId: string | null,
    ids: string[]
  ): Promise<void> {
    this.folders = await requestFolderOrder(parentId, ids);
  }

  async saveRecipe(id: string | null, input: RecipeInput | RecipeUpdate): Promise<Recipe> {
    if (id) {
      const recipe = await updateRecipe(id, input as RecipeUpdate);
      this.recipes = this.recipes.map((item) =>
        item.id === recipe.id ? recipe : item
      );
      return recipe;
    }
    const recipe = await createRecipe(input as RecipeInput);
    this.recipes = [...this.recipes, recipe].sort((a, b) =>
      a.title.localeCompare(b.title)
    );
    return recipe;
  }

  async removeRecipe(id: string): Promise<void> {
    await deleteRecipe(id);
    this.recipes = this.recipes.filter((recipe) => recipe.id !== id);
  }
}

export const nutritionData = new NutritionData();
