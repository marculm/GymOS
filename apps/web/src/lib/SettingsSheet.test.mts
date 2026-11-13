import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import type { Exercise, WorkoutPlan } from "@gymos/shared";
import {
  enablePush,
  isPushSubscribed,
  isPushSupported,
} from "../push.mts";
import {
  getRotation,
  listAllExercises,
  listAllPlans,
  listSessions,
} from "../api/gym.mts";
import { settings } from "./settings.svelte.ts";
import SettingsSheet from "./SettingsSheet.svelte";
import { gymData } from "../features/gym/gym-data.svelte.ts";

vi.mock("../push.mts", () => ({
  isPushSupported: vi.fn(),
  isPushSubscribed: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  syncRestTimer: vi.fn(),
}));

vi.mock("../api/gym.mts", () => ({
  listAllExercises: vi.fn(),
  listAllPlans: vi.fn(),
  getRotation: vi.fn(),
  getActiveSession: vi.fn(),
  startSession: vi.fn(),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  completeSession: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  deleteExercise: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  setRotation: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  updateSet: vi.fn(),
}));

const exercise: Exercise = {
  id: "ex-1",
  name: "Barbell Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 3,
  defaultReps: 8,
  defaultWeightKg: 80,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: null,
  createdAt: "2026-11-13T18:00:00.000Z",
  exercises: [
    {
      id: "plan-ex-1",
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: 80,
      notes: null,
      exercise,
    },
  ],
};

function mockDefaults() {
  vi.mocked(isPushSupported).mockReturnValue(true);
  vi.mocked(isPushSubscribed).mockResolvedValue(false);
  vi.mocked(enablePush).mockResolvedValue(true);
}

beforeEach(() => {
  gymData.reset();
  settings.reset();
  vi.clearAllMocks();
  mockDefaults();
  try {
    window.localStorage?.clear();
  } catch {
    // localStorage is unavailable in the test environment.
  }

  vi.mocked(listAllExercises).mockResolvedValue([exercise]);
  vi.mocked(listAllPlans).mockResolvedValue([plan]);
  vi.mocked(getRotation).mockResolvedValue({
    plans: [plan],
    nextPlanId: plan.id,
  });
  vi.mocked(listSessions).mockResolvedValue({
    content: [],
    page: {
      size: 10,
      number: 0,
      totalElements: 0,
      totalPages: 0,
    },
  });
});

async function openSettings() {
  settings.show();
  render(SettingsSheet);
  return screen.findByRole("dialog", { name: "Settings" });
}

describe("SettingsSheet", () => {
  it("shows the training, session, and more groups", async () => {
    const dialog = await openSettings();

    expect(within(dialog).getByText("Training plans")).toBeInTheDocument();
    expect(within(dialog).getByText("Exercises")).toBeInTheDocument();
    expect(within(dialog).getByText("History")).toBeInTheDocument();
    expect(within(dialog).getByText("Rest timer")).toBeInTheDocument();
    expect(within(dialog).getByText("Notifications")).toBeInTheDocument();
    expect(within(dialog).getByText("AI Extractor")).toBeInTheDocument();
  });

  it("opens plans, exercises, and history", async () => {
    const dialog = await openSettings();

    await fireEvent.click(
      within(dialog).getByRole("button", { name: /Training plans/ })
    );
    expect(
      await screen.findByRole("heading", { name: "Training rotation" })
    ).toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole("button", { name: "Back to settings" })
    );
    await fireEvent.click(
      screen.getByRole("button", { name: /Exercises/ })
    );
    expect(await screen.findByText("Exercise library")).toBeInTheDocument();

    await fireEvent.click(
      screen.getByRole("button", { name: "Back to settings" })
    );
    await fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(
      await screen.findByText("No completed workouts yet")
    ).toBeInTheDocument();
  });

  it("changes the default rest timer", async () => {
    const dialog = await openSettings();

    await fireEvent.click(
      within(dialog).getByRole("button", { name: /Rest timer/ })
    );
    const three = await screen.findByRole("button", { name: "3:00" });
    await fireEvent.click(three);

    expect(three).toHaveAttribute("aria-pressed", "true");
    await fireEvent.click(
      screen.getByRole("button", { name: "Back to settings" })
    );
    expect(screen.getByText("3:00")).toBeInTheDocument();
  });

  it("enables rest timer notifications", async () => {
    const dialog = await openSettings();

    const toggle = await within(dialog).findByRole("switch", {
      name: "Rest timer notifications",
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await fireEvent.click(toggle);

    await waitFor(() => expect(enablePush).toHaveBeenCalled());
    await waitFor(() =>
      expect(toggle).toHaveAttribute("aria-checked", "true")
    );
  });

  it("shows the extractor placeholder", async () => {
    const dialog = await openSettings();

    await fireEvent.click(
      within(dialog).getByRole("button", { name: /AI Extractor/ })
    );
    expect(
      await screen.findByText("Recipes from TikTok and Reels. Coming soon.")
    ).toBeInTheDocument();
  });
});
