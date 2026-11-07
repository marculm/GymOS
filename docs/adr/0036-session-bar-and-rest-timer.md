# Session Bar and Rest Timer

## Status

Accepted

## Context

During an active workout the main tab bar (Gym, Nutrition, AI Extractor) stays visible
while the Finish workout action scrolls away with the session header. The user wants
workout controls always reachable and a timer for rest between sets (#54). Nutrition and
the extractor are still `501` stubs, so leaving the Gym tab during a workout has no
benefit and risks losing the only path back to Finish.

## Decision

- While a session is active, the main tab bar is hidden and replaced by a fixed session
  bar at the bottom. It uses the same width, surface, border, and
  `env(safe-area-inset-bottom)` handling as the tab bar, so the Nutrition and AI Extractor
  tabs are unreachable until the session ends.
- The session bar holds Finish workout, moved out of the session header, and the rest
  timer. Finish keeps its pending state, `role="alert"` errors, and focus return after a
  failed completion; the error renders in the bar next to the action.
- The content keeps its reserved bottom padding (92px plus the safe-area inset), which is
  larger than both fixed bars, so the bar never covers the last card.
- Rest timer presets are 120, 150, and 180 seconds. The selected preset is stored in
  `localStorage` (`gymos.restTimerSeconds`) and validated against the presets on load;
  unreadable storage falls back to 120 seconds.
- A running countdown stores its end timestamp in `localStorage`
  (`gymos.restTimerEndsAt`). On load the remaining time is recomputed from that
  timestamp and the countdown resumes if the end is still in the future; an expired or
  missing timestamp shows `0:00`. Starting, restarting after a logged set, or changing
  the preset stores a new end timestamp; stopping removes it.
- Logging a set successfully starts or restarts the countdown. Tapping the timer reveals
  the presets and a Stop/Reset control. The countdown stays visible in the bar and never
  plays a sound, vibrates, or sends a notification.
- Timer state is client-only; the preset and the end timestamp survive reloads through
  `localStorage`. No API or shared contract changes.

## Consequences

- Finish workout and the countdown are reachable without scrolling in every session
  state.
- Users cannot switch to Nutrition or the extractor during a workout; finishing restores
  the main tabs.
- The timer is a view concern in `SessionView`; no API or shared contract changes.
- After load the countdown ticks locally, so a backgrounded or suspended PWA can fall
  behind the stored end timestamp.
