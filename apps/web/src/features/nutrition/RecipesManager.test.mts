import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import type { Recipe, RecipeFolder } from "@gymos/shared";

const nutritionApi = vi.hoisted(() => ({
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
  extractRecipe: vi.fn(),
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

const breakfast: RecipeFolder = {
  id: "folder-1",
  name: "Breakfast",
  parentId: null,
  position: 0,
};

const dinner: RecipeFolder = {
  id: "folder-2",
  name: "Dinner",
  parentId: null,
  position: 1,
};

const oatsFolder: RecipeFolder = {
  id: "folder-3",
  name: "Oats",
  parentId: breakfast.id,
  position: 0,
};

const nestedRecipe: Recipe = { ...recipe, id: "recipe-2", title: "Overnight oats", folderId: breakfast.id };

beforeEach(() => {
  vi.clearAllMocks();
  nutritionData.recipes = [];
  nutritionData.folders = [];
  nutritionApi.listRecipes.mockResolvedValue([]);
  nutritionApi.listFolders.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.querySelectorAll(".space-screen").forEach((node) => node.remove());
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

  it("imports a recipe from pasted text", async () => {
    const draft = {
      title: "Pancakes",
      servings: 2,
      macrosPerServing: {
        calories: 410,
        proteinGrams: 12,
        carbsGrams: 60,
        fatGrams: 13,
      },
      ingredients: [{ name: "Flour", amount: 200, unit: "g" }],
      instructions: ["Mix the batter."],
    };
    nutritionApi.extractRecipe.mockResolvedValue(draft);
    render(RecipesManager);

    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );
    await fireEvent.input(screen.getByLabelText("Recipe text"), {
      target: { value: "  Mix the batter.  " },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    await waitFor(() =>
      expect(nutritionApi.extractRecipe).toHaveBeenCalledWith({
        text: "Mix the batter.",
      })
    );
    expect(await screen.findByLabelText("Name")).toHaveValue("Pancakes");
    expect(screen.getByLabelText("Servings")).toHaveValue(2);
    expect(screen.getByLabelText("Ingredient")).toHaveValue("Flour");
    expect(screen.getByLabelText("Instructions")).toHaveValue(
      "Mix the batter."
    );
    expect(nutritionApi.createRecipe).not.toHaveBeenCalled();
  });

  it("discards an imported draft on cancel", async () => {
    nutritionApi.extractRecipe.mockResolvedValue({
      title: "Pancakes",
      servings: 2,
      macrosPerServing: {
        calories: 410,
        proteinGrams: 12,
        carbsGrams: 60,
        fatGrams: 13,
      },
      ingredients: [],
      instructions: [],
    });
    render(RecipesManager);

    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );
    await fireEvent.input(screen.getByLabelText("Recipe text"), {
      target: { value: "Mix the batter." },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Extract" }));
    expect(await screen.findByLabelText("Name")).toHaveValue("Pancakes");

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.click(
      await screen.findByRole("button", { name: "Add recipe" })
    );

    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("keeps the pasted text when the import fails", async () => {
    nutritionApi.extractRecipe.mockRejectedValue(
      new Error(
        "The AI service is unavailable. Try again or enter the values manually."
      )
    );
    render(RecipesManager);

    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );
    await fireEvent.input(screen.getByLabelText("Recipe text"), {
      target: { value: "Mix the batter." },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI service is unavailable. Try again or enter the values manually."
    );
    expect(screen.getByLabelText("Recipe text")).toHaveValue(
      "Mix the batter."
    );
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("hides the empty state while the import step is open", async () => {
    render(RecipesManager);

    expect(await screen.findByText("No recipes yet.")).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );

    expect(screen.queryByText("No recipes yet.")).toBeNull();
  });

  it("cancels a pending import", async () => {
    let resolveExtract: (value: unknown) => void = () => {};
    nutritionApi.extractRecipe.mockReturnValue(
      new Promise((resolve) => {
        resolveExtract = resolve;
      })
    );
    render(RecipesManager);

    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );
    await fireEvent.input(screen.getByLabelText("Recipe text"), {
      target: { value: "Mix the batter." },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Extract" }));

    expect(
      screen.getByRole("button", { name: "Extracting…" })
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    resolveExtract({
      title: "Pancakes",
      servings: 2,
      macrosPerServing: {
        calories: 410,
        proteinGrams: 12,
        carbsGrams: 60,
        fatGrams: 13,
      },
      ingredients: [],
      instructions: [],
    });
    await tick();

    expect(screen.queryByLabelText("Name")).toBeNull();
    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );
    expect(screen.getByLabelText("Recipe text")).toBeEnabled();
  });

  it("focuses the import step and restores focus on cancel", async () => {
    render(RecipesManager);

    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );
    expect(screen.getByLabelText("Recipe text")).toHaveFocus();

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("button", { name: "Import from text" })
    ).toHaveFocus();
  });

  it("locks the recipe list while the import step is open", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    render(RecipesManager);

    await screen.findByText("Chicken rice bowl");
    await fireEvent.click(
      screen.getByRole("button", { name: "Import from text" })
    );

    expect(
      screen.queryByRole("button", { name: /^Chicken rice bowl/ })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit Chicken rice bowl" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete Chicken rice bowl" })
    ).toBeNull();
  });

  it("locks the recipe list while the form is open", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    render(RecipesManager);

    await screen.findByText("Chicken rice bowl");
    await fireEvent.click(
      screen.getByRole("button", { name: "Edit Chicken rice bowl" })
    );

    expect(
      screen.queryByRole("button", { name: /^Chicken rice bowl/ })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit Chicken rice bowl" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete Chicken rice bowl" })
    ).toBeNull();
  });

  it("opens the recipe detail", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    let close: (() => void) | null = null;
    render(RecipesManager, {
      props: { onBackReady: (fn: () => void) => (close = fn) },
    });

    await fireEvent.click(await screen.findByRole("button", { name: /^Chicken rice bowl/ }));

    expect(
      screen.getByRole("heading", { name: "Chicken rice bowl" })
    ).toBeInTheDocument();
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    expect(screen.getByText("Cook the rice.")).toBeInTheDocument();

    (close as (() => void) | null)?.();

    expect(
      await screen.findByRole("button", { name: /^Chicken rice bowl/ })
    ).toBeInTheDocument();
  });

  it("edits the recipe from the detail", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    render(RecipesManager);

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Chicken rice bowl/ })
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Edit Chicken rice bowl" })
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Chicken rice bowl");
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

  it("resets and restores the page scroll around the detail", async () => {
    nutritionApi.listRecipes.mockResolvedValue([recipe]);
    const scroller = document.createElement("div");
    scroller.className = "space-screen";
    let scrollTop = 240;
    Object.defineProperty(scroller, "scrollTop", {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    const scrollTo = vi.fn(({ top }: { top: number }) => {
      scrollTop = top;
    });
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    document.body.appendChild(scroller);

    let close: (() => void) | null = null;
    render(RecipesManager, {
      props: { onBackReady: (fn: () => void) => (close = fn) },
    });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Chicken rice bowl/ })
    );
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }));

    (close as (() => void) | null)?.();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 240 }));
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

  describe("folders", () => {
    it("creates a top-level folder", async () => {
      nutritionApi.createFolder.mockResolvedValue(breakfast);
      render(RecipesManager);

      await fireEvent.click(screen.getByRole("button", { name: "New folder" }));
      await fireEvent.input(screen.getByLabelText("Folder name"), {
        target: { value: "  Breakfast " },
      });
      await fireEvent.click(
        screen.getByRole("button", { name: "Create folder" })
      );

      await waitFor(() =>
        expect(nutritionApi.createFolder).toHaveBeenCalledWith({
          name: "Breakfast",
          parentId: null,
        })
      );
      expect(await screen.findByText("Breakfast")).toBeInTheDocument();
    });

    it("creates a subfolder inside the open folder", async () => {
      nutritionApi.listFolders.mockResolvedValue([breakfast]);
      nutritionApi.createFolder.mockResolvedValue(oatsFolder);
      render(RecipesManager);

      await fireEvent.click(
        await screen.findByRole("button", { name: "Open Breakfast" })
      );
      await fireEvent.click(screen.getByRole("button", { name: "New folder" }));
      await fireEvent.input(screen.getByLabelText("Folder name"), {
        target: { value: "Oats" },
      });
      await fireEvent.click(
        screen.getByRole("button", { name: "Create folder" })
      );

      await waitFor(() =>
        expect(nutritionApi.createFolder).toHaveBeenCalledWith({
          name: "Oats",
          parentId: breakfast.id,
        })
      );
    });

    it("browses folders and their recipes", async () => {
      nutritionApi.listFolders.mockResolvedValue([breakfast, oatsFolder]);
      nutritionApi.listRecipes.mockResolvedValue([recipe, nestedRecipe]);
      render(RecipesManager);

      expect(await screen.findByText("Chicken rice bowl")).toBeInTheDocument();
      expect(screen.queryByText("Overnight oats")).toBeNull();
      expect(screen.queryByText("Oats")).toBeNull();

      await fireEvent.click(
        screen.getByRole("button", { name: "Open Breakfast" })
      );

      expect(await screen.findByText("Overnight oats")).toBeInTheDocument();
      expect(screen.getByText("Oats")).toBeInTheDocument();
      expect(screen.queryByText("Chicken rice bowl")).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: "All recipes" }));

      expect(await screen.findByText("Chicken rice bowl")).toBeInTheDocument();
      expect(screen.queryByText("Overnight oats")).toBeNull();
    });

    it("renames a folder", async () => {
      nutritionApi.listFolders.mockResolvedValue([breakfast]);
      nutritionApi.renameFolder.mockResolvedValue({
        ...breakfast,
        name: "Morning",
      });
      render(RecipesManager);

      await fireEvent.click(
        await screen.findByRole("button", { name: "Rename Breakfast" })
      );
      expect(screen.getByLabelText("Folder name")).toHaveValue("Breakfast");
      await fireEvent.input(screen.getByLabelText("Folder name"), {
        target: { value: "Morning" },
      });
      await fireEvent.click(screen.getByRole("button", { name: "Save folder" }));

      await waitFor(() =>
        expect(nutritionApi.renameFolder).toHaveBeenCalledWith(breakfast.id, {
          name: "Morning",
        })
      );
      expect(await screen.findByText("Morning")).toBeInTheDocument();
    });

    it("reorders sibling folders", async () => {
      nutritionApi.listFolders.mockResolvedValue([breakfast, dinner]);
      nutritionApi.reorderFolders.mockResolvedValue([
        { ...dinner, position: 0 },
        { ...breakfast, position: 1 },
      ]);
      render(RecipesManager);

      await fireEvent.click(
        await screen.findByRole("button", { name: "Move Dinner up" })
      );

      await waitFor(() =>
        expect(nutritionApi.reorderFolders).toHaveBeenCalledWith(null, [
          dinner.id,
          breakfast.id,
        ])
      );
    });

    it("deletes a folder after confirmation", async () => {
      nutritionApi.listFolders
        .mockResolvedValueOnce([breakfast])
        .mockResolvedValue([]);
      nutritionApi.deleteFolder.mockResolvedValue(undefined);
      vi.stubGlobal("confirm", vi.fn(() => true));
      render(RecipesManager);

      await screen.findByRole("button", { name: "Open Breakfast" });
      await fireEvent.click(
        screen.getByRole("button", { name: "Delete Breakfast" })
      );

      await waitFor(() =>
        expect(nutritionApi.deleteFolder).toHaveBeenCalledWith(breakfast.id)
      );
      expect(await screen.findByText("No recipes yet.")).toBeInTheDocument();
    });

    it("creates a recipe in the open folder", async () => {
      nutritionApi.listFolders.mockResolvedValue([breakfast]);
      nutritionApi.createRecipe.mockResolvedValue({
        ...recipe,
        folderId: breakfast.id,
      });
      render(RecipesManager);

      await fireEvent.click(
        await screen.findByRole("button", { name: "Open Breakfast" })
      );
      await fireEvent.click(screen.getByRole("button", { name: "Add recipe" }));
      await fillRecipeFields();
      await fireEvent.click(
        screen.getByRole("button", { name: "Save recipe" })
      );

      await waitFor(() =>
        expect(nutritionApi.createRecipe).toHaveBeenCalledWith(
          expect.objectContaining({ folderId: breakfast.id })
        )
      );
      expect(await screen.findByText("Chicken rice bowl")).toBeInTheDocument();
    });

    it("shows the empty state inside an empty folder", async () => {
      nutritionApi.listFolders.mockResolvedValue([breakfast]);
      render(RecipesManager);

      await fireEvent.click(
        await screen.findByRole("button", { name: "Open Breakfast" })
      );

      expect(screen.getByText("This folder is empty.")).toBeInTheDocument();
    });
  });
});
