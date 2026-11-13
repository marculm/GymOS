export const REST_PRESETS = [120, 150, 180] as const;

export const DEFAULT_REST_SECONDS = 150;

const STORAGE_KEY = "gymos.restTimerSeconds";

export function loadRestSeconds(): number {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return REST_PRESETS.includes(stored as (typeof REST_PRESETS)[number])
      ? stored
      : DEFAULT_REST_SECONDS;
  } catch {
    return DEFAULT_REST_SECONDS;
  }
}

export function saveRestSeconds(seconds: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // Remembering the preset is best-effort; the timer still runs.
  }
}

export function formatRestTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
