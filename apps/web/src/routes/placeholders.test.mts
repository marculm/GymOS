import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import NutritionPage from "./nutrition/+page.svelte";
import ExtractorPage from "./extractor/+page.svelte";

describe("placeholder routes", () => {
  it("renders the Nutrition placeholder", () => {
    render(NutritionPage);
    expect(screen.getByText("Nutrition & Mealprep")).toBeInTheDocument();
  });

  it("renders the AI Extractor placeholder", () => {
    render(ExtractorPage);
    expect(screen.getByText("TikTok / Reels AI Extractor")).toBeInTheDocument();
  });
});
