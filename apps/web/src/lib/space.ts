import { goto, preloadData } from "$app/navigation";
import type { Action } from "svelte/action";

export type Space = "training" | "nutrition";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => Promise<unknown> | void) => {
    finished: Promise<void>;
  };
};

const prefetched = new Set<string>();
let switching = false;

function pathFor(space: Space): string {
  return space === "nutrition" ? "/nutrition" : "/gym";
}

export function prefetchSpace(space: Space): void {
  const path = pathFor(space);
  if (prefetched.has(path)) return;
  prefetched.add(path);
  void preloadData(path).catch(() => prefetched.delete(path));
}

export function goToSpace(space: Space): void {
  const path = pathFor(space);
  if (switching || window.location.pathname === path) return;

  switching = true;
  prefetchSpace(space);

  const doc = document as ViewTransitionDocument;
  let unlockTimer: ReturnType<typeof setTimeout> | undefined;

  const settle = () => {
    if (unlockTimer) clearTimeout(unlockTimer);
    switching = false;
    delete document.documentElement.dataset.space;
  };

  unlockTimer = setTimeout(settle, 1500);

  if (!doc.startViewTransition) {
    void goto(path, { replaceState: true })
      .catch(() => {})
      .finally(settle);
    return;
  }

  document.documentElement.dataset.space =
    space === "nutrition" ? "to-nutrition" : "to-training";

  try {
    const transition = doc.startViewTransition(() =>
      goto(path, { replaceState: true })
    );
    void transition.finished.finally(settle).catch(() => {});
  } catch {
    settle();
    void goto(path, { replaceState: true }).catch(() => {});
  }
}

type SwipeParams = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

const DISTANCE = 48;
const FLICK_DISTANCE = 32;
const FLICK_VELOCITY = 0.5;
const HORIZONTAL_RATIO = 1.2;

export const spaceSwipe: Action<HTMLElement, SwipeParams> = (node, params) => {
  let start: {
    x: number;
    y: number;
    pointerId: number;
    time: number;
  } | null = null;
  let suppressClick = false;
  let suppressTimer: ReturnType<typeof setTimeout> | undefined;

  function pointerDown(event: PointerEvent) {
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (suppressTimer) clearTimeout(suppressTimer);
    suppressClick = false;
    start = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      time: performance.now(),
    };
  }

  function pointerUp(event: PointerEvent) {
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.time);
    start = null;

    const distance = Math.abs(dx);
    const isFlick =
      distance >= FLICK_DISTANCE && distance / elapsed >= FLICK_VELOCITY;
    const isHorizontal = Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_RATIO;

    if (!isHorizontal || (distance < DISTANCE && !isFlick)) return;

    const callback = dx < 0 ? params.onSwipeLeft : params.onSwipeRight;
    if (!callback) return;

    suppressClick = true;
    if (suppressTimer) clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => {
      suppressClick = false;
    }, 350);

    callback();
  }

  function pointerCancel(event: PointerEvent) {
    if (start && event.pointerId === start.pointerId) start = null;
  }

  function clickCapture(event: MouseEvent) {
    if (!suppressClick) return;
    suppressClick = false;
    if (suppressTimer) clearTimeout(suppressTimer);
    event.preventDefault();
    event.stopPropagation();
  }

  node.addEventListener("pointerdown", pointerDown);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointercancel", pointerCancel);
  node.addEventListener("click", clickCapture, true);

  return {
    update(next: SwipeParams) {
      params = next;
    },
    destroy() {
      if (suppressTimer) clearTimeout(suppressTimer);
      node.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      node.removeEventListener("click", clickCapture, true);
    },
  };
};
