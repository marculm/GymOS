import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const build = resolve(process.cwd(), "build");
const immutable = join(build, "_app", "immutable");
const failures: string[] = [];

const html = readFileSync(join(build, "index.html"), "utf8");
if (!html.includes('rel="manifest"')) {
  failures.push("index.html has no manifest link");
}

for (const icon of [
  "apple-touch-icon.png",
  "pwa-192x192.png",
  "pwa-512x512.png",
  "pwa-maskable-512x512.png",
]) {
  if (!existsSync(join(build, icon))) {
    failures.push(`missing ${icon}`);
  }
}

const sw = readFileSync(join(build, "sw.js"), "utf8");
if (!sw.includes("gymos-shell")) {
  failures.push("sw.js has no shell cache");
}

const registers = readdirSync(immutable, { recursive: true })
  .filter((file): file is string => typeof file === "string" && file.endsWith(".js"))
  .some((file) =>
    readFileSync(join(immutable, file), "utf8").includes("serviceWorker.register"),
  );
if (!registers) {
  failures.push("no service worker registration in the client bundle");
}

if (failures.length > 0) {
  console.error(`Build checks failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("PWA build checks passed");
