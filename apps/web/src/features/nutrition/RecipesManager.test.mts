import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { Recipe } from "@gymos/shared";

const nutritionApi = vi.hoisted(() => ({
  getSummary: vi.fn(),
  listLogs: vi.fn(),
  listRecipes: vi.fn(),
  getTargets: vi.fn(),
  createLog: vi.fn(),
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
  setTargets: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

vi.mock("../../api/nutrition.mts", () => nutritionApi);

import RecipesManager from "./RecipesManager.svelte";
import { nutritionData } from "./nutrition-data.svelte.ts";

const recipe: Recipe = {
  id: "recipe-1",
  title: "Chicken rice bowl",
  servings: 2,
  macrosPerServing: {
    calories: 610,
    proteinGrams: 45,
    carbsGrams: 62,
    fatGrams: 20,
  },
  ingredients: [{ name: "Chicken breast", amount: 300, unit: "g" }],
  instructions: ["Cook the rice."],
};

beforeEach(() => {
  vi.clearAllMocks();
  nutritionData.recipes = [];
  nutritionApi.listRecipes.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function fillRecipeFields() {
  await fireEvent.input(screen.getByLabelText("Name"), {
    target: { value: recipe.title },
  });
  await fireEvent.input(screen.getByLabelText("Servings"), {
    target: { value: "2" },
  });
  await fireEvent.input(screen.getByLabelText("Calories per serving"), {
    target: { value: "610" },
  });
  await fireEvent.input(screen.getByLabelText("Protein per serving"), {
    target: { value: "45" },
  });
  await fireEvent.input(screen.getByLabelText("Carbs per serving"), {
    target: { value: "62" },
  });
  await fireEvent.input(screen.getByLabelText("Fat per serving"), {
    target: { value: "20" },
  });
}

describe("RecipesManager", () => {
  it("lists saved recipes", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    render(RecipesManager);

    expect(await screen.findByText("Chicken rice bowl")).toBeInTheDocument();
    expect(
      screen.getByText(/610 kcal per serving, 2 servings/)
    ).toBeInTheDocument();
  });

  it("creates a recipe", async () => {
    nutritionApi.createRecipe.mockResolvedValue(recipe);
    render(RecipesManager);

    await fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));
    await fillRecipeFields();
    await fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    await waitFor(() =>
      expect(nutritionApi.createRecipe).toHaveBeenCalledWith({
        title: recipe.title,
        servings: 2,
        macrosPerServing: recipe.macrosPerServing,
        ingredients: [],
        instructions: [],
      })
    );
    expect(await screen.findByText("Chicken rice bowl")).toBeInTheDocument();
  });

  it("opens the recipe detail", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    render(RecipesManager);

    await fireEvent.click(await screen.findByRole("button", { name: /^Chicken rice bowl/ }));

    expect(
      screen.getByRole("heading", { name: "Chicken rice bowl" })
    ).toBeInTheDocument();
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    expect(screen.getByText("Cook the rice.")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Recipes" }));

    expect(
      await screen.findByRole("button", { name: /^Chicken rice bowl/ })
    ).toBeInTheDocument();
  });

  it("reports whether a recipe form is open", async () => {
    const onEditingChange = vi.fn();
    render(RecipesManager, { props: { onEditingChange } });

    await fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));
    await waitFor(() => expect(onEditingChange).toHaveBeenLastCalledWith(true));

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onEditingChange).toHaveBeenLastCalledWith(false));
  });

  it("keeps the edit form open when the list is clicked", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    render(RecipesManager);

    await fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicken rice bowl" })
    );

    expect(screen.queryByRole("button", { name: /^Chicken rice bowl/ })).toBeNull();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("deletes a recipe after confirmation", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    nutritionApi.deleteRecipe.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(RecipesManager);

    await screen.findByText("Chicken rice bowl");
    await fireEvent.click(
      screen.getByRole("button", { name: "Delete Chicken rice bowl" })
    );

    await waitFor(() =>
      expect(nutritionApi.deleteRecipe).toHaveBeenCalledWith(recipe.id)
    );
    expect(await screen.findByText("No recipes yet.")).toBeInTheDocument();
  });
});
