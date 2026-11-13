import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import NutritionPage from "./nutrition/+page.svelte";
import ExtractorPage from "./extractor/+page.svelte";

describe("placeholder routes", () => {
  it("renders the Nutrition placeholder", () => {
    render(NutritionPage);
    expect(
      screen.getByRole("heading", { name: "Nutrition" })
    ).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
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
