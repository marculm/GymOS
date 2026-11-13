# iOS-Inspired Design System

## Status

Superseded by ADR-0056

## Context

The SvelteKit shell is in place (ADR-0054), but the visual language still comes from
ADR-0020: a warm cream palette, near-black actions, and one card style for every
surface. The owner asked for an extremely clean, thoughtful Apple-style design. The app
is a single-user, mobile-first PWA used one-handed in the gym, where the next workout,
the current set, and the rest timer must be readable at a glance.

Constraints stay the same: plain CSS with custom properties (ADR-0012), light mode only,
WCAG AA contrast, and the existing component behavior, roles, and accessible names.
This decision replaces the palette, typography, and surface hierarchy; it does not
change product flows.

## Decision

The web app uses one light theme defined by the custom properties in
`apps/web/src/styles.css`:

- `--bg` is the cool system grey `#f2f2f7`, with white `--surface` groups and
  `#e5e5ea` secondary fills. `--text` is `#1c1c1e`, `--muted` is `#5a5a5f`, and
  `--separator` is the hairline `#d1d1d6`.
- `--graphite` (`#1c1c1e`) is the single bold surface: it carries the next workout and
  the active session header. Everything around it stays quiet and white.
- `--accent` is the system-like blue `#0066cc` and marks primary actions, active tabs,
  focus, links, and progress. `--danger` (`#d70015`) stays semantic only.
- `--border` (`#6c6c70`) keeps the 3:1 non-text contrast required for form controls.
- Typography uses the platform system stack. The rest timer and numeric values use
  `ui-rounded` where the platform provides SF Rounded. The type ramp follows iOS:
  large titles, 17px body, 15px subheads, 13px labels, 12px badges. Labels are sentence
  case; small uppercase labels are limited to the "Next workout" hero eyebrow and the
  month in the history date tile.
- Layout is a 560px column. Each route owns a large title instead of a global brand
  header. When the title scrolls away, a compact translucent bar takes its place.
  Content uses grouped inset lists: one white rounded group per section, hairline
  separators, 56px rows, and flat text or icon actions instead of a card per item. The
  gym uses an iOS segmented control whose first tab, Today, holds the next workout.
  Plans, Workouts, and Exercises are secondary tabs, so the exercise library never
  appears on the home screen. The tab bar is translucent and blurred; the workout
  picker is a bottom sheet with a grabber.
- Management forms use iOS settings rows: the label on the left, the value
  right-aligned on the right, hairline separators, and an inline focus tint instead of
  boxed inputs. Longer text uses an inset block below its label. The primary action is
  a full-width button; Cancel is a plain text button. These rules apply to the forms
  in the library and plan editor, not to the set logging form inside an active
  session.
- An active workout switches to a dark focus mode, like a workout player. The
  `.session-mode` wrapper redefines the same tokens (black background, `#1c1c1e`
  groups, light text, `#0a84ff` links) and sets `color-scheme: dark` for its subtree.
  This is a state of the single light theme, not a user-selectable dark theme. The
  theme test checks the session tokens for WCAG AA contrast.
- Motion is limited to button press scale, the exercise disclosure chevron, the
  compact bar transition, and the sheet entrance. `prefers-reduced-motion` disables
  all of it.
- Outside the session focus mode, `color-scheme: light`. `meta[name=theme-color]` in
  `apps/web/src/app.html` and the PWA manifest `theme_color` and `background_color`
  use `--bg`.

## Consequences

- ADR-0020 is superseded. The warm palette and the "no colored accent" rule no longer
  apply; the blue accent returns as a semantic action color.
- Screens are structured as grouped lists instead of independent cards. Behavior,
  roles, and accessible names stay unchanged, so the interaction model and its tests
  remain valid; the markup changes are layout and styling.
- The session focus mode is deliberately scoped to the active workout. It must not
  leak into the gym gallery, history, or forms outside a session.
- Raw colors stay centralized in the variables; changing the palette is a one-file edit
  plus the PWA metadata and the session token block.
- A user-selectable dark mode for the rest of the app needs a new ADR.
