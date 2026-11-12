# Issue Refinement Workflow

## Status

Accepted

## Context

Issues start as rough ideas. Making them implementable is manual work: filling in
scope and acceptance criteria, choosing labels and priority, and placing the issue in
the execution order of roadmap #32. The repository already runs Claude Code inside
GitHub Actions for implementation (`claude-issue.yml`, triggered by the
`auto-implement` label) with a DeepSeek endpoint and a PAT in `CLAUDE_GH_TOKEN`.
Priority lives in GitHub Project 1 (`P0`–`P2`); epics are manual checklists inside
issue bodies.

Refinement must not invent requirements. Missing information has to become questions
that the owner answers in the issue before the next run.

## Decision

- The label `refine` triggers a new workflow (`refine-issue.yml`) that runs the same
  Claude Code and DeepSeek setup and mutates GitHub through `gh`.
- A checked-in rulebook (`docs/issue-refinement.md`) defines the contract: definition
  of ready, body template with the original idea preserved verbatim, labels, project
  priority, roadmap placement, and the question format.
- The agent rewrites the issue body, chooses existing labels, sets `Priority`, and
  inserts or updates one row in roadmap #32 ordered by priority then dependencies.
- Missing or ambiguous information becomes numbered questions in exactly one summary
  comment per run. The owner answers in a comment and re-adds `refine` to continue.
- The `refine` label is removed after every run, including failures, so a retry needs
  no manual cleanup.
- Epics, `Size`, `Status`, and `auto-implement` stay untouched. Adding
  `auto-implement` would start implementation and is forbidden.

## Consequences

- Issues arrive implementation-ready and the roadmap stays ordered without manual
  sorting.
- Each run costs tokens and requires the PAT to allow issue and project writes.
- The answer loop is manual by design: no comment-triggered runs and no `needs-info`
  state.
- The agent edits roadmap #32 free-form. A corrupting run means replacing that step
  with a deterministic mutation script.
- No application code, API, or schema changes.
