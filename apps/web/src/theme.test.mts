import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const styles = read("./styles.css");
const html = read("../index.html");
const viteConfig = read("../vite.config.ts");

function cssVar(name: string): string {
  return styles.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1] ?? "";
}

function manifestColor(key: string): string {
  return viteConfig.match(new RegExp(`${key}: "(#[0-9a-f]{6})"`))?.[1] ?? "";
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: string, second: string): number {
  const [lighter = 0, darker = 0] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("warm light theme", () => {
  it("uses light color scheme only", () => {
    expect(styles).toContain("color-scheme: light;");
    expect(styles).not.toContain("color-scheme: dark;");
  });

  it("keeps browser chrome and PWA manifest on the page background", () => {
    const background = cssVar("bg");
    const themeColor = html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1];

    expect(background).toBeDefined();
    expect(themeColor).toBe(background);
    expect(manifestColor("theme_color")).toBe(background);
    expect(manifestColor("background_color")).toBe(background);
  });

  it("meets WCAG AA for text and control boundaries", () => {
    const pairs: Array<[string, string, number]> = [
      [cssVar("text"), cssVar("bg"), 4.5],
      [cssVar("text"), cssVar("surface"), 4.5],
      [cssVar("text"), cssVar("surface-2"), 4.5],
      [cssVar("muted"), cssVar("bg"), 4.5],
      [cssVar("muted"), cssVar("surface"), 4.5],
      [cssVar("muted"), cssVar("surface-2"), 4.5],
      [cssVar("accent"), cssVar("bg"), 4.5],
      [cssVar("accent"), cssVar("surface"), 4.5],
      ["#ffffff", cssVar("accent"), 4.5],
      [cssVar("border"), cssVar("bg"), 3],
      [cssVar("border"), cssVar("surface"), 3],
    ];

    for (const [foreground, background, minimum] of pairs) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("contains no dark-theme or blue-palette remnants", () => {
    const remnants = [
      "#0f172a",
      "#1e293b",
      "#273449",
      "#f8fafc",
      "#94a3b8",
      "#3b82f6",
      "#2563eb",
      "#ef4444",
    ];

    for (const source of [styles, html, viteConfig]) {
      for (const remnant of remnants) {
        expect(source).not.toContain(remnant);
      }
    }
  });
});
