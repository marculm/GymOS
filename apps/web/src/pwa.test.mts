import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pwaManifest } from "./pwa-manifest.mts";

const srcDir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(srcDir, "../public");

function pngSize(path: string): { width: number; height: number } {
  const png = readFileSync(path);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("PWA manifest assets", () => {
  it("ships every icon at its declared size", () => {
    const icons = pwaManifest.icons ?? [];

    expect(icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);

    for (const icon of icons) {
      const { width, height } = pngSize(resolve(publicDir, icon.src.replace(/^\//, "")));
      expect(`${width}x${height}`).toBe(icon.sizes);
    }
  });

  it("links the Apple touch icon and ships it at 180x180", () => {
    const html = readFileSync(resolve(srcDir, "app.html"), "utf8");

    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(pngSize(resolve(publicDir, "apple-touch-icon.png"))).toEqual({
      width: 180,
      height: 180,
    });
  });
});
