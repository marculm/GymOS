# Warm Light UI Theme

## Status

Accepted

## Context

The web UI used a dark navy palette: a `#0f172a` background, slate surfaces, and a
blue `#3b82f6` accent for actions, focus, and active tabs. The owner wants a warm,
light, clean look instead. The theme is light mode only, has no colored accent, and
uses warm whites and greys with near-black text. WCAG AA contrast and the existing
mobile-first layout must be preserved. ADR-0012 keeps styling in plain CSS with
custom properties; this decision changes the palette values, not the styling
mechanism.

## Decision

The app has a single warm light theme defined by the CSS custom properties in
`apps/web/src/styles.css`:

- `--bg` is warm white (`#faf7f2`), with layered warm grey surfaces `--surface`
  (`#f3ede4`) and `--surface-2` (`#e5ddd1`).
- `--text` is near-black (`#1f1b16`) and `--muted` is warm grey (`#5f574c`). Both meet
  WCAG AA on every background and surface.
- Hierarchy and actions use near-black greys. `--accent` is near-black (`#1f1b16`) and
  drives focus outlines, active tabs, plan markers, and primary buttons (white text on
  near-black, `--accent-strong` for hover). There is no colored brand accent.
- `--danger` remains a warm red (`#9c2f21`) only for semantic error states, not as an
  accent.
- `color-scheme: light`; there is no dark mode.
- `meta[name=theme-color]` in `apps/web/index.html` and the PWA manifest
  `theme_color` and `background_color` in `apps/web/vite.config.ts` use the warm white
  background.

## Consequences

- All screens use the warm light palette. Components keep using the existing named
  classes and CSS variables; no component markup or layout changes are required.
- A dark mode or a user-selectable theme needs a new ADR.
- Raw colors stay centralized in the variables, so a future palette change is a
  one-file edit plus the PWA metadata.
- The blue/navy palette is removed from the stylesheet, HTML, and PWA manifest.
