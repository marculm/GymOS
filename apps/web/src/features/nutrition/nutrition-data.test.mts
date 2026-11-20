import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe, RecipeFolder } from "@gymos/shared";
import {
  createFolder,
  deleteFolder,
  listFolders,
  listRecipes,
  renameFolder,
  reorderFolders,
} from "../../api/nutrition.mts";
import { nutritionData } from "./nutrition-data.svelte.ts";

vi.mock("../../api/nutrition.mts", () => ({
  getSummary: vi.fn(),
  listLogs: vi.fn(),
  listRecipes: vi.fn(),
  listFolders: vi.fn(),
  getTargets: vi.fn(),
  createLog: vi.fn(),
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
  setTargets: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  reorderFolders: vi.fn(),
  deleteFolder: vi.fn(),
  estimateMeal: vi.fn(),
  extractRecipe: vi.fn(),
}));

const folder: RecipeFolder = {
  id: "folder-1",
  name: "Breakfast",
  parentId: null,
  position: 0,
};

const otherFolder: RecipeFolder = {
  id: "folder-2",
  name: "Dinner",
  parentId: null,
  position: 1,
};

const recipe: Recipe = {
  id: "recipe-1",
  title: "Oats",
  servings: 1,
  macrosPerServing: {
    calories: 410,
    proteinGrams: 12,
    carbsGrams: 60,
    fatGrams: 13,
  },
  ingredients: [],
  instructions: [],
  folderId: folder.id,
};

beforeEach(() => {
  vi.clearAllMocks();
  nutritionData.recipes = [];
  nutritionData.folders = [];
});

describe("nutrition data folders", () => {
  it("loads folders together with recipes", async () => {
    vi.mocked(listRecipes).mockResolvedValue([recipe]);
    vi.mocked(listFolders).mockResolvedValue([folder, otherFolder]);

    await nutritionData.loadRecipes();

    expect(nutritionData.recipes).toEqual([recipe]);
    expect(nutritionData.folders).toEqual([folder, otherFolder]);
  });

  it("creates a top-level folder and appends it", async () => {
    vi.mocked(createFolder).mockResolvedValue(folder);

    await nutritionData.saveFolder(null, "  Breakfast ", null);

    expect(createFolder).toHaveBeenCalledWith({
      name: "Breakfast",
      parentId: null,
    });
    expect(nutritionData.folders).toEqual([folder]);
  });

  it("creates a nested folder under the given parent", async () => {
    const child: RecipeFolder = {
      id: "folder-3",
      name: "Oats",
      parentId: folder.id,
      position: 0,
    };
    vi.mocked(createFolder).mockResolvedValue(child);

    await nutritionData.saveFolder(null, "Oats", folder.id);

    expect(createFolder).toHaveBeenCalledWith({
      name: "Oats",
      parentId: folder.id,
    });
  });

  it("renames a folder in place", async () => {
    nutritionData.folders = [folder, otherFolder];
    vi.mocked(renameFolder).mockResolvedValue({ ...folder, name: "Morning" });

    await nutritionData.saveFolder(folder.id, " Morning ", null);

    expect(renameFolder).toHaveBeenCalledWith(folder.id, { name: "Morning" });
    expect(nutritionData.folders.map((item) => item.name)).toEqual([
      "Morning",
      "Dinner",
    ]);
  });

  it("stores the reordered folders returned by the API", async () => {
    vi.mocked(reorderFolders).mockResolvedValue([
      { ...otherFolder, position: 0 },
      { ...folder, position: 1 },
    ]);

    await nutritionData.reorderFolders(null, [otherFolder.id, folder.id]);

    expect(reorderFolders).toHaveBeenCalledWith(null, [
      otherFolder.id,
      folder.id,
    ]);
    expect(nutritionData.folders.map((item) => item.name)).toEqual([
      "Dinner",
      "Breakfast",
    ]);
  });

  it("reloads recipes and folders after deleting a folder", async () => {
    const unfiled = { ...recipe, folderId: null };
    vi.mocked(deleteFolder).mockResolvedValue(undefined);
    vi.mocked(listRecipes).mockResolvedValue([unfiled]);
    vi.mocked(listFolders).mockResolvedValue([otherFolder]);

    await nutritionData.removeFolder(folder.id);

    expect(deleteFolder).toHaveBeenCalledWith(folder.id);
    expect(nutritionData.recipes).toEqual([unfiled]);
    expect(nutritionData.folders).toEqual([otherFolder]);
  });
});
