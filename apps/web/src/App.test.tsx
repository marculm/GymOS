import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { App } from "./App.tsx";

describe("GymOS App Component", () => {
  it("renders GymOS header", () => {
    render(<App />);
    expect(screen.getByText(/GymOS/i)).toBeInTheDocument();
  });

  it("switches to Nutrition tab when clicked", () => {
    render(<App />);
    const nutritionBtn = screen.getByRole("button", { name: /Nutrition/i });
    fireEvent.click(nutritionBtn);
    expect(screen.getByText("Nutrition & Mealprep")).toBeInTheDocument();
  });

  it("switches to AI Extractor tab when clicked", () => {
    render(<App />);
    const extractorBtn = screen.getByRole("button", { name: /AI Extractor/i });
    fireEvent.click(extractorBtn);
    expect(screen.getByText(/TikTok \/ Reels AI Extractor/i)).toBeInTheDocument();
  });

  it("shows the three main tabs in the navigation", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getAllByRole("button")).toHaveLength(3);
  });
});
