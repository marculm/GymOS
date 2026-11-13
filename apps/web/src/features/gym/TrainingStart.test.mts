import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type {
  Exercise,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";
import { ApiError } from "../../api/client.mts";
import {
  completeSession,
  getActiveSession,
  getRotation,
  listAllExercises,
  listAllPlans,
  startSession,
} from "../../api/gym.mts";
import { settings } from "$lib/settings.svelte.ts";
import { gymData } from "./gym-data.svelte.ts";
import TrainingStart from "./TrainingStart.svelte";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

vi.mock("../../api/gym.mts", () => ({
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
  description: "Chest, shoulders, and triceps",
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

const session: WorkoutSessionDetail = {
  id: "session-1",
  title: "Push Day",
  planId: plan.id,
  startedAt: "2026-11-13T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

function mockDefaults() {
  vi.mocked(listAllExercises).mockResolvedValue([exercise]);
  vi.mocked(listAllPlans).mockResolvedValue([plan]);
  vi.mocked(getRotation).mockResolvedValue({
    plans: [plan],
    nextPlanId: plan.id,
  });
  vi.mocked(getActiveSession).mockResolvedValue(null);
  vi.mocked(startSession).mockResolvedValue(session);
  vi.mocked(completeSession).mockResolvedValue({
    ...session,
    completedAt: "2026-11-13T19:00:00.000Z",
  });
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
});

describe("TrainingStart", () => {
  it("shows the next workout", async () => {
    render(TrainingStart);

    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(screen.getByText("1 exercise")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start workout" })
    ).toBeInTheDocument();
  });

  it("starts the suggested workout", async () => {
    render(TrainingStart);

    await fireEvent.click(
      await screen.findByRole("button", { name: "Start workout" })
    );

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith({ planId: plan.id })
    );
    expect(
      await screen.findByRole("heading", { name: "Barbell Bench Press" })
    ).toBeInTheDocument();
  });

  it("opens the settings when no workout is scheduled", async () => {
    vi.mocked(listAllPlans).mockResolvedValue([]);
    vi.mocked(getRotation).mockResolvedValue({
      plans: [],
      nextPlanId: null,
    });

    render(TrainingStart);

    expect(
      await screen.findByRole("heading", { name: "No workout scheduled" })
    ).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole("button", { name: "Set up training plan" })
    );

    expect(settings.open).toBe(true);
    expect(settings.section).toBe("plans");
  });

  it("opens an active session on mount", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(session);

    render(TrainingStart);

    expect(
      await screen.findByRole("heading", { name: "Barbell Bench Press" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start workout" })
    ).not.toBeInTheDocument();
  });

  it("finishes an active session and reloads the start screen", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(session);

    render(TrainingStart);

    await fireEvent.click(
      await screen.findByRole("button", { name: "Finish" })
    );

    await waitFor(() =>
      expect(completeSession).toHaveBeenCalledWith(session.id)
    );
    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
  });

  it("recovers a start conflict by opening the active session", async () => {
    vi.mocked(startSession).mockRejectedValueOnce(
      new ApiError(409, "A session is already active")
    );

    render(TrainingStart);

    await screen.findByRole("heading", { name: "Push Day" });
    vi.mocked(getActiveSession).mockResolvedValueOnce(session);
    await fireEvent.click(
      screen.getByRole("button", { name: "Start workout" })
    );

    expect(
      await screen.findByRole("heading", { name: "Barbell Bench Press" })
    ).toBeInTheDocument();
  });

  it("shows a load error and retries", async () => {
    vi.mocked(getActiveSession).mockRejectedValueOnce(new Error("offline"));

    render(TrainingStart);

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
  });
});
