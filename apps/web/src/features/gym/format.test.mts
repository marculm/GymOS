import { describe, expect, it } from "vitest";
import { formatWeight } from "./format.mts";

describe("formatWeight", () => {
  it.each([
    [22.25, "22.25"],
    [22.5, "22.5"],
    [22, "22"],
    [0, "0"],
    [1234.5, "1234.5"],
    [22.256, "22.26"],
  ])("formats %s kg as %s", (weightKg, expected) => {
    expect(formatWeight(weightKg)).toBe(expected);
  });
});
