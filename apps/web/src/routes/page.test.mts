import { describe, expect, it } from "vitest";
import { load } from "./+page";

describe("/", () => {
  it("redirects to /gym", () => {
    try {
      load();
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ status: 307, location: "/gym" });
    }
  });
});
