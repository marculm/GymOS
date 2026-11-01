import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type {
  Exercise,
  Page,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import History from "./History.svelte";
import { getSession, listSessions } from "../../api/gym.mts";

vi.mock("../../api/gym.mts", () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
}));

const exercise: Exercise = {
  id: "exercise-1",
  name: "Bench Press",
  muscleGroup: "chest",
  description: null,
  defaultSets: 4,
  defaultReps: 8,
  defaultWeightKg: 80,
};

const plan: WorkoutPlan = {
  id: "plan-1",
  name: "Push Day",
  description: null,
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

const pushSession: WorkoutSessionSummary = {
  id: "session-1",
  title: "Push Day",
  planId: plan.id,
  startedAt: "2026-10-26T18:00:00.000Z",
  completedAt: "2026-10-26T19:00:00.000Z",
  totalSets: 2,
};

const pullSession: WorkoutSessionSummary = {
  ...pushSession,
  id: "session-2",
  title: "Pull Day",
  planId: null,
};

const detail: WorkoutSessionDetail = {
  id: pushSession.id,
  title: pushSession.title,
  planId: pushSession.planId,
  startedAt: pushSession.startedAt,
  completedAt: pushSession.completedAt,
  sets: [
    {
      id: "set-1",
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: 1,
      reps: 8,
      weightKg: 80,
      createdAt: "2026-10-26T18:05:00.000Z",
    },
    {
      id: "set-2",
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: 2,
      reps: 6,
      weightKg: 85,
      createdAt: "2026-10-26T18:10:00.000Z",
    },
  ],
};

function page(
  content: WorkoutSessionSummary[],
  number: number,
  totalElements: number
): Page<WorkoutSessionSummary> {
  const size = 10;
  return {
    content,
    page: {
      size,
      number,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    },
  };
}

function renderHistory() {
  render(History, { props: { plans: [plan] } });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listSessions).mockResolvedValue(page([], 0, 0));
});

describe("History", () => {
  it("lists sessions and loads the next page", async () => {
    vi.mocked(listSessions)
      .mockResolvedValueOnce(page([pushSession], 0, 11))
      .mockResolvedValueOnce(page([pullSession], 1, 11));

    renderHistory();

    expect(await screen.findByText("Push Day")).toBeInTheDocument();
    expect(screen.queryByText("Pull Day")).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(await screen.findByText("Pull Day")).toBeInTheDocument();
    expect(listSessions).toHaveBeenLastCalledWith({ page: 2, size: 10 });
  });

  it("opens a session with its sets, targets, and duration", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );

    expect(await screen.findByText("Set 1")).toBeInTheDocument();
    expect(screen.getByText("8 × 80 kg")).toBeInTheDocument();
    expect(screen.getByText("6 × 85 kg")).toBeInTheDocument();
    expect(screen.getByText("4 × 8 @ 80 kg")).toBeInTheDocument();
    expect(screen.getByText(/60 min/)).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledWith("session-1");
  });

  it("filters by plan and date range", async () => {
    renderHistory();
    await screen.findByText("No completed workouts yet");

    await fireEvent.change(screen.getByLabelText("Plan"), {
      target: { value: "plan-1" },
    });
    await waitFor(() => {
      expect(listSessions).toHaveBeenLastCalledWith({
        page: 1,
        size: 10,
        planId: "plan-1",
      });
    });
    expect(
      await screen.findByText("No workouts match these filters")
    ).toBeInTheDocument();

    await fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-10-01" },
    });
    await waitFor(() => {
      expect(listSessions).toHaveBeenLastCalledWith({
        page: 1,
        size: 10,
        planId: "plan-1",
        from: new Date("2026-10-01T00:00:00").toISOString(),
      });
    });

    await fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-10-31" },
    });
    await waitFor(() => {
      expect(listSessions).toHaveBeenLastCalledWith({
        page: 1,
        size: 10,
        planId: "plan-1",
        from: new Date("2026-10-01T00:00:00").toISOString(),
        to: new Date("2026-10-31T23:59:59.999").toISOString(),
      });
    });
  });

  it("shows an error when loading fails", async () => {
    vi.mocked(listSessions).mockRejectedValueOnce(
      new Error("Backend unavailable")
    );

    renderHistory();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable"
    );
  });
});
