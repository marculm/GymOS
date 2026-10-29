import { describe, expect, it } from "vitest";
import { createPageable } from "./pageable.mts";

describe("createPageable", () => {
  it("converts 1-based page input to a 0-based page number", () => {
    expect(createPageable({ page: 3, size: 10 })).toEqual({ number: 2, size: 10 });
  });

  it("normalizes out-of-range page and size to defaults", () => {
    expect(createPageable({ page: 0, size: 0 })).toEqual({ number: 0, size: 20 });
    expect(createPageable({ page: -4, size: 500 })).toEqual({
      number: 0,
      size: 20,
    });
  });

  it("uses defaults when page and size are missing", () => {
    expect(createPageable({})).toEqual({ number: 0, size: 20 });
  });
});
