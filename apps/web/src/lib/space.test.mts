import { afterEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { goToSpace, spaceSwipe } from "./space.ts";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  preloadData: vi.fn(async () => ({})),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("space gestures", () => {
  it("navigates to the other space", () => {
    goToSpace("nutrition");
    expect(goto).toHaveBeenCalledWith("/nutrition", { replaceState: true });

    goToSpace("training");
    expect(goto).toHaveBeenCalledWith("/gym", { replaceState: true });
  });

  it("swipes left to advance and right to go back", () => {
    const node = document.createElement("div");
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const action = spaceSwipe(node, { onSwipeLeft, onSwipeRight }) as {
      destroy: () => void;
    };

    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 300,
        clientY: 120,
        pointerId: 1,
        bubbles: true,
      })
    );
    node.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 200,
        clientY: 120,
        pointerId: 1,
        bubbles: true,
      })
    );
    expect(onSwipeLeft).toHaveBeenCalledOnce();

    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 100,
        clientY: 120,
        pointerId: 2,
        bubbles: true,
      })
    );
    node.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 220,
        clientY: 120,
        pointerId: 2,
        bubbles: true,
      })
    );
    expect(onSwipeRight).toHaveBeenCalledOnce();

    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 200,
        clientY: 100,
        pointerId: 3,
        bubbles: true,
      })
    );
    node.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 180,
        clientY: 220,
        pointerId: 3,
        bubbles: true,
      })
    );
    expect(onSwipeLeft).toHaveBeenCalledOnce();

    action.destroy();
  });
});
