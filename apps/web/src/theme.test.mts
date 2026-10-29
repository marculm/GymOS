import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const styles = read("./styles.css");
const html = read("../index.html");
const viteConfig = read("../vite.config.ts");

function manifestColor(key: string): string {
  return viteConfig.match(new RegExp(`${key}: "(#[0-9a-f]{6})"`))?.[1] ?? "";
}

describe("warm light theme", () => {
  it("uses light color scheme only", () => {
    expect(styles).toContain("color-scheme: light;");
    expect(styles).not.toContain("color-scheme: dark;");
  });

  it("keeps browser chrome and PWA manifest on the page background", () => {
    const background = styles.match(/--bg: (#[0-9a-f]{6});/)?.[1];
    const themeColor = html.match(/<meta name="theme-color" content="([^"]+)"/)?.[1];

    expect(background).toBeDefined();
    expect(themeColor).toBe(background);
    expect(manifestColor("theme_color")).toBe(background);
    expect(manifestColor("background_color")).toBe(background);
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
    ];

    for (const remnant of remnants) {
      expect(styles).not.toContain(remnant);
    }
  });
});
