import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import type { WorkoutSessionDetail } from "@gymos/shared";
import { completeSession, getActiveSession } from "./api/gym.mts";
import App from "./App.svelte";

vi.mock("./api/gym.mts", () => {
  return {
    listAllExercises: vi.fn().mockResolvedValue([]),
    listAllPlans: vi.fn().mockResolvedValue([]),
    createPlan: vi.fn(),
    getRotation: vi.fn().mockResolvedValue({ plans: [], nextPlanId: null }),
    setRotation: vi.fn(),
    startSession: vi.fn(),
    getActiveSession: vi.fn().mockResolvedValue(null),
    addSet: vi.fn(),
    deleteSet: vi.fn(),
    completeSession: vi.fn(),
  };
});

const activeSession: WorkoutSessionDetail = {
  id: "session-1",
  title: "Free workout",
  planId: null,
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

beforeEach(() => {
  window.sessionStorage.clear();
  vi.mocked(getActiveSession).mockResolvedValue(null);
  vi.mocked(completeSession).mockResolvedValue({
    ...activeSession,
    completedAt: "2026-10-26T19:00:00.000Z",
  });
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

  it("hides the main tabs while a session is active", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(activeSession);

    render(App);

    expect(
      await screen.findByRole("region", { name: "Workout controls" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /main navigation/i })
    ).not.toBeInTheDocument();
  });

  it("restores the main tabs after finishing the session", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(activeSession);

    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: "Finish workout" })
    );

    expect(
      await screen.findByRole("navigation", { name: /main navigation/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Workout controls" })
    ).not.toBeInTheDocument();
  });
});
