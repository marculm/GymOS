# MVP Constraints: Online-Only, Plain CSS, English UI

## Status

Accepted

## Context

The Gym Tracker is the first feature slice of a mobile-first personal PWA. Offline-first synchronization, a utility CSS framework, and localized UI copy are significant pieces of work that would delay the core loop: plan a workout, log sets, and see history. The existing app already used dark slate surfaces, English copy, and kilograms.

## Decision

- **Online-only data.** The API is the source of truth. The PWA shell may be cached by the service worker, but there is no IndexedDB store, background sync, or offline mutation queue. Logging a set requires connectivity.
- **Plain CSS.** Styling uses a global stylesheet with CSS custom properties and named component classes. No Tailwind, CSS-in-JS, or component library.
- **English UI and kg.** All user-facing copy is English and weights are entered and displayed in kilograms, matching the existing app and gym vocabulary.

## Consequences

- The first slice stays small and fast to load; the UI can be built and reviewed without a design-system dependency.
- Offline logging, theming beyond the CSS variables, and localization are deferred and will need their own ADRs if prioritized.
- Introducing a UI framework later requires migrating the existing class-based styles.
