import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type {
  NutritionLogEntry,
  NutritionSummary,
  Recipe,
} from "@gymos/shared";

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
  nutritionApi.getSummary.mockResolvedValue(summary);
  nutritionApi.listLogs.mockResolvedValue([]);
  nutritionApi.createLog.mockResolvedValue(entry);
  nutritionApi.updateLog.mockResolvedValue(entry);
  nutritionApi.deleteLog.mockResolvedValue(undefined);
  nutritionApi.listRecipes.mockResolvedValue([recipe]);
});

describe("NutritionLogFlow", () => {
  it("logs a meal manually", async () => {
    render(NutritionLogFlow, { props: { open: true } });

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Describe/ })
    );
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
