import { afterEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { goToSpace, spaceSwipe } from "./space.ts";

vi.mock("$app/navigation", () => ({
  goto: vi.fn(async () => undefined),
  preloadData: vi.fn(async () => ({})),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function swipe(
  node: Element,
  fromX: number,
  toX: number,
  fromY = 120,
  toY = 120,
  pointerId = 1
) {
  node.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: fromX,
      clientY: fromY,
      pointerId,
      isPrimary: true,
      bubbles: true,
    })
  );
  node.dispatchEvent(
    new PointerEvent("pointerup", {
      clientX: toX,
      clientY: toY,
      pointerId,
      isPrimary: true,
      bubbles: true,
    })
  );
}

describe("space gestures", () => {
  it("navigates to the other space", async () => {
    goToSpace("nutrition");
    expect(goto).toHaveBeenCalledWith("/nutrition", { replaceState: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    goToSpace("training");
    expect(goto).toHaveBeenCalledWith("/gym", { replaceState: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("ignores a second switch while one is running", async () => {
    goToSpace("nutrition");
    goToSpace("training");

    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith("/nutrition", { replaceState: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("swipes left to advance and right to go back", () => {
    const node = document.createElement("div");
    document.body.appendChild(node);
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const action = spaceSwipe(node, { onSwipeLeft, onSwipeRight }) as {
      destroy: () => void;
    };

    swipe(node, 300, 200);
    expect(onSwipeLeft).toHaveBeenCalledOnce();

    swipe(node, 100, 220, 120, 120, 2);
    expect(onSwipeRight).toHaveBeenCalledOnce();

    swipe(node, 200, 180, 100, 220, 3);
    expect(onSwipeLeft).toHaveBeenCalledOnce();

    action.destroy();
    node.remove();
  });

  it("suppresses the click after a swipe", () => {
    const node = document.createElement("div");
    const button = document.createElement("button");
    node.appendChild(button);
    document.body.appendChild(node);

    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    const action = spaceSwipe(node, { onSwipeLeft: vi.fn() }) as {
      destroy: () => void;
    };

    swipe(button, 300, 200);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(click);

    expect(onClick).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
    action.destroy();
    node.remove();
  });

  it("keeps a normal click", () => {
    const node = document.createElement("div");
    const button = document.createElement("button");
    node.appendChild(button);
    document.body.appendChild(node);

    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    const action = spaceSwipe(node, { onSwipeLeft: vi.fn() }) as {
      destroy: () => void;
    };

    swipe(button, 200, 200);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(click);

    expect(onClick).toHaveBeenCalledOnce();
    expect(click.defaultPrevented).toBe(false);
    action.destroy();
    node.remove();
  });
});
