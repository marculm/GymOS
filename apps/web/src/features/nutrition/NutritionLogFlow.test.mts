import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type {
  MealEstimate,
  NutritionLogEntry,
  NutritionSummary,
  Recipe,
  RecipeFolder,
} from "@gymos/shared";

const nutritionApi = vi.hoisted(() => ({
  getSummary: vi.fn(),
  listLogs: vi.fn(),
  listRecipes: vi.fn(),
  listFolders: vi.fn(),
  getTargets: vi.fn(),
  createLog: vi.fn(),
  updateLog: vi.fn(),
  deleteLog: vi.fn(),
  estimateMeal: vi.fn(),
  setTargets: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

const photoCompression = vi.hoisted(() => ({ compressMealPhoto: vi.fn() }));

vi.mock("../../api/nutrition.mts", () => nutritionApi);
vi.mock("./meal-photo.mts", () => photoCompression);

import NutritionLogFlow from "./NutritionLogFlow.svelte";
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
  ingredients: [],
  instructions: [],
};

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

const mealEstimate: MealEstimate = {
  name: "Skyr bowl",
  macros: {
    calories: 410,
    proteinGrams: 38,
    carbsGrams: 44,
    fatGrams: 6,
  },
};

const entry: NutritionLogEntry = {
  id: "entry-1",
  loggedAt: new Date("2026-11-14T08:10:00.000Z"),
  name: "Oats & whey",
  macros: {
    calories: 420,
    proteinGrams: 32,
    carbsGrams: 48,
    fatGrams: 11,
  },
};

const summary: NutritionSummary = {
  from: new Date("2026-11-14T00:00:00.000Z"),
  to: new Date("2026-11-15T00:00:00.000Z"),
  totals: {
    calories: 420,
    proteinGrams: 32,
    carbsGrams: 48,
    fatGrams: 11,
  },
  targets: {
    calories: 2400,
    proteinGrams: 160,
    carbsGrams: 260,
    fatGrams: 75,
  },
  remaining: {
    calories: 1980,
    proteinGrams: 128,
    carbsGrams: 212,
    fatGrams: 64,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  nutritionData.summary = summary;
  nutritionData.entries = [];
  nutritionData.recipes = [recipe];
  nutritionData.folders = [];
  nutritionApi.getSummary.mockResolvedValue(summary);
  nutritionApi.listLogs.mockResolvedValue([]);
  nutritionApi.createLog.mockResolvedValue(entry);
  nutritionApi.updateLog.mockResolvedValue(entry);
  nutritionApi.deleteLog.mockResolvedValue(undefined);
  nutritionApi.estimateMeal.mockResolvedValue(mealEstimate);
  nutritionApi.listRecipes.mockResolvedValue([recipe]);
  photoCompression.compressMealPhoto.mockResolvedValue(
    "data:image/jpeg;base64,AAAA"
  );
});

async function choosePhoto() {
  const file = new File(["photo"], "meal.jpg", { type: "image/jpeg" });
  await fireEvent.change(screen.getByLabelText("Meal photo"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(photoCompression.compressMealPhoto).toHaveBeenCalledWith(file)
  );
}

describe("NutritionLogFlow", () => {
  it("logs a meal manually", async () => {
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Manual/ })
    );
    expect(screen.getByText("Manual entry")).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText("Meal name"), {
      target: { value: "Skyr & berries" },
    });
    await fireEvent.input(screen.getByLabelText("Calories"), {
      target: { value: "150" },
    });
    await fireEvent.input(screen.getByLabelText("Protein grams"), {
      target: { value: "15" },
    });
    await fireEvent.input(screen.getByLabelText("Carbs grams"), {
      target: { value: "12" },
    });
    await fireEvent.input(screen.getByLabelText("Fat grams"), {
      target: { value: "5" },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Log meal" }));

    await waitFor(() =>
      expect(nutritionApi.createLog).toHaveBeenCalledWith({
        name: "Skyr & berries",
        macros: {
          calories: 150,
          proteinGrams: 15,
          carbsGrams: 12,
          fatGrams: 5,
        },
      })
    );
  });

  it("estimates a described meal and logs edited values", async () => {
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await fireEvent.input(screen.getByLabelText("Meal description"), {
      target: { value: "300g skyr with berries" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    await waitFor(() =>
      expect(nutritionApi.estimateMeal).toHaveBeenCalledWith({
        description: "300g skyr with berries",
      })
    );
    expect(await screen.findByLabelText("Meal name")).toHaveValue("Skyr bowl");
    expect(screen.getByText("AI estimate")).toBeInTheDocument();
    expect(screen.getByLabelText("Calories")).toHaveValue(410);
    expect(screen.getByLabelText("Protein grams")).toHaveValue(38);
    expect(screen.getByLabelText("Carbs grams")).toHaveValue(44);
    expect(screen.getByLabelText("Fat grams")).toHaveValue(6);

    await fireEvent.input(screen.getByLabelText("Calories"), {
      target: { value: "420" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Log meal" }));

    await waitFor(() =>
      expect(nutritionApi.createLog).toHaveBeenCalledWith({
        name: "Skyr bowl",
        macros: {
          calories: 420,
          proteinGrams: 38,
          carbsGrams: 44,
          fatGrams: 6,
        },
      })
    );
  });

  it("estimates a photographed meal", async () => {
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await choosePhoto();
    expect(await screen.findByAltText("Selected meal")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    await waitFor(() =>
      expect(nutritionApi.estimateMeal).toHaveBeenCalledWith({
        image: "data:image/jpeg;base64,AAAA",
      })
    );
    expect(await screen.findByLabelText("Meal name")).toHaveValue("Skyr bowl");
  });

  it("names a photo-only estimate when the AI omits a name", async () => {
    nutritionApi.estimateMeal.mockResolvedValueOnce({
      macros: mealEstimate.macros,
    });
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await choosePhoto();
    await fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    expect(await screen.findByLabelText("Meal name")).toHaveValue("Photo meal");
  });

  it("sends a description and a photo together", async () => {
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await fireEvent.input(screen.getByLabelText("Meal description"), {
      target: { value: "half of this" },
    });
    await choosePhoto();
    await fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    await waitFor(() =>
      expect(nutritionApi.estimateMeal).toHaveBeenCalledWith({
        description: "half of this",
        image: "data:image/jpeg;base64,AAAA",
      })
    );
  });

  it("shows an error when the photo cannot be read", async () => {
    photoCompression.compressMealPhoto.mockRejectedValueOnce(
      new Error("decode failed")
    );
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await fireEvent.change(screen.getByLabelText("Meal photo"), {
      target: { files: [new File(["photo"], "meal.heic", { type: "image/heic" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not read the photo."
    );
    expect(screen.getByRole("button", { name: "Estimate" })).toBeDisabled();
  });

  it("keeps the description when the estimate fails", async () => {
    nutritionApi.estimateMeal.mockRejectedValueOnce(
      new Error(
        "The AI service is unavailable. Try again or enter the values manually."
      )
    );
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await fireEvent.input(screen.getByLabelText("Meal description"), {
      target: { value: "toast with butter" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI service is unavailable"
    );
    expect(screen.getByLabelText("Meal description")).toHaveValue(
      "toast with butter"
    );

    await fireEvent.click(
      screen.getByRole("button", { name: "Enter manually" })
    );
    expect(screen.getByLabelText("Meal name")).toHaveValue("toast with butter");
    expect(screen.getByLabelText("Calories")).toHaveValue(0);
  });

  it("shows the estimating state", async () => {
    let resolveEstimate!: (value: MealEstimate) => void;
    nutritionApi.estimateMeal.mockReturnValueOnce(
      new Promise<MealEstimate>((resolve) => {
        resolveEstimate = resolve;
      })
    );
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await fireEvent.input(screen.getByLabelText("Meal description"), {
      target: { value: "toast" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Estimate" }));

    expect(
      await screen.findByRole("button", { name: "Estimating…" })
    ).toBeDisabled();
    expect(screen.getByLabelText("Meal description")).toBeDisabled();

    resolveEstimate(mealEstimate);
    expect(await screen.findByLabelText("Meal name")).toHaveValue("Skyr bowl");
  });

  it("ignores an estimate that arrives after leaving the step", async () => {
    let resolveEstimate!: (value: MealEstimate) => void;
    nutritionApi.estimateMeal.mockReturnValueOnce(
      new Promise<MealEstimate>((resolve) => {
        resolveEstimate = resolve;
      })
    );
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
    await fireEvent.input(screen.getByLabelText("Meal description"), {
      target: { value: "toast" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Estimate" }));
    await fireEvent.click(screen.getByRole("button", { name: "Back" }));

    resolveEstimate(mealEstimate);

    await waitFor(() =>
      expect(screen.queryByLabelText("Meal name")).not.toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: /^Saved meal/ })
    ).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /^Describe/ }));
    await fireEvent.input(screen.getByLabelText("Meal description"), {
      target: { value: "a new meal" },
    });
    expect(screen.getByRole("button", { name: "Estimate" })).toBeEnabled();
  });

  it("groups saved recipes by folder path", async () => {
    nutritionData.folders = [breakfast, oats];
    nutritionData.recipes = [
      { ...recipe, id: "recipe-eggs", title: "Eggs", folderId: breakfast.id },
      {
        ...recipe,
        id: "recipe-oats",
        title: "Overnight oats",
        folderId: oats.id,
      },
      { ...recipe, id: "recipe-toast", title: "Toast", folderId: null },
    ];
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Saved meal/ })
    );

    expect(screen.getByText("Breakfast")).toBeInTheDocument();
    expect(screen.getByText("Breakfast / Oats")).toBeInTheDocument();
    expect(screen.getByText("Unfiled")).toBeInTheDocument();
    expect(screen.getByText("Eggs")).toBeInTheDocument();
    expect(screen.getByText("Overnight oats")).toBeInTheDocument();
    expect(screen.getByText("Toast")).toBeInTheDocument();
  });

  it("multiplies a saved recipe by the portion", async () => {
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Saved meal/ })
    );
    await fireEvent.click(
      await screen.findByRole("button", { name: /Chicken rice bowl/ })
    );
    await fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByLabelText("Calories")).toHaveValue(915);
    expect(screen.getByLabelText("Protein grams")).toHaveValue(67.5);
    expect(screen.getByLabelText("Carbs grams")).toHaveValue(93);
    expect(screen.getByLabelText("Fat grams")).toHaveValue(30);

    await fireEvent.click(screen.getByRole("button", { name: "Log meal" }));

    await waitFor(() =>
      expect(nutritionApi.createLog).toHaveBeenCalledWith({
        name: "Chicken rice bowl",
        macros: {
          calories: 915,
          proteinGrams: 67.5,
          carbsGrams: 93,
          fatGrams: 30,
        },
      })
    );
  });

  it("edits a logged meal", async () => {
    nutritionData.entries = [entry];
    render(NutritionLogFlow, {
      props: { open: true, initialView: "today" },
    });

    await fireEvent.click(
      await screen.findByRole("button", { name: /Oats & whey/ })
    );
    await fireEvent.input(screen.getByLabelText("Meal name"), {
      target: { value: "Oats, whey & berries" },
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Save changes" })
    );

    await waitFor(() =>
      expect(nutritionApi.updateLog).toHaveBeenCalledWith(entry.id, {
        name: "Oats, whey & berries",
        macros: entry.macros,
      })
    );
  });

  it("deletes a logged meal after confirmation", async () => {
    nutritionData.entries = [entry];
    render(NutritionLogFlow, {
      props: { open: true, initialView: "today" },
    });

    await fireEvent.click(
      await screen.findByRole("button", { name: /Oats & whey/ })
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Delete meal" })
    );
    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(nutritionApi.deleteLog).toHaveBeenCalledWith(entry.id)
    );
  });
});
