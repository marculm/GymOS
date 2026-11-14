import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import type { Recipe } from "@gymos/shared";
import RecipeDetail from "./RecipeDetail.svelte";

const recipe: Recipe = {
  id: "recipe-1",
  title: "Chicken rice bowl",
  sourceUrl: "https://example.com/recipe",
  servings: 2,
  macrosPerServing: {
    calories: 610,
    proteinGrams: 45,
    carbsGrams: 62,
    fatGrams: 20,
  },
  ingredients: [
    { name: "Chicken breast", amount: 300, unit: "g" },
    { name: "Rice", amount: 200, unit: "g" },
  ],
  instructions: ["Cook the rice.", "Sear the chicken."],
};

describe("RecipeDetail", () => {
  it("renders the recipe for cooking and goes back", async () => {
    const onBack = vi.fn();
    render(RecipeDetail, { props: { recipe, onBack } });

    expect(
      screen.getByRole("heading", { name: "Chicken rice bowl" })
    ).toBeInTheDocument();
    expect(screen.getByText("2 servings")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
    expect(screen.getByText(/610/)).toBeInTheDocument();
    expect(screen.getByText("Chicken breast")).toBeInTheDocument();
    expect(screen.getByText("300 g")).toBeInTheDocument();
    expect(screen.getByText("Cook the rice.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open source/ })).toHaveAttribute(
      "href",
      recipe.sourceUrl
    );

    await fireEvent.click(screen.getByRole("button", { name: "Recipes" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("handles a recipe without ingredients, steps or source", () => {
    render(RecipeDetail, {
      props: {
        recipe: { ...recipe, sourceUrl: undefined, ingredients: [], instructions: [] },
        onBack: vi.fn(),
      },
    });

    expect(screen.getByText("No ingredients yet.")).toBeInTheDocument();
    expect(screen.getByText("No steps yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open source/ })).not.toBeInTheDocument();
  });
});
