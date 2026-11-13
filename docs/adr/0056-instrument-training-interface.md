# Instrument Training Interface

## Status

Accepted

## Context

ADR-0055 introduced an iOS-style gallery: a bottom tab bar, a segmented control for
Today, Plans, Workouts, and Exercises, cards for every item, and a dark session mode.
Using it showed that the home screen carried too much: the full exercise register and
plan management were always present, while the regular flow is much smaller. In the gym
the owner opens the app, starts the planned workout, logs a set, rests, and moves on.
Editing plans or exercises, changing notifications, and reading history are rare.

The owner chose direction A ("Instrument") from a rendered comparison: a dark,
full-screen training space, a light management space, no bottom bar, a gear in the
corner, and space switching by horizontal swipe. Statistics were not useful; the
workouts themselves and the "last time" values are. The timer should default to 2:30
and live in settings as well as in the workout.

This decision supersedes ADR-0036, ADR-0040, ADR-0051, and ADR-0055, and replaces the
session UI from ADR-0029 and ADR-0037.

## Decision

The app has two full-screen spaces and one management surface:

- **Training** (`/gym`) is dark and opens on the next workout, or directly into the
  active session if one exists. The start screen shows the plan name, description, and
  exercise count, a white Start button, a secondary "Other workout" action, and a
  Nutrition hint. It does not list the exercises.
- **Nutrition** (`/nutrition`) is the light counter-space. It is reached by swiping left
  outside a workout and left by swiping right. `AI Extractor` remains a deep-link route
  but is not a main space.
- **Settings** opens from a gear fixed in the top-right corner. It is a light full-screen
  sheet with grouped rows for Plans, Exercises, History, Rest timer, Notifications, and
  AI Extractor. It holds all management work; the gear is hidden during a workout.

The workout is a focus pager:

- One exercise is visible at a time. The last performance (the exercise defaults used by
  the plan) is shown above large Reps and Weight values. Values can be changed with
  steppers or by tapping the number.
- The primary action logs the set with the displayed values. The rest timer starts
  automatically at the configured default (2:30), stays fixed at the top across
  exercises, and turns green while running. Tapping it opens the presets and Stop.
- A horizontal swipe moves between the plan's exercises. Swiping to another space is
  disabled during a workout. The bottom next action is the tappable equivalent. An
  exercise switcher in the top-right lists every exercise, allows out-of-order jumps,
  and offers Finish workout for exercises that need a different order.
- Each page shows set progress and opens a sets sheet with the logged sets, where a set
  can be deleted after an inline confirmation. Finishing is available in the top-right
  and at the end of the last page.
- Free workouts use the same pager; the switcher also adds exercises.

The visual system keeps the tokens from ADR-0055 but reverses the default: the root is
the dark training theme, and a `.light-space` scope defines the light palette for
Nutrition and Settings. The PWA theme color and background are black. Labels and focus
states meet WCAG AA in both scopes; the theme test covers both.

Progress charts and the progress UI are removed. History remains in Settings with filters,
pagination, and the inline set edit; the backend progress endpoint remains available but
is not surfaced. The bottom tab bar, large-title gallery, PageHeader, and the old
GymView/Progress/TabBar/shell components are removed.

## Consequences

- The home is only the next workout. Plans, exercises, notifications, timer defaults,
  history, and the extractor are discoverable through the gear, not through tabs.
- Gestures never stand alone: every swipe has a tappable fallback (Nutrition hint, Next,
  exercise switcher, gear). Space switching is unavailable inside a workout.
- The workout keeps its context in the top bar; the exercise name and values change
  inside the pager. The timer persists across exercise pages and reloads.
- The management UI is the existing grouped-list/form system moved into Settings. Plan and
  exercise CRUD, rotation reordering, history, and the form validation behavior remain.
- The API is unchanged. The web progress client is removed; the backend endpoint and its
  tests stay.
- A future statistics UI, a third space, or a different gesture model needs a new ADR.
