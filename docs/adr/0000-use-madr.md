# Use MADR for Architecture Decision Records

## Status

Accepted

## Context

We need to record architectural decisions made in this project.
We want a lightweight, structured format that lives alongside the code.

## Decision

We will use [MADR](https://adr.github.io/madr/) (Markdown Any Decision Records) to document architecture decisions.

- ADRs are stored in `docs/adr/`
- Numbered sequentially: `NNNN-short-title.md`
- Architecture rules derived from ADRs are enforced via **oxlint** (static lint rules) and a custom **architecture checker** (structural rules). Run `bun run lint:all` to validate everything.

## Consequences

- Every significant architecture decision gets documented before or during implementation.
- Superseded ADRs are marked with status `Superseded by [NNNN]`, not deleted.
- The `lint:arch` script validates that code conforms to the rules defined in ADRs.
