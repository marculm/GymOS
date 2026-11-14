import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import NutritionPage from "./nutrition/+page.svelte";
import ExtractorPage from "./extractor/+page.svelte";

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

vi.mock("../api/nutrition.mts", () => nutritionApi);

describe("top-level routes", () => {
  it("renders the Nutrition home with the target setup", async () => {
    nutritionApi.getSummary.mockResolvedValue({
      from: new Date(),
      to: new Date(),
      totals: {
        calories: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
      },
      targets: null,
      remaining: null,
    });
    nutritionApi.listLogs.mockResolvedValue([]);
    nutritionApi.listRecipes.mockResolvedValue([]);

    render(NutritionPage);

    expect(
      screen.getByRole("heading", { name: "Nutrition" })
    ).toBeInTheDocument();
    expect(await screen.findByText("Set your daily targets")).toBeInTheDocument();
  });

  it("renders the AI Extractor placeholder", () => {
    render(ExtractorPage);
    expect(
      screen.getByRole("heading", { name: "AI Extractor" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("TikTok / Reels AI Extractor")
    ).toBeInTheDocument();
  });
});
