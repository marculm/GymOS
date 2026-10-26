import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Exercise, WorkoutPlan, WorkoutSessionDetail } from "@gymos/shared";
import { ApiError } from "../../api/client.ts";
import { GymView } from "./GymView.tsx";
import {
  addSet,
  completeSession,
  createPlan,
  getActiveSession,
  listExercises,
  listPlans,
  listSessions,
  startSession,
} from "../../api/gym.ts";

vi.mock("../../api/gym.ts", () => ({
  listExercises: vi.fn(),
  listPlans: vi.fn(),
  createPlan: vi.fn(),
  startSession: vi.fn(),
  getActiveSession: vi.fn(),
  listSessions: vi.fn(),
  addSet: vi.fn(),
  completeSession: vi.fn(),
}));

const exercise: Exercise = {
  id: "exercise-1",
  name: "Bench Press",
  muscleGroup: "chest",
  description: null,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: "Chest and shoulders",
  createdAt: "2026-10-26T18:00:00.000Z",
  exercises: [
    {
      id: "plan-exercise-1",
      position: 0,
      targetSets: 4,
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
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listExercises).mockResolvedValue([exercise]);
  vi.mocked(listPlans).mockResolvedValue([plan]);
  vi.mocked(getActiveSession).mockResolvedValue(null);
  vi.mocked(listSessions).mockResolvedValue([]);
  vi.mocked(startSession).mockResolvedValue(session);
  vi.mocked(createPlan).mockResolvedValue(plan);
});

describe("GymView", () => {
  it("renders plans and recent workouts", async () => {
    render(<GymView />);

    expect(await screen.findByText("Push Day")).toBeInTheDocument();
    expect(screen.getByText("1 exercise")).toBeInTheDocument();
    expect(screen.getByText("No completed workouts yet")).toBeInTheDocument();
  });

  it("starts a plan session", async () => {
    render(<GymView />);

    await screen.findByText("Push Day");
    fireEvent.click(screen.getByRole("button", { name: /start plan/i }));

    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith({ planId: "plan-1" });
    });
    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /finish workout/i })
    ).toBeInTheDocument();
  });

  it("creates a plan from the form", async () => {
    render(<GymView />);

    await screen.findByText("Push Day");
    fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Leg Day" },
    });
    fireEvent.change(screen.getByLabelText("Sets"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Reps"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    await waitFor(() => {
      expect(createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Leg Day",
          exercises: [expect.objectContaining({ targetSets: 5, targetReps: 5 })],
        })
      );
    });
  });

  it("logs a set and finishes the active session", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(session);
    vi.mocked(addSet).mockResolvedValue({
      id: "set-1",
      exerciseId: "exercise-1",
      setNumber: 1,
      reps: 8,
      weightKg: 80,
      rpe: null,
      createdAt: "2026-10-26T18:05:00.000Z",
    });
    vi.mocked(completeSession).mockResolvedValue({
      ...session,
      completedAt: "2026-10-26T19:00:00.000Z",
    });

    render(<GymView />);

    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Weight (kg)"), {
      target: { value: "80" },
    });
    fireEvent.change(screen.getByLabelText("Reps"), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log set" }));

    await waitFor(() => {
      expect(addSet).toHaveBeenCalledWith("session-1", {
        exerciseId: "exercise-1",
        weightKg: 80,
        reps: 8,
        rpe: undefined,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));

    await waitFor(() => {
      expect(completeSession).toHaveBeenCalledWith("session-1");
    });
    expect(
      await screen.findByText("No completed workouts yet")
    ).toBeInTheDocument();
  });

  it("resumes the active session when starting returns 409", async () => {
    vi.mocked(startSession).mockRejectedValueOnce(
      new ApiError(409, "An active session is already in progress")
    );
    vi.mocked(getActiveSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(session);

    render(<GymView />);

    await screen.findByText("Push Day");
    fireEvent.click(screen.getByRole("button", { name: /start free workout/i }));

    await waitFor(() => {
      expect(getActiveSession).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /finish workout/i })
    ).toBeInTheDocument();
  });

  it("shows a duplicate plan name error", async () => {
    vi.mocked(createPlan).mockRejectedValueOnce(
      new ApiError(409, "A plan with this name already exists")
    );

    render(<GymView />);

    await screen.findByText("Push Day");
    fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Push Day" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save plan/i }));

    expect(
      await screen.findByText("A plan with this name already exists")
    ).toBeInTheDocument();
  });

  it("shows an error with retry when loading fails", async () => {
    vi.mocked(listPlans).mockRejectedValueOnce(new Error("Backend unavailable"));

    render(<GymView />);

    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Push Day")).toBeInTheDocument();
  });
});
