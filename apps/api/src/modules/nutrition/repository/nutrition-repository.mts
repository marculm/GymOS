import type {
  Macros,
  NutritionLogEntry,
  NutritionLogInput,
  NutritionLogUpdate,
  Recipe as SharedRecipe,
  RecipeInput,
  RecipeUpdate,
} from "@gymos/shared";
import type {
  NutritionLog as NutritionLogRow,
  Prisma,
  Recipe as RecipeRow,
} from "../../../generated/prisma/client";
import { prisma } from "../../../config/prisma-client.mts";

type MacroRow = {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
};

function toMacros(row: MacroRow): Macros {
  return {
    calories: row.calories,
    proteinGrams: row.proteinGrams,
    carbsGrams: row.carbsGrams,
    fatGrams: row.fatGrams,
  };
}

function toLog(row: NutritionLogRow): NutritionLogEntry {
  return {
    id: row.id,
    loggedAt: row.loggedAt,
    name: row.name,
    macros: toMacros(row),
  };
}

function toRecipe(row: RecipeRow): SharedRecipe {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.sourceUrl ?? undefined,
    servings: row.servings,
    macrosPerServing: toMacros(row),
    ingredients: row.ingredients as SharedRecipe["ingredients"],
    instructions: row.instructions as string[],
  };
}

function macroPatch(input: MacroRow): MacroRow {
  return {
    calories: input.calories,
    proteinGrams: input.proteinGrams,
    carbsGrams: input.carbsGrams,
    fatGrams: input.fatGrams,
  };
}

export class NutritionRepository {
  async getTarget(userId: string): Promise<Macros | null> {
    const row = await prisma.nutritionTarget.findUnique({ where: { userId } });
    return row ? toMacros(row) : null;
  }

  async upsertTarget(userId: string, input: Macros): Promise<Macros> {
    const row = await prisma.nutritionTarget.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input },
    });
    return toMacros(row);
  }

  async listLogs(
    userId: string,
    from: Date,
    to: Date
  ): Promise<NutritionLogEntry[]> {
    const rows = await prisma.nutritionLog.findMany({
      where: { userId, loggedAt: { gte: from, lt: to } },
      orderBy: { loggedAt: "asc" },
    });
    return rows.map(toLog);
  }

  async sumLogs(userId: string, from: Date, to: Date): Promise<Macros> {
    const result = await prisma.nutritionLog.aggregate({
      where: { userId, loggedAt: { gte: from, lt: to } },
      _sum: {
        calories: true,
        proteinGrams: true,
        carbsGrams: true,
        fatGrams: true,
      },
    });
    return {
      calories: result._sum.calories ?? 0,
      proteinGrams: result._sum.proteinGrams ?? 0,
      carbsGrams: result._sum.carbsGrams ?? 0,
      fatGrams: result._sum.fatGrams ?? 0,
    };
  }

  async createLog(
    userId: string,
    input: NutritionLogInput
  ): Promise<NutritionLogEntry> {
    const row = await prisma.nutritionLog.create({
      data: {
        userId,
        name: input.name,
        ...(input.loggedAt ? { loggedAt: input.loggedAt } : {}),
        ...input.macros,
      },
    });
    return toLog(row);
  }

  async updateLog(
    userId: string,
    id: string,
    input: NutritionLogUpdate
  ): Promise<NutritionLogEntry | null> {
    const existing = await prisma.nutritionLog.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const data: Prisma.NutritionLogUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.loggedAt !== undefined) data.loggedAt = input.loggedAt;
    if (input.macros !== undefined) Object.assign(data, macroPatch(input.macros));

    const row = await prisma.nutritionLog.update({ where: { id }, data });
    return toLog(row);
  }

  async deleteLog(userId: string, id: string): Promise<boolean> {
    const result = await prisma.nutritionLog.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  async listRecipes(userId: string): Promise<SharedRecipe[]> {
    const rows = await prisma.recipe.findMany({
      where: { userId },
      orderBy: { title: "asc" },
    });
    return rows.map(toRecipe);
  }

  async createRecipe(
    userId: string,
    input: RecipeInput
  ): Promise<SharedRecipe> {
    const row = await prisma.recipe.create({
      data: {
        userId,
        title: input.title,
        sourceUrl: input.sourceUrl,
        servings: input.servings,
        ...input.macrosPerServing,
        ingredients: input.ingredients as unknown as Prisma.InputJsonValue,
        instructions: input.instructions as unknown as Prisma.InputJsonValue,
      },
    });
    return toRecipe(row);
  }

  async updateRecipe(
    userId: string,
    id: string,
    input: RecipeUpdate
  ): Promise<SharedRecipe | null> {
    const existing = await prisma.recipe.findFirst({ where: { id, userId } });
    if (!existing) return null;

    const data: Prisma.RecipeUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl;
    if (input.servings !== undefined) data.servings = input.servings;
    if (input.macrosPerServing !== undefined) {
      Object.assign(data, macroPatch(input.macrosPerServing));
    }
    if (input.ingredients !== undefined) {
      data.ingredients = input.ingredients as unknown as Prisma.InputJsonValue;
    }
    if (input.instructions !== undefined) {
      data.instructions = input.instructions as unknown as Prisma.InputJsonValue;
    }

    const row = await prisma.recipe.update({ where: { id }, data });
    return toRecipe(row);
  }

  async deleteRecipe(userId: string, id: string): Promise<boolean> {
    const result = await prisma.recipe.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}
