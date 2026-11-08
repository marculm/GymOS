import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import type {
  Exercise,
  LoggedSet,
  Page,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import History from "./History.svelte";
import { getSession, listSessions, updateSet } from "../../api/gym.mts";

vi.mock("../../api/gym.mts", () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
  updateSet: vi.fn(),
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

const squat: Exercise = {
  id: "exercise-2",
  name: "Squat",
  muscleGroup: "legs",
  description: null,
  defaultSets: 3,
  defaultReps: 5,
  defaultWeightKg: 100,
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
    {
      id: "plan-exercise-2",
      position: 1,
      targetSets: 3,
      targetReps: 5,
      targetWeightKg: 100,
      notes: null,
      exercise: squat,
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

function renderHistory(plans: WorkoutPlan[] = [plan]) {
  render(History, { props: { plans } });
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

    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Pull Day")).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(await screen.findByText("Pull Day")).toBeInTheDocument();
    expect(listSessions).toHaveBeenLastCalledWith({ page: 2, size: 10 });
  });

  it("shows the duration and set count on each history card", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));

    renderHistory();

    expect(await screen.findByText(/60 min/)).toBeInTheDocument();
    expect(screen.getByText(/2 sets/)).toBeInTheDocument();
  });

  it("opens a session with its sets and duration", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );

    expect(await screen.findByText("Set 1")).toBeInTheDocument();
    expect(screen.getByText("8 × 80 kg")).toBeInTheDocument();
    expect(screen.getByText("6 × 85 kg")).toBeInTheDocument();
    expect(screen.queryByText("4 × 8 @ 80 kg")).not.toBeInTheDocument();
    expect(screen.queryByText(/@ .* kg/)).not.toBeInTheDocument();
    const detailContent = document.getElementById("history-session-1");
    if (!detailContent) throw new Error("session detail is missing");
    expect(within(detailContent).getByText(/60 min/)).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledWith("session-1");
  });

  it("edits a set in a completed session", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);
    const firstSet = detail.sets[0];
    if (!firstSet) throw new Error("detail fixture is missing a set");
    vi.mocked(updateSet).mockResolvedValue({
      ...firstSet,
      reps: 9,
      weightKg: 82.5,
    });

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );
    await fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit set 1 for Bench Press",
      })
    );

    const reps = screen.getByLabelText("Reps for set 1 of Bench Press");
    const weight = screen.getByLabelText("Weight for set 1 of Bench Press");
    expect(reps).toHaveValue(8);
    expect(weight).toHaveValue(80);

    await fireEvent.input(reps, { target: { value: "9" } });
    await fireEvent.input(weight, { target: { value: "82.5" } });
    await fireEvent.click(
      screen.getByRole("button", { name: "Save set 1 for Bench Press" })
    );

    await waitFor(() => {
      expect(updateSet).toHaveBeenCalledWith("session-1", "set-1", {
        reps: 9,
        weightKg: 82.5,
      });
    });
    expect(await screen.findByText("9 × 82.5 kg")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reps for set 1 of Bench Press")
    ).not.toBeInTheDocument();
    expect(screen.getByText("6 × 85 kg")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Edit set 1 for Bench Press" })
      ).toHaveFocus();
    });
  });

  it("keeps the edit open and shows an error when saving fails", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);
    vi.mocked(updateSet).mockRejectedValue(new Error("Weight is invalid"));

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );
    await fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit set 1 for Bench Press",
      })
    );

    await fireEvent.input(
      screen.getByLabelText("Reps for set 1 of Bench Press"),
      { target: { value: "9" } }
    );
    await fireEvent.input(
      screen.getByLabelText("Weight for set 1 of Bench Press"),
      { target: { value: "82.5" } }
    );
    await fireEvent.submit(
      screen.getByRole("form", { name: "Edit set 1 for Bench Press" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Weight is invalid"
    );
    expect(
      screen.getByLabelText("Reps for set 1 of Bench Press")
    ).toHaveValue(9);
    expect(
      screen.getByRole("button", { name: "Save set 1 for Bench Press" })
    ).toBeEnabled();
  });

  it("focuses the reps field when editing opens", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Edit set 1 for Bench Press" })
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText("Reps for set 1 of Bench Press")
      ).toHaveFocus();
    });
  });

  it("disables other set edits while a save is pending", async () => {
    let resolveSave!: (set: LoggedSet) => void;
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);
    vi.mocked(updateSet).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );
    await fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit set 1 for Bench Press",
      })
    );
    await fireEvent.input(
      screen.getByLabelText("Reps for set 1 of Bench Press"),
      { target: { value: "9" } }
    );
    await fireEvent.input(
      screen.getByLabelText("Weight for set 1 of Bench Press"),
      { target: { value: "82.5" } }
    );
    await fireEvent.submit(
      screen.getByRole("form", { name: "Edit set 1 for Bench Press" })
    );

    expect(
      screen.getByRole("button", { name: "Edit set 2 for Bench Press" })
    ).toBeDisabled();

    const firstSet = detail.sets[0];
    if (!firstSet) throw new Error("detail fixture is missing a set");
    resolveSave({ ...firstSet, reps: 9, weightKg: 82.5 });
    expect(await screen.findByText("9 × 82.5 kg")).toBeInTheDocument();
  });

  it("does not reopen an abandoned edit after collapsing the session", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );
    await fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit set 1 for Bench Press",
      })
    );
    await fireEvent.input(
      screen.getByLabelText("Reps for set 1 of Bench Press"),
      { target: { value: "9" } }
    );

    await fireEvent.click(
      screen.getByRole("button", { name: "Hide Push Day" })
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "View Push Day" })
    );

    expect(await screen.findByText("8 × 80 kg")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reps for set 1 of Bench Press")
    ).not.toBeInTheDocument();
  });

  it("cancels editing a set without saving", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue(detail);

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );
    await fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit set 2 for Bench Press",
      })
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Cancel editing set 2 for Bench Press" })
    );

    expect(updateSet).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("Reps for set 2 of Bench Press")
    ).not.toBeInTheDocument();
    expect(screen.getByText("6 × 85 kg")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Edit set 2 for Bench Press" })
      ).toHaveFocus();
    });
  });

  it("displays weights with up to two decimals", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue({
      ...detail,
      sets: detail.sets.map((set, index) => ({
        ...set,
        weightKg: index === 0 ? 22.25 : 22.5,
      })),
    });

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );

    expect(await screen.findByText("8 × 22.25 kg")).toBeInTheDocument();
    expect(screen.getByText("6 × 22.5 kg")).toBeInTheDocument();
    expect(screen.queryByText(/22\.50/)).not.toBeInTheDocument();
  });

  it("lists detail exercises in plan order", async () => {
    vi.mocked(listSessions).mockResolvedValue(page([pushSession], 0, 1));
    vi.mocked(getSession).mockResolvedValue({
      ...detail,
      sets: [
        {
          id: "set-3",
          exerciseId: squat.id,
          exerciseName: squat.name,
          setNumber: 1,
          reps: 5,
          weightKg: 100,
          createdAt: "2026-10-26T18:20:00.000Z",
        },
        ...detail.sets,
      ],
    });

    renderHistory();

    await fireEvent.click(
      await screen.findByRole("button", { name: /view push day/i })
    );
    await screen.findAllByText("Set 1");

    expect(
      screen
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent)
    ).toEqual(["Bench Press", "Squat"]);
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

  it("shows an error without an empty state and retries", async () => {
    vi.mocked(listSessions)
      .mockRejectedValueOnce(new Error("Backend unavailable"))
      .mockResolvedValueOnce(page([pushSession], 0, 1));

    renderHistory();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable"
    );
    expect(
      screen.queryByText("No completed workouts yet")
    ).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();
  });

  it("ignores a stale page after filters change", async () => {
    let resolveFirst!: (value: Page<WorkoutSessionSummary>) => void;
    vi.mocked(listSessions)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValueOnce(page([pushSession], 0, 1));

    renderHistory();

    await fireEvent.change(screen.getByLabelText("Plan"), {
      target: { value: "plan-1" },
    });
    expect(
      await screen.findByRole("heading", { name: "Push Day" })
    ).toBeInTheDocument();

    resolveFirst(page([pullSession], 0, 1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText("Pull Day")).not.toBeInTheDocument();
  });
});
