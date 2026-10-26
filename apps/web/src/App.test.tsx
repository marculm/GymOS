import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { App } from "./App.tsx";

vi.mock("./api/gym.ts", () => ({
  listExercises: vi.fn().mockResolvedValue([]),
  listPlans: vi.fn().mockResolvedValue([]),
  createPlan: vi.fn(),
  startSession: vi.fn(),
  getActiveSession: vi.fn().mockResolvedValue(null),
  listSessions: vi.fn().mockResolvedValue([]),
  addSet: vi.fn(),
  completeSession: vi.fn(),
}));

describe("GymOS App Component", () => {
  it("renders GymOS header", async () => {
    render(<App />);
    await screen.findByText("No plans yet");
    expect(screen.getByText(/GymOS/i)).toBeInTheDocument();
  });

  it("switches to Nutrition tab when clicked", async () => {
    render(<App />);
    await screen.findByText("No plans yet");
    const nutritionBtn = screen.getByRole("button", { name: /Nutrition/i });
    fireEvent.click(nutritionBtn);
    expect(screen.getByText("Nutrition & Mealprep")).toBeInTheDocument();
  });

  it("switches to AI Extractor tab when clicked", async () => {
    render(<App />);
    await screen.findByText("No plans yet");
    const extractorBtn = screen.getByRole("button", { name: /AI Extractor/i });
    fireEvent.click(extractorBtn);
    expect(screen.getByText(/TikTok \/ Reels AI Extractor/i)).toBeInTheDocument();
  });

  it("shows the three main tabs in the navigation", async () => {
    render(<App />);
    await screen.findByText("No plans yet");
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getAllByRole("button")).toHaveLength(3);
  });
});
