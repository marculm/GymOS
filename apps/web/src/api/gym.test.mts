import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client.mts";
import {
  createPlan,
  getActiveSession,
  listExercises,
  listSessions,
} from "./gym.mts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const emptyPage = {
  content: [],
  page: { size: 20, number: 0, totalElements: 0, totalPages: 0 },
};

describe("gym api client", () => {
  it("lists exercises as a page", async () => {
    const fetchMock = mockFetch(
      new Response(
        JSON.stringify({
          content: [{ id: "exercise-1", name: "Squat" }],
          page: { size: 20, number: 0, totalElements: 1, totalPages: 1 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const exercises = await listExercises();

    expect(exercises.content).toEqual([{ id: "exercise-1", name: "Squat" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gym/exercises",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("creates a plan and returns the bare resource", async () => {
    const plan = {
      id: "plan-1",
      name: "Push",
      description: null,
      createdAt: "2026-10-26T18:00:00.000Z",
      exercises: [],
    };
    const fetchMock = mockFetch(
      new Response(JSON.stringify(plan), {
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
  });

  it("passes page and size as query parameters", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify(emptyPage), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await listSessions({ page: 2, size: 5 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/gym/sessions?page=2&size=5");
  });

  it("returns null for a missing active session", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          title: "Not Found",
          status: 404,
          detail: "No active session",
          instance: "/api/gym/sessions/active",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    await expect(getActiveSession()).resolves.toBeNull();
  });

  it("throws ApiError with the problem detail on failure", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          title: "Not Found",
          status: 404,
          detail: "Session not found",
          instance: "/api/gym/sessions/missing",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    await expect(api.get("/gym/sessions/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Session not found",
    });
  });
});
