# Full-Stack TypeScript with Bun Runtime

## Status

Accepted

## Context

We want a single language across the entire stack to maximize code reuse (especially types and validation schemas) and reduce context switching. We also want fast tooling for development.

## Decision

We will use **TypeScript** for all code — backend, frontend, shared packages, scripts, and infrastructure-as-code where applicable.

Runtime: **Bun** for the backend and for tooling (test runner, package manager, bundler).

TypeScript is configured in **strict mode** with additional safety flags:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `noFallthroughCasesInSwitch: true`
- `noImplicitOverride: true`
- `verbatimModuleSyntax: true`

### Rules

1. No `.js` source files in the project (except config files like `.cjs` configs).
2. All packages must extend the root `tsconfig.json` strict settings.

## Consequences

- One language to learn, one set of tooling.
- Types flow from database schema → API → frontend without code generation gaps.
- Bun provides fast startup, native TS execution, and built-in test runner.
