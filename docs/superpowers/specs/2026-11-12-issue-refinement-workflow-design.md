# Issue Refinement Workflow Design

**Date:** 2026-11-12
**Status:** Approved for implementation planning

## Context

Issues start as rough ideas. The work needed to make them implementable is manual:
filling in scope and acceptance criteria, choosing labels and priority, and placing
the issue in the execution order of the roadmap (`#32`). The repository already runs
Claude Code inside GitHub Actions for implementation
(`.github/workflows/claude-issue.yml`, triggered by the `auto-implement` label) with
a DeepSeek endpoint and a PAT in `CLAUDE_GH_TOKEN`. Priority lives in GitHub Project 1
(`P0`–`P2`); epics are manual checklists inside issue bodies.

The user wants the refinement step automated without the agent inventing requirements:
missing information becomes numbered questions in the issue, which the user answers
in the issue before the next run.

## Goal

Labeling an issue with `refine` makes an agent turn the idea into a ready-to-implement
ticket:

- structured issue body with the original idea preserved,
- labels and `Priority` set,
- the issue inserted into the roadmap `#32` in execution order,
- numbered questions instead of assumptions when information is missing.

Success: after zero or more answer rounds, the issue is self-contained and appears in
the roadmap at the position the user should work on next. No silent assumptions.

## Non-goals

- Maintaining epic checklists, issue `Size` or project `Status`.
- Setting `auto-implement` or otherwise starting implementation.
- Triggering refinement from comments without the `refine` label.
- Removing closed issues from the roadmap (stays manual).
- Any application code change.

## Decision

Use approach A: a dedicated workflow that runs the Claude Code CLI with the existing
DeepSeek configuration and performs every GitHub mutation through `gh`.

Rejected alternatives:

- **Official `anthropics/claude-code-action`** — less YAML, but assumes the Anthropic
  API; compatibility with the DeepSeek endpoint would have to be proven first. Not
  worth a new dependency.
- **Agent proposes, a script mutates project and roadmap** — more reliable mutations,
  but adds a script with tests and duplicates the agent's reasoning. Revisit only if
  approach A proves unreliable in practice.

## Components

### Workflow: `.github/workflows/refine-issue.yml`

- Trigger: `issues: labeled`; job condition requires label `refine`, an open issue,
  and no pull request.
- Concurrency: one repository-wide group `refine-issue` with
  `cancel-in-progress: false`, so two runs cannot rewrite roadmap `#32` concurrently.
- Steps:
  1. Checkout read-only (gives the agent code context).
  2. Setup Node 22 and install the Claude Code CLI.
  3. Run `claude -p --dangerously-skip-permissions` with a prompt that reads
     `docs/issue-refinement.md` and the issue, then performs the refinement.
  4. `if: always()` — remove the `refine` label so the user can re-trigger the run.
- No Bun, database, or test setup: refinement builds nothing.
- Timeout: 30 minutes.
- Environment: the same `ANTHROPIC_*` values as `claude-issue.yml`, plus
  `GH_TOKEN=${{ secrets.CLAUDE_GH_TOKEN }}` and `ISSUE_NUMBER`.
- Token capabilities: `issues: write` and `projects: write`, `contents: read`.
  Missing scopes must fail the job with the `gh` error; the prompt must not swallow it.

### Rulebook: `docs/issue-refinement.md`

A checked-in document the agent reads on every run, so the rules change without a
workflow edit.

**Inputs.** The agent reads the issue title, body, labels, and all comments through
`gh`. Comments written by the repository owner (`marculm`) after the agent's last
summary comment are treated as answers; the agent's own comments and bot comments are
ignored.

**Definition of Ready.** The body must contain: context, goal, scope (in/out),
acceptance criteria, dependencies, affected areas, and test approach. Missing or
ambiguous items become questions.

**Body format.** A single structured template. The user's original text is preserved
verbatim inside `<details><summary>Original idea</summary>…</details>`. Answers from
later rounds are folded into the structured sections; the question comments stay in
the history.

**Labels.** Choose from the existing labels (`bug`, `enhancement`, `tech-debt`,
`security`, `documentation`, `accessibility`). Never add `auto-implement` (it starts
implementation), `epic`, or `refine`.

**Project 1.** Add the issue if it is not already there and set `Priority` to `P0`,
`P1`, or `P2`. A provisional priority is allowed only when the summary comment states
that it is provisional and why. `Size` and `Status` are not touched.

**Roadmap `#32`.** Insert the issue into the `Implementation order` table sorted by
priority first, then by dependencies; write the reason or dependency in the `Note`
column and extend the `Dependencies` section when needed. Only these two sections may
change; the rest of the body stays byte-for-byte identical.

**Questions.** When information is missing, post exactly one comment per run that
contains the summary of changes and a numbered list of questions, plus the answer
format (`1) … 2) …`) and the instruction to set `refine` again afterwards. Never
guess and never invent requirements.

## Answer Loop

1. Owner adds `refine`.
2. Agent refines the issue, posts one summary comment (with questions if needed),
   and removes `refine`.
3. Owner answers with a numbered comment and adds `refine` again.
4. Agent incorporates the answers, updates body, labels, priority, and roadmap, and
   summarizes the changes.
5. Repeat until no questions remain.

## Failure Handling

- The `refine` label is removed even when the job fails, so the owner can retry.
- `gh` failures fail the job; they are not converted into a success message.
- Concurrency prevents parallel roadmap edits.
- An agent run that posts no summary comment is a failed run; the owner sees the red
  job and can retry.

## Testing

- Manual dry run on a scratch issue: add `refine`, verify body, labels, priority, and
  roadmap placement; then answer a question and re-run; verify the answer was folded
  in and no assumptions were left.
- Verify the label is removed after both a successful and a failed run.
- No application checks change (`bun run typecheck`, `lint:all`, `test` stay green).

## Documentation

- ADR-0052 records this decision in MADR format.
- `docs/issue-refinement.md` is the operational rulebook referenced by the workflow.

## Risks

- The agent edits roadmap `#32` free-form. Mitigated by concurrency, a byte-stable
  edit rule, and a manual dry run; revisit approach C if it corrupts the table.
- Events caused by `CLAUDE_GH_TOKEN` trigger workflows. Guards on the label name keep
  the workflows apart; the rulebook forbids adding `auto-implement`.
- Issue text is untrusted input to the agent, but the repository and its issues are
  owner-controlled.
