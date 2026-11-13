# SvelteKit Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `apps/web` from a Vite-mounted Svelte SPA to a SvelteKit static SPA with `/gym`, `/nutrition`, and `/extractor` routes, without changing the API, features, styles, or deployment model.

**Architecture:** SvelteKit 2 + `adapter-static` builds a client-rendered SPA (`ssr = false`, `fallback: index.html`). A root layout owns the header, content area, and tab bar; three route pages own the feature content. The existing components, API client, and styles stay in place and are reached through `$features` / `$api` aliases. nginx keeps serving static files; only the build directory and hashed-asset path change.

**Tech Stack:** SvelteKit 2.70, `@sveltejs/adapter-static` 3.0, Svelte 5, Vite 6, Vitest 4, happy-dom, `vite-plugin-pwa` 0.21, Workbox 7.

**Spec:** `docs/superpowers/specs/2026-11-13-sveltekit-migration-design.md`

## Global Constraints

- Use SvelteKit 2.70.x and `@sveltejs/adapter-static` 3.0.x. Do not upgrade Vite, TypeScript, Vitest, or `@sveltejs/vite-plugin-svelte`.
- No SSR, no SvelteKit server endpoints, no server load functions. `ssr = false` in the root layout.
- Do not change the Hono API, `packages/shared`, the database, the styles, or the Gym features.
- Keep `vite-plugin-pwa`; the only service-worker change is the SPA navigation fallback.
- Use Bun and Vitest. Every commit message is `#126: <Add|Update|Remove|Move|Fix> <target>`.
- Never read, write, or create `.env` files.
- `bun run lint:adr` must stay green.

## Review Focus

- Offline deep link to `/nutrition` must load the shell; the service worker needs a navigation fallback, not only the precache.
- The navigation fallback must not intercept `/api/*`, `/health`, `/sw.js`, or `/manifest.webmanifest`.
- An active session hides the tab bar, and returning to `/gym` recovers the session through `getActiveSession`.
- nginx must serve SvelteKit's hashed `/_app/immutable/*` assets with a long cache and keep `sw.js` and the manifest uncached.
- `vite-plugin-pwa` must keep emitting `registerSW.js` and injecting it into the built HTML, so the PWA update flow is unchanged.

---

### Task 1: Add SvelteKit and render the Gym screen at `/gym`

**Files:**
- Modify: `package.json` (root `test` and `test:watch` scripts)
- Delete: `vitest.config.ts` (root project aggregator)
- Modify: `apps/web/package.json`
- Create: `apps/web/svelte.config.js`
- Create: `apps/web/src/app.html`
- Create: `apps/web/src/routes/+layout.ts`
- Create: `apps/web/src/routes/+layout.svelte`
- Create: `apps/web/src/routes/+page.ts`
- Create: `apps/web/src/routes/gym/+page.svelte`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/tsconfig.json`
- Modify: `apps/web/src/pwa.test.mts`
- Test: `apps/web/src/routes/gym/page.test.mts`

**Interfaces:**
- Consumes: `GymView` from `src/features/gym/GymView.svelte`; `pwaManifest` from `src/pwa-manifest.mts`.
- Produces: SvelteKit project config with `$api` and `$features` aliases; `src/routes/gym/+page.svelte` renders `GymView` with no props yet; `/` redirects to `/gym`.

- [ ] **Step 1: Write the failing Gym route test**

Create `apps/web/src/routes/gym/page.test.mts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { getActiveSession, getRotation, listAllExercises, listAllPlans } from "../../api/gym.mts";
import GymPage from "./+page.svelte";

vi.mock("../../api/gym.mts", () => ({
  listAllExercises: vi.fn().mockResolvedValue([]),
  listAllPlans: vi.fn().mockResolvedValue([]),
  getRotation: vi.fn().mockResolvedValue({ plans: [], nextPlanId: null }),
  getActiveSession: vi.fn().mockResolvedValue(null),
  createPlan: vi.fn(),
  setRotation: vi.fn(),
  startSession: vi.fn(),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  completeSession: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getActiveSession).mockResolvedValue(null);
});

describe("Gym route", () => {
  it("renders the Gym start screen", async () => {
    render(GymPage);
    expect(await screen.findByText("No workout scheduled")).toBeInTheDocument();
    expect(getRotation).toHaveBeenCalled();
    expect(listAllExercises).toHaveBeenCalled();
    expect(listAllPlans).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run --cwd apps/web test src/routes/gym/page.test.mts`
Expected: FAIL with a missing `./+page.svelte` import or an unresolved SvelteKit config.

- [ ] **Step 3: Add the SvelteKit configuration**

`apps/web/package.json`: keep the existing `name`, `version`, `type`, and `private` fields and replace the scripts and dependency blocks with:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "test": "svelte-kit sync && vitest run",
    "test:watch": "svelte-kit sync && vitest",
    "typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "prepare": "svelte-kit sync"
  },
  "dependencies": {
    "@gymos/shared": "workspace:*",
    "lucide-svelte": "^1.0.1",
    "svelte": "^5.57.3"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.11",
    "@sveltejs/kit": "^2.70.4",
    "@sveltejs/vite-plugin-svelte": "^6",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/svelte": "^5.4.2",
    "happy-dom": "^21.0.4",
    "svelte-check": "^4.7.7",
    "vite": "^6.2.0",
    "vite-plugin-pwa": "^0.21.1",
    "vitest": "^4.1.11",
    "workbox-precaching": "^7.4.1"
  }
}
```

Keep the existing dependency versions; only add the two SvelteKit packages.

Create `apps/web/svelte.config.js`:

```js
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: "index.html" }),
    alias: {
      $api: "src/api",
      $features: "src/features",
    },
  },
};
```

Create `apps/web/src/app.html` with the old document tags:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#faf7f2" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <title>GymOS</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

Create `apps/web/src/routes/+layout.ts`:

```ts
export const ssr = false;
```

Create `apps/web/src/routes/+layout.svelte` with the header and content slot; the tab bar comes in Task 2:

```svelte
<script lang="ts">
  import "../styles.css";

  let { children } = $props();
</script>

<div class="app">
  <header class="app-header">
    <h1>🏋️ GymOS</h1>
    <p class="muted">All-in-one Gym & Nutrition OS</p>
  </header>

  <main class="content">
    {@render children()}
  </main>
</div>
```

Create `apps/web/src/routes/+page.ts`:

```ts
import { redirect } from "@sveltejs/kit";

export function load() {
  redirect(307, "/gym");
}
```

Create `apps/web/src/routes/gym/+page.svelte`:

```svelte
<script lang="ts">
  import GymView from "$features/gym/GymView.svelte";
</script>

<GymView />
```

Update `apps/web/vite.config.ts` to use the SvelteKit plugin. Keep `resolve.conditions: ["browser"]` (Vitest needs Svelte's browser build), `VitePWA`, the dev proxies, and the `test` block; replace the bare `svelte()` plugin:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import { pwaManifest } from "./src/pwa-manifest.mts";

export default defineConfig({
  resolve: {
    conditions: ["browser"],
  },
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      manifest: pwaManifest,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/health": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.mts"],
  },
});
```

Update `apps/web/tsconfig.json`:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "types": ["vite/client"]
  }
}
```

Update `apps/web/src/pwa.test.mts` to read `app.html` instead of `index.html`:

```ts
const html = readFileSync(resolve(srcDir, "app.html"), "utf8");
```

Delete the old `index.html` in Task 2, after this test no longer reads it.

- [ ] **Step 4: Run each workspace's tests in its own directory**

SvelteKit resolves `svelte.config.js` and `.svelte-kit` from `process.cwd()`. The root
Vitest project aggregator would run the web project from the repo root, so remove it.
In the root `package.json`, replace the test scripts:

```json
"test": "bun --filter @gymos/api db:generate && bun run --cwd apps/api test && bun run --cwd apps/web test && bun run --cwd packages/shared test",
"test:watch": "bun run --cwd apps/api test:watch & bun run --cwd apps/web test:watch"
```

Then delete `vitest.config.ts`:

```bash
git rm vitest.config.ts
```

- [ ] **Step 5: Install the new dependencies**

Run: `bun install`
Expected: `@sveltejs/kit` and `@sveltejs/adapter-static` resolve without peer warnings.

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run --cwd apps/web test src/routes/gym/page.test.mts`
Expected: PASS, one test.

- [ ] **Step 7: Verify the static build**

Run: `bun run build`
Expected: `apps/web/build/index.html` exists and `apps/web/build/_app/` contains the JS/CSS assets.

- [ ] **Step 8: Commit**

```bash
git add package.json apps/web/package.json apps/web/svelte.config.js apps/web/src/app.html \
  apps/web/src/routes apps/web/vite.config.ts apps/web/tsconfig.json \
  apps/web/src/pwa.test.mts bun.lock vitest.config.ts
git commit -m "#126: Add SvelteKit scaffold"
```

---

### Task 2: Add the tab shell and the placeholder routes

**Files:**
- Create: `apps/web/src/lib/TabBar.svelte`
- Modify: `apps/web/src/routes/+layout.svelte`
- Create: `apps/web/src/routes/nutrition/+page.svelte`
- Create: `apps/web/src/routes/extractor/+page.svelte`
- Delete: `apps/web/src/App.svelte`
- Delete: `apps/web/src/App.test.mts`
- Delete: `apps/web/src/main.mts`
- Delete: `apps/web/index.html`
- Test: `apps/web/src/lib/TabBar.test.mts`
- Test: `apps/web/src/routes/placeholders.test.mts`

**Interfaces:**
- Consumes: the layout and aliases from Task 1.
- Produces: `TabBar` with props `{ pathname: string }`; routes `/gym`, `/nutrition`, `/extractor`; the layout renders `<TabBar pathname={page.url.pathname} />`.

- [ ] **Step 1: Write the failing TabBar and placeholder tests**

Create `apps/web/src/lib/TabBar.test.mts`:

```ts
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import TabBar from "./TabBar.svelte";

describe("TabBar", () => {
  it("renders the three top-level destinations", () => {
    render(TabBar, { pathname: "/gym" });
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/gym",
      "/nutrition",
      "/extractor",
    ]);
  });

  it("marks the active destination from the pathname", () => {
    render(TabBar, { pathname: "/nutrition" });
    expect(screen.getByRole("link", { name: /nutrition/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /^gym$/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps a nested path on its top-level tab", () => {
    render(TabBar, { pathname: "/nutrition/recipes/1" });
    expect(screen.getByRole("link", { name: /nutrition/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
```

Create `apps/web/src/routes/placeholders.test.mts`:

```ts
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import NutritionPage from "./nutrition/+page.svelte";
import ExtractorPage from "./extractor/+page.svelte";

describe("placeholder routes", () => {
  it("renders the Nutrition placeholder", () => {
    render(NutritionPage);
    expect(screen.getByText("Nutrition & Mealprep")).toBeInTheDocument();
  });

  it("renders the AI Extractor placeholder", () => {
    render(ExtractorPage);
    expect(screen.getByText("TikTok / Reels AI Extractor")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run --cwd apps/web test src/lib/TabBar.test.mts apps/web/src/routes/placeholders.test.mts`
Expected: FAIL with missing `TabBar.svelte` and placeholder route files.

- [ ] **Step 3: Implement the tab bar and routes**

`apps/web/src/lib/TabBar.svelte`:

```svelte
<script lang="ts">
  import { Dumbbell, Sparkles, Utensils } from "lucide-svelte";

  let { pathname }: { pathname: string } = $props();

  const tabs = [
    { href: "/gym", label: "Gym", icon: Dumbbell },
    { href: "/nutrition", label: "Nutrition", icon: Utensils },
    { href: "/extractor", label: "AI Extractor", icon: Sparkles },
  ] as const;

  function isActive(href: string, current: string): boolean {
    return current === href || current.startsWith(`${href}/`);
  }
</script>

<nav class="tab-bar" aria-label="Main navigation">
  {#each tabs as { href, label, icon: Icon } (href)}
    <a
      {href}
      class={isActive(href, pathname) ? "tab tab-active" : "tab"}
      aria-current={isActive(href, pathname) ? "page" : undefined}
    >
      <Icon size={20} aria-hidden="true" />
      {label}
    </a>
  {/each}
</nav>
```

Update `apps/web/src/routes/+layout.svelte` to import `page` and `TabBar`, and render the tab bar below `<main>`:

```svelte
<script lang="ts">
  import { page } from "$app/state";
  import TabBar from "$lib/TabBar.svelte";
  import "../styles.css";

  let { children } = $props();
</script>

<div class="app">
  <header class="app-header">
    <h1>🏋️ GymOS</h1>
    <p class="muted">All-in-one Gym & Nutrition OS</p>
  </header>

  <main class="content">
    {@render children()}
  </main>

  <TabBar pathname={page.url.pathname} />
</div>
```

Create `apps/web/src/routes/nutrition/+page.svelte` with the old placeholder card:

```svelte
<section class="card">
  <h2 class="card-title">Nutrition & Mealprep</h2>
  <p class="muted">Calculate macros, plan meals, and log recipes.</p>
</section>
```

Create `apps/web/src/routes/extractor/+page.svelte`:

```svelte
<section class="card">
  <h2 class="card-title">TikTok / Reels AI Extractor</h2>
  <p class="muted">Import recipes and ingredients directly from video URLs.</p>
</section>
```

Delete the old entry points:

```bash
git rm apps/web/src/App.svelte apps/web/src/App.test.mts apps/web/src/main.mts apps/web/index.html
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run --cwd apps/web test src/lib/TabBar.test.mts apps/web/src/routes/placeholders.test.mts`
Expected: PASS, five tests.

- [ ] **Step 5: Run the whole web suite to catch the deleted entry points**

Run: `bun run --cwd apps/web test`
Expected: PASS. If a test still imports `App.svelte`, update it to the route it now covers.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/TabBar.svelte apps/web/src/lib/TabBar.test.mts \
  apps/web/src/routes apps/web/src/App.svelte apps/web/src/App.test.mts \
  apps/web/src/main.mts apps/web/index.html
git commit -m "#126: Add the app shell and routes"
```

---

### Task 3: Hide the tab bar during an active session

**Files:**
- Create: `apps/web/src/lib/shell.svelte.ts`
- Modify: `apps/web/src/routes/+layout.svelte`
- Modify: `apps/web/src/routes/gym/+page.svelte`
- Modify: `apps/web/src/features/gym/GymView.svelte`
- Create: `apps/web/src/test/SessionShellHarness.svelte`
- Test: `apps/web/src/routes/session-shell.test.mts`

**Interfaces:**
- Consumes: `TabBar` from Task 2; `GymView`'s `onSessionActiveChange?: (active: boolean) => void` prop.
- Produces: a module-level `shell` singleton with `sessionActive = $state(false)` from `$lib/shell.svelte.ts`; the layout hides `<TabBar>` when `shell.sessionActive` is true; `GymView` notifies only when its active state changes.

- [ ] **Step 1: Write the failing session-shell test**

Create `apps/web/src/test/SessionShellHarness.svelte`:

```svelte
<script lang="ts">
  import Layout from "../routes/+layout.svelte";
  import GymPage from "../routes/gym/+page.svelte";
</script>

<Layout><GymPage /></Layout>
```

Create `apps/web/src/routes/session-shell.test.mts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { WorkoutSessionDetail } from "@gymos/shared";
import { getActiveSession } from "../api/gym.mts";
import { shell } from "../lib/shell.svelte.ts";
import Harness from "../test/SessionShellHarness.svelte";

vi.mock("$app/state", () => ({
  page: { url: { pathname: "/gym" } },
}));

vi.mock("../api/gym.mts", () => ({
  listAllExercises: vi.fn().mockResolvedValue([]),
  listAllPlans: vi.fn().mockResolvedValue([]),
  getRotation: vi.fn().mockResolvedValue({ plans: [], nextPlanId: null }),
  getActiveSession: vi.fn().mockResolvedValue(null),
  createPlan: vi.fn(),
  setRotation: vi.fn(),
  startSession: vi.fn(),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  completeSession: vi.fn(),
}));

const activeSession: WorkoutSessionDetail = {
  id: "session-1",
  title: "Free workout",
  planId: null,
  startedAt: "2026-11-13T18:00:00.000Z",
  completedAt: null,
  sets: [],
};

beforeEach(() => {
  shell.sessionActive = false;
  vi.mocked(getActiveSession).mockResolvedValue(null);
});

describe("session shell", () => {
  it("shows the tab bar when no session is active", async () => {
    render(Harness);
    expect(await screen.findByText("No workout scheduled")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });

  it("hides the tab bar while a session is active", async () => {
    vi.mocked(getActiveSession).mockResolvedValue(activeSession);
    render(Harness);

    expect(await screen.findByRole("button", { name: /finish workout/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /main navigation/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run --cwd apps/web test src/routes/session-shell.test.mts`
Expected: FAIL because the page does not pass a session callback and the layout always shows the tab bar.

- [ ] **Step 3: Implement the shell state**

Create `apps/web/src/lib/shell.svelte.ts`:

```ts
class ShellState {
  sessionActive = $state(false);
}

export const shell = new ShellState();
```

Update `apps/web/src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import { page } from "$app/state";
  import TabBar from "$lib/TabBar.svelte";
  import { shell } from "$lib/shell.svelte.ts";
  import "../styles.css";

  let { children } = $props();
</script>

<div class="app">
  <header class="app-header">
    <h1>🏋️ GymOS</h1>
    <p class="muted">All-in-one Gym & Nutrition OS</p>
  </header>

  <main class="content">
    {@render children()}
  </main>

  {#if !shell.sessionActive}
    <TabBar pathname={page.url.pathname} />
  {/if}
</div>
```

Update `apps/web/src/routes/gym/+page.svelte`:

```svelte
<script lang="ts">
  import GymView from "$features/gym/GymView.svelte";
  import { shell } from "$lib/shell.svelte.ts";

  function handleSessionActive(active: boolean) {
    shell.sessionActive = active;
  }
</script>

<GymView onSessionActiveChange={handleSessionActive} />
```

Update the effect in `apps/web/src/features/gym/GymView.svelte` so it notifies only when the active state changes; calling the callback on every effect run re-triggers the shell state and exceeds Svelte's update depth:

```ts
let sessionActive = $derived(activeSession !== null);
let lastSessionActive: boolean | undefined;

$effect(() => {
  if (sessionActive === lastSessionActive) return;
  lastSessionActive = sessionActive;
  onSessionActiveChange?.(sessionActive);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run --cwd apps/web test src/routes/session-shell.test.mts`
Expected: PASS, two tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/shell.svelte.ts apps/web/src/routes/+layout.svelte \
  apps/web/src/routes/gym/+page.svelte apps/web/src/features/gym/GymView.svelte \
  apps/web/src/test/SessionShellHarness.svelte apps/web/src/routes/session-shell.test.mts
git commit -m "#126: Hide the tab bar during a session"
```

---


### Task 4: Keep deep links working offline

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/sw.ts`
- Modify: `apps/web/src/pwa-manifest.mts`
- Modify: `apps/web/src/sw.test.mts`
- Modify: `apps/web/src/pwa.test.mts`

**Interfaces:**
- Consumes: the existing Workbox precache manifest and the service worker listeners.
- Produces: a `NavigationRoute` bound to `/index.html` with a denylist for `/api/`, `/health`, `/sw.js`, and `/manifest.webmanifest`; manifest `start_url: "/gym"` and `scope: "/"`; default notification URL `/gym`.

- [ ] **Step 1: Write the failing service-worker and manifest tests**

In `apps/web/src/sw.test.mts`, extend the mocks and add a test. Replace the `workbox-precaching` mock with:

```ts
const routing = vi.hoisted(() => ({
  handler: vi.fn(),
  navigation: vi.fn(),
  registerRoute: vi.fn(),
}));

vi.mock("workbox-precaching", () => ({
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
  createHandlerBoundToURL: vi.fn(() => routing.handler),
}));

vi.mock("workbox-routing", () => ({
  NavigationRoute: class {
    constructor(handler: unknown, options: unknown) {
      routing.navigation(handler, options);
    }
  },
  registerRoute: routing.registerRoute,
}));
```

Add this test inside the `describe("service worker")` block:

```ts
it("serves the app shell for navigation requests", () => {
  expect(createHandlerBoundToURL).toHaveBeenCalledWith("/index.html");
  expect(routing.navigation).toHaveBeenCalledWith(
    routing.handler,
    expect.objectContaining({
      denylist: [
        /^\/api(\/|$)/,
        /^\/health$/,
        /^\/sw\.js$/,
        /^\/manifest\.webmanifest$/,
      ],
    }),
  );
  expect(routing.registerRoute).toHaveBeenCalled();
});
```

Import `createHandlerBoundToURL` alongside the other Vitest imports:

```ts
import { createHandlerBoundToURL } from "workbox-precaching";
```

Update the default notification URL. The existing tests pass explicit URLs and stay unchanged; add this test for the fallback:

```ts
it("uses the Gym route for the default notification", () => {
  const waitUntil = vi.fn();

  pushListener({ data: null, waitUntil });

  expect(showNotification).toHaveBeenCalledWith(
    "Rest is over",
    expect.objectContaining({ data: { url: "/gym" } }),
  );
});
```

In `apps/web/src/pwa.test.mts`, add:

```ts
it("starts at the Gym route", () => {
  expect(pwaManifest.start_url).toBe("/gym");
  expect(pwaManifest.scope).toBe("/");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run --cwd apps/web test src/sw.test.mts apps/web/src/pwa.test.mts`
Expected: FAIL because there is no navigation route and no `start_url`.

- [ ] **Step 3: Implement the fallback and manifest values**

Add `"workbox-routing": "^7.4.1"` to the web dev dependencies and run `bun install`.

In `apps/web/src/sw.ts`, import and register the fallback after `precacheAndRoute`:

```ts
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [
      /^\/api(\/|$)/,
      /^\/health$/,
      /^\/sw\.js$/,
      /^\/manifest\.webmanifest$/,
    ],
  }),
);
```

Change the default notification URL in `apps/web/src/sw.ts` from `"/"` to `"/gym"`.

In `apps/web/src/pwa-manifest.mts`, add:

```ts
start_url: "/gym",
scope: "/",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run --cwd apps/web test src/sw.test.mts apps/web/src/pwa.test.mts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/sw.ts apps/web/src/pwa-manifest.mts \
  apps/web/src/sw.test.mts apps/web/src/pwa.test.mts bun.lock
git commit -m "#126: Keep deep links working offline"
```

---

### Task 5: Update the static deployment and architecture docs

**Files:**
- Modify: `apps/web/Dockerfile`
- Modify: `apps/web/nginx.conf`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: the `build/` output from Task 1.
- Produces: the nginx image serves `build/`, caches `/_app/immutable/`, and keeps the SPA fallback.

- [ ] **Step 1: Verify the build output**

Run: `bun run build`
Expected: `apps/web/build/index.html`, `apps/web/build/_app/immutable/`, `apps/web/build/sw.js`, and `apps/web/build/manifest.webmanifest` exist.

- [ ] **Step 2: Update the Dockerfile**

Change the copy line in `apps/web/Dockerfile` from `/app/apps/web/dist` to `/app/apps/web/build`.

- [ ] **Step 3: Update nginx**

In `apps/web/nginx.conf`, replace the `/assets/` location with:

```nginx
location /_app/immutable/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}
```

Keep `location /` with `try_files $uri $uri/ /index.html;` and the no-cache rules for `/index.html`, `/sw.js`, and `/manifest.webmanifest`.

- [ ] **Step 4: Update the architecture doc**

In `docs/architecture.md`:

- Section 4.1: replace "Svelte 5 with Vite" with "Svelte 5 with SvelteKit 2 as a client-rendered SPA"; delete "No server-side rendering, no SvelteKit"; add that `/gym`, `/nutrition`, and `/extractor` are routes, the layout owns the shell, and the PWA registers manually with a navigation fallback.
- Section 4.2: replace `index.html`, `main.mts`, `App.svelte`, and `App.test.mts` with `src/app.html`, `src/routes/+layout.svelte`, `src/routes/+layout.ts`, `src/routes/+page.ts`, `src/routes/gym/+page.svelte`, `src/routes/nutrition/+page.svelte`, `src/routes/extractor/+page.svelte`, and `src/lib/`.
- Section 4.3: keep the session-bar bullet, but state that the layout hides the tab bar while a session is active and that SessionView keeps its fixed session bar.

- [ ] **Step 5: Commit code and docs separately**

```bash
git add apps/web/Dockerfile apps/web/nginx.conf
git commit -m "#126: Update the web deployment for SvelteKit"

git add docs/architecture.md
git commit -m "#126: Update the web architecture docs"
```

---

### Task 6: Full verification

Local test environment for this worktree: the checkout has no `.env`, so run the API tests against a disposable Postgres. Start it once, then migrate and seed:

```bash
docker run -d --name gymos-test-126 \
  -e POSTGRES_USER=gymos -e POSTGRES_PASSWORD=gymos -e POSTGRES_DB=gymos \
  -p 55432:5432 postgres:17-alpine
DATABASE_URL='postgresql://gymos:gymos@localhost:55432/gymos?schema=public' \
  bun run --cwd apps/api db:migrate:deploy
DATABASE_URL='postgresql://gymos:gymos@localhost:55432/gymos?schema=public' \
  bun run --cwd apps/api db:seed
```

`NODE_OPTIONS=--localstorage-file` is needed on this macOS machine because Node's experimental `localStorage` shadows happy-dom's; CI does not need it.

- [ ] **Step 1: Run the project checks**

```bash
bun run typecheck
bun run lint:all
DATABASE_URL='postgresql://gymos:gymos@localhost:55432/gymos?schema=public' \
  NODE_OPTIONS='--localstorage-file=/tmp/gymos-test-localstorage' bun run test
bun run build
```

Expected: all pass. The `DATABASE_URL` and `NODE_OPTIONS` values are for the disposable local Postgres and Node's experimental localStorage on this machine; CI uses its own Postgres and does not need `NODE_OPTIONS`.

- [ ] **Step 2: Verify the built app**

```bash
test -f apps/web/build/index.html
test -f apps/web/build/sw.js
test -f apps/web/build/manifest.webmanifest
! grep -R "ZodError" apps/web/build/_app/immutable
```

Expected: the files exist and no Zod code is in the client bundle (ADR-0048).

- [ ] **Step 3: Smoke-test the static server**

```bash
bunx serve -s apps/web/build -l 4173
curl -sI http://localhost:4173/gym
curl -sI http://localhost:4173/nutrition
curl -sI http://localhost:4173/sw.js
curl -sI http://localhost:4173/manifest.webmanifest
```

Expected: `/gym` and `/nutrition` return the SPA shell, and `sw.js` and the manifest are served. The actual offline check (DevTools → offline → reload `/nutrition`) stays a manual browser step.

- [ ] **Step 4: Review the branch**

Run `git diff origin/main...HEAD` and the project review skills. Fix findings in separate `#126: Fix <target>` commits and re-run Step 1.
