import { describe, expect, it } from "vitest";
import { fitPhoto } from "./meal-photo.mts";

describe("fitPhoto", () => {
  it("scales down the longest edge", () => {
    expect(fitPhoto(3000, 2000)).toEqual({ width: 1536, height: 1024 });
    expect(fitPhoto(1000, 2000)).toEqual({ width: 768, height: 1536 });
  });

  it("keeps smaller photos unchanged", () => {
    expect(fitPhoto(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
