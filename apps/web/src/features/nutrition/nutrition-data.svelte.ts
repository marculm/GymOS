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
  createLog,
  createRecipe,
  deleteLog,
  deleteRecipe,
  getSummary,
  listLogs,
  listRecipes,
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

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : "Something went wrong";
}

class NutritionData {
  summary = $state<NutritionSummary | null>(null);
  entries = $state<NutritionLogEntry[]>([]);
  recipes = $state<Recipe[]>([]);
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
      const [summary, entries, recipes] = await Promise.all([
        getSummary(range.from, range.to),
        listLogs(range.from, range.to),
        listRecipes(),
      ]);
      this.summary = summary;
      this.entries = entries;
      this.recipes = recipes;
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

  async saveTargets(input: Macros): Promise<Macros> {
    const targets = await setTargets(input);
    await this.refresh();
    return targets;
  }

  async loadRecipes(): Promise<void> {
    this.recipes = await listRecipes();
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
