import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import App from "./App.svelte";

vi.mock("./api/gym.mts", () => {
  const emptyPage = {
    content: [],
    page: { size: 20, number: 0, totalElements: 0, totalPages: 0 },
  };

  return {
    listExercises: vi.fn().mockResolvedValue(emptyPage),
    listPlans: vi.fn().mockResolvedValue(emptyPage),
    createPlan: vi.fn(),
    startSession: vi.fn(),
    getActiveSession: vi.fn().mockResolvedValue(null),
    listSessions: vi.fn().mockResolvedValue(emptyPage),
    addSet: vi.fn(),
    completeSession: vi.fn(),
  };
});

describe("GymOS App Component", () => {
  it("renders GymOS header", async () => {
    render(App);
    await screen.findByText("No plans yet");
    expect(screen.getByText(/GymOS/i)).toBeInTheDocument();
  });

  it("switches to Nutrition tab when clicked", async () => {
    render(App);
    await screen.findByText("No plans yet");
    const nutritionButton = screen.getByRole("button", { name: /Nutrition/i });
    await fireEvent.click(nutritionButton);
    expect(await screen.findByText("Nutrition & Mealprep")).toBeInTheDocument();
  });

  it("switches to AI Extractor tab when clicked", async () => {
    render(App);
    await screen.findByText("No plans yet");
    const extractorButton = screen.getByRole("button", { name: /AI Extractor/i });
    await fireEvent.click(extractorButton);
    expect(await screen.findByText(/TikTok \/ Reels AI Extractor/i)).toBeInTheDocument();
  });

  it("shows the three main tabs in the navigation", async () => {
    render(App);
    await screen.findByText("No plans yet");
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getAllByRole("button")).toHaveLength(3);
  });
});
