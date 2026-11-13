import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pwaManifest } from "./pwa-manifest.mts";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const styles = read("./styles.css");
const html = read("./app.html");
const viteConfig = read("../vite.config.ts");

function blockVar(source: string, name: string): string {
  return source.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1] ?? "";
}

function rootVar(name: string): string {
  return blockVar(styles, name);
}

function lightVar(name: string): string {
  const block = styles.match(/\.light-space\s*\{([^}]*)\}/s)?.[1] ?? "";
  return blockVar(block, name);
}

function manifestColor(key: "theme_color" | "background_color"): string {
  return pwaManifest[key] ?? "";
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

describe("training-first theme", () => {
  it("uses a dark training space and a light management space", () => {
    expect(styles).toContain("color-scheme: dark;");
    expect(styles).toMatch(/\.light-space\s*\{[^}]*color-scheme: light;/s);
  });

  it("keeps browser chrome and PWA manifest on the training background", () => {
    const background = rootVar("bg");
    const themeColor = html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1];

    expect(background).toBe("#000000");
    expect(themeColor).toBe(background);
    expect(manifestColor("theme_color")).toBe(background);
    expect(manifestColor("background_color")).toBe(background);
  });

  it("meets WCAG AA in the training space", () => {
    const pairs: Array<[string, string, number]> = [
      [rootVar("text"), rootVar("bg"), 4.5],
      [rootVar("text"), rootVar("surface"), 4.5],
      [rootVar("text"), rootVar("surface-2"), 4.5],
      [rootVar("muted"), rootVar("bg"), 4.5],
      [rootVar("muted"), rootVar("surface"), 4.5],
      [rootVar("muted"), rootVar("surface-2"), 4.5],
      [rootVar("accent"), rootVar("bg"), 4.5],
      [rootVar("accent"), rootVar("surface"), 4.5],
      [rootVar("on-accent"), rootVar("accent"), 4.5],
      [rootVar("danger"), rootVar("surface"), 4.5],
      [rootVar("border"), rootVar("surface"), 3],
    ];

    for (const [foreground, background, minimum] of pairs) {
      expect(foreground).not.toBe("");
      expect(background).not.toBe("");
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("meets WCAG AA in the light management space", () => {
    const pairs: Array<[string, string, number]> = [
      [lightVar("text"), lightVar("bg"), 4.5],
      [lightVar("text"), lightVar("surface"), 4.5],
      [lightVar("text"), lightVar("surface-2"), 4.5],
      [lightVar("muted"), lightVar("bg"), 4.5],
      [lightVar("muted"), lightVar("surface"), 4.5],
      [lightVar("muted"), lightVar("surface-2"), 4.5],
      [lightVar("accent"), lightVar("bg"), 4.5],
      [lightVar("accent"), lightVar("surface"), 4.5],
      [lightVar("on-accent"), lightVar("accent"), 4.5],
      [lightVar("danger"), lightVar("surface"), 4.5],
      [lightVar("border"), lightVar("bg"), 3],
      [lightVar("border"), lightVar("surface"), 3],
    ];

    for (const [foreground, background, minimum] of pairs) {
      expect(foreground).not.toBe("");
      expect(background).not.toBe("");
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("contains no legacy dark or warm palette remnants", () => {
    const remnants = [
      "#0f172a",
      "#1e293b",
      "#273449",
      "#f8fafc",
      "#94a3b8",
      "#3b82f6",
      "#2563eb",
      "#ef4444",
      "#faf7f2",
      "#f3ede4",
      "#e5ddd1",
      "#1f1b16",
    ];

    for (const source of [styles, html, viteConfig]) {
      for (const remnant of remnants) {
        expect(source).not.toContain(remnant);
      }
    }
  });
});
