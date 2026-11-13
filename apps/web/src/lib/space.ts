import { goto, preloadData } from "$app/navigation";
import type { Action } from "svelte/action";

export type Space = "training" | "nutrition";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => Promise<unknown> | void) => {
    finished: Promise<void>;
  };
};

const prefetched = new Set<string>();

export function prefetchSpace(space: Space): void {
  const path = space === "nutrition" ? "/nutrition" : "/gym";
  if (prefetched.has(path)) return;
  prefetched.add(path);
  void preloadData(path).catch(() => prefetched.delete(path));
}

export function goToSpace(space: Space): void {
  const path = space === "nutrition" ? "/nutrition" : "/gym";
  prefetchSpace(space);
  const doc = document as ViewTransitionDocument;

  if (!doc.startViewTransition) {
    void goto(path);
    return;
  }

  document.documentElement.dataset.space =
    space === "nutrition" ? "to-nutrition" : "to-training";

  const transition = doc.startViewTransition(() => goto(path));
  void transition.finished.finally(() => {
    delete document.documentElement.dataset.space;
  });
}

type SwipeParams = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

const THRESHOLD = 64;

export const spaceSwipe: Action<HTMLElement, SwipeParams> = (node, params) => {
  let start: { x: number; y: number; pointerId: number } | null = null;

  function pointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  }

  function pointerUp(event: PointerEvent) {
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;

    if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.4) {
      return;
    }

    if (dx < 0) params.onSwipeLeft?.();
    else params.onSwipeRight?.();
  }

  function pointerCancel() {
    start = null;
  }

  node.addEventListener("pointerdown", pointerDown);
  node.addEventListener("pointerup", pointerUp);
  node.addEventListener("pointercancel", pointerCancel);

  return {
    update(next: SwipeParams) {
      params = next;
    },
    destroy() {
      node.removeEventListener("pointerdown", pointerDown);
      node.removeEventListener("pointerup", pointerUp);
      node.removeEventListener("pointercancel", pointerCancel);
    },
  };
};
