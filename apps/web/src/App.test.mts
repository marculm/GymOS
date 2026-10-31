import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import App from "./App.svelte";

vi.mock("./api/gym.mts", () => {
  return {
    listAllExercises: vi.fn().mockResolvedValue([]),
    listAllPlans: vi.fn().mockResolvedValue([]),
    createPlan: vi.fn(),
    getRotation: vi.fn().mockResolvedValue({ plans: [], nextPlanId: null }),
    getWeightSuggestions: vi.fn().mockResolvedValue({}),
    setRotation: vi.fn(),
    startSession: vi.fn(),
    getActiveSession: vi.fn().mockResolvedValue(null),
    addSet: vi.fn(),
    completeSession: vi.fn(),
  };
});

describe("GymOS App Component", () => {
  it("renders GymOS header", async () => {
    render(App);
    await screen.findByText("No workout scheduled");
    expect(screen.getByText(/GymOS/i)).toBeInTheDocument();
  });

  it("switches to Nutrition tab when clicked", async () => {
    render(App);
    await screen.findByText("No workout scheduled");
    const nutritionButton = screen.getByRole("button", { name: /Nutrition/i });
    await fireEvent.click(nutritionButton);
    expect(await screen.findByText("Nutrition & Mealprep")).toBeInTheDocument();
  });

  it("switches to AI Extractor tab when clicked", async () => {
    render(App);
    await screen.findByText("No workout scheduled");
    const extractorButton = screen.getByRole("button", { name: /AI Extractor/i });
    await fireEvent.click(extractorButton);
    expect(await screen.findByText(/TikTok \/ Reels AI Extractor/i)).toBeInTheDocument();
  });

  it("shows the three main tabs in the navigation", async () => {
    render(App);
    await screen.findByText("No workout scheduled");
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getAllByRole("button")).toHaveLength(3);
  });
});
