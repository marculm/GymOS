import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlan, getActiveSession, listExercises, listSessions } from "./gym.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("gym api client", () => {
  it("lists exercises", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ exercises: [{ id: "exercise-1", name: "Squat" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const exercises = await listExercises();

    expect(exercises).toEqual([{ id: "exercise-1", name: "Squat" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gym/exercises",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("creates a plan", async () => {
    const plan = {
      id: "plan-1",
      name: "Push",
      description: null,
      createdAt: "2026-10-26T18:00:00.000Z",
      exercises: [],
    };
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ plan }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const created = await createPlan({
      name: "Push",
      exercises: [
        {
          exerciseId: "00000000-0000-4000-8000-000000000001",
          targetSets: 3,
          targetReps: 8,
        },
      ],
    });

    expect(created).toEqual(plan);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gym/plans",
      expect.objectContaining({ method: "POST" })
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "Push" });
  });

  it("passes the session limit as a query parameter", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ sessions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await listSessions(5);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/gym/sessions?limit=5");
  });

  it("throws ApiError with the server message on failure", async () => {
    mockFetch(
      new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(getActiveSession()).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Session not found",
    });
  });
});
