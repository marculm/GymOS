import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { NutritionSummary } from "@gymos/shared";

const nutritionData = vi.hoisted(() => ({
  summary: null as NutritionSummary | null,
  loading: false,
  error: null as string | null,
  load: vi.fn(),
}));

vi.mock("./nutrition-data.svelte.ts", () => ({ nutritionData }));
vi.mock("#lib/space.ts", () => ({ goToSpace: vi.fn() }));

import NutritionHome from "./NutritionHome.svelte";

const summary: NutritionSummary = {
  from: new Date("2026-11-15T00:00:00.000Z"),
  to: new Date("2026-11-16T00:00:00.000Z"),
  totals: {
    calories: 900,
    proteinGrams: 24,
    carbsGrams: 100,
    fatGrams: 30,
  },
  targets: {
    calories: 2400,
    proteinGrams: 160,
    carbsGrams: 260,
    fatGrams: 75,
  },
  remaining: {
    calories: 1500,
    proteinGrams: 136,
    carbsGrams: 160,
    fatGrams: 45,
  },
};

function macroValue(name: string): HTMLElement | null {
  return (
    screen
      .getByText(name)
      .closest(".nutrition-macro-col")
      ?.querySelector(".nutrition-macro-value") ?? null
  );
}

function valueText(name: string): string {
  return macroValue(name)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function renderHome() {
  render(NutritionHome, {
    props: { onLogFood: vi.fn(), onToday: vi.fn(), onRecipes: vi.fn() },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  nutritionData.summary = summary;
  nutritionData.loading = false;
  nutritionData.error = null;
});

describe("NutritionHome", () => {
  it("shows eaten macros against the target", () => {
    renderHome();

    expect(valueText("Protein")).toBe("24 / 160 g");
    expect(valueText("Carbs")).toBe("100 / 260 g");
    expect(valueText("Fat")).toBe("30 / 75 g");
  });

  it("keeps the eaten value and over state when the target is exceeded", () => {
    nutritionData.summary = {
      ...summary,
      totals: { ...summary.totals, proteinGrams: 180 },
      remaining: {
        calories: 1500,
        proteinGrams: -20,
        carbsGrams: 160,
        fatGrams: 45,
      },
    };
    renderHome();

    expect(valueText("Protein")).toBe("180 / 160 g");
    expect(macroValue("Protein")).toHaveClass("over");
  });
});
