const TRAINING_COLOR = "#000000";
const LIGHT_COLOR = "#f2f2f7";

export function setThemeColor(color: string): void {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", color);
}

export function restoreThemeColor(): void {
  const path = window.location.pathname;
  setThemeColor(
    path.startsWith("/nutrition") || path.startsWith("/extractor")
      ? LIGHT_COLOR
      : TRAINING_COLOR
  );
}

export function lightThemeColor(): void {
  setThemeColor(LIGHT_COLOR);
}

export function trainingThemeColor(): void {
  setThemeColor(TRAINING_COLOR);
}
