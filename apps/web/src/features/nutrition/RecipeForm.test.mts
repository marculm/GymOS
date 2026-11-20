import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { Recipe, RecipeFolder } from "@gymos/shared";
import RecipeForm from "./RecipeForm.svelte";

const breakfast: RecipeFolder = {
  id: "folder-1",
  name: "Breakfast",
  parentId: null,
  position: 0,
};

const oats: RecipeFolder = {
  id: "folder-2",
  name: "Oats",
  parentId: breakfast.id,
  position: 0,
};

const savedRecipe: Recipe = {
  id: "recipe-1",
  title: "Overnight oats",
  servings: 1,
  macrosPerServing: {
    calories: 410,
    proteinGrams: 12,
    carbsGrams: 60,
    fatGrams: 13,
  },
  ingredients: [],
  instructions: [],
  folderId: breakfast.id,
};

async function fillRequiredFields() {
  await fireEvent.input(screen.getByLabelText("Name"), {
    target: { value: "Chicken rice bowl" },
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

describe("RecipeForm", () => {
  it("submits a complete recipe", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(RecipeForm, { props: { onSubmit, onCancel: vi.fn() } });

    await fillRequiredFields();
    await fireEvent.input(screen.getByLabelText("Ingredient"), {
      target: { value: "Chicken breast" },
    });
    await fireEvent.input(screen.getByLabelText("Amount"), {
      target: { value: "300" },
    });
    await fireEvent.input(screen.getByLabelText("Unit"), {
      target: { value: "g" },
    });
    await fireEvent.input(screen.getByLabelText("Instructions"), {
      target: { value: "Cook the rice.\nSear the chicken." },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Chicken rice bowl",
        servings: 2,
        macrosPerServing: {
          calories: 610,
          proteinGrams: 45,
          carbsGrams: 62,
          fatGrams: 20,
        },
        ingredients: [
          { name: "Chicken breast", amount: 300, unit: "g" },
        ],
        instructions: ["Cook the rice.", "Sear the chicken."],
      })
    );
  });

  it("prefills a new recipe from a draft", () => {
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
      instructions: ["Mix the batter.", "Fry the pancakes."],
    };
    render(RecipeForm, {
      props: { draft, onSubmit: vi.fn(), onCancel: vi.fn() },
    });

    expect(
      screen.getByRole("heading", { name: "New recipe" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Pancakes");
    expect(screen.getByLabelText("Servings")).toHaveValue(2);
    expect(screen.getByLabelText("Calories per serving")).toHaveValue(410);
    expect(screen.getByLabelText("Ingredient")).toHaveValue("Flour");
    expect(screen.getByLabelText("Amount")).toHaveValue(200);
    expect(screen.getByLabelText("Unit")).toHaveValue("g");
    expect(screen.getByLabelText("Instructions")).toHaveValue(
      "Mix the batter.\nFry the pancakes."
    );
  });

  it("adds an ingredient row and focuses it", async () => {
    render(RecipeForm, { props: { onSubmit: vi.fn(), onCancel: vi.fn() } });

    await fireEvent.click(
      screen.getByRole("button", { name: "Add ingredient" })
    );

    const inputs = screen.getAllByLabelText("Ingredient");
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toHaveFocus();
  });

  it("assigns a new recipe to the selected folder", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(RecipeForm, {
      props: { folders: [breakfast, oats], onSubmit, onCancel: vi.fn() },
    });

    await fillRequiredFields();
    await fireEvent.change(screen.getByLabelText("Folder"), {
      target: { value: breakfast.id },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: breakfast.id })
      )
    );
  });

  it("prefills the folder being browsed and nests options", () => {
    render(RecipeForm, {
      props: {
        folders: [breakfast, oats],
        defaultFolderId: breakfast.id,
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    expect(screen.getByLabelText("Folder")).toHaveValue(breakfast.id);
    expect(
      screen.getByRole("option", { name: "Breakfast / Oats" })
    ).toBeInTheDocument();
  });

  it("moves an edited recipe back to the top level", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(RecipeForm, {
      props: {
        recipe: savedRecipe,
        folders: [breakfast, oats],
        onSubmit,
        onCancel: vi.fn(),
      },
    });

    expect(screen.getByLabelText("Folder")).toHaveValue(breakfast.id);
    await fireEvent.change(screen.getByLabelText("Folder"), {
      target: { value: "" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: null })
      )
    );
  });

  it("keeps an unfiled recipe at the top level inside a folder", () => {
    render(RecipeForm, {
      props: {
        recipe: { ...savedRecipe, folderId: null },
        folders: [breakfast, oats],
        defaultFolderId: breakfast.id,
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    expect(screen.getByLabelText("Folder")).toHaveValue("");
  });

  it("rejects an incomplete ingredient row", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(RecipeForm, { props: { onSubmit, onCancel: vi.fn() } });

    await fillRequiredFields();
    await fireEvent.input(screen.getByLabelText("Ingredient"), {
      target: { value: "Chicken breast" },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a name, servings, macros of zero or more, and complete ingredient rows."
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
