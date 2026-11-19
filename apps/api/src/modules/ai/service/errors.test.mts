import { describe, expect, it } from "vitest";
import {
  AiInvalidResponseError,
  AiNotConfiguredError,
  AiProviderError,
} from "./errors.mts";

describe("AI error messages", () => {
  it("does not assume a meal", () => {
    const errors = [
      new AiNotConfiguredError(),
      new AiProviderError(500),
      new AiInvalidResponseError(),
    ];

    for (const error of errors) {
      expect(error.message).not.toMatch(/meal/i);
    }
  });
});
