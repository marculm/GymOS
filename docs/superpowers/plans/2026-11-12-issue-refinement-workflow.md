# Issue Refinement Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Labeling a GitHub issue with `refine` runs an agent that turns the idea into a ready-to-implement ticket, sets labels and priority, places it in roadmap #32, and asks numbered questions instead of guessing.

**Architecture:** One new GitHub Actions workflow reuses the existing Claude Code + DeepSeek setup and mutates GitHub through `gh`. A checked-in rulebook (`docs/issue-refinement.md`) carries the refinement contract. The label is removed after every run so the owner re-adds it to continue the answer loop. ADR-0052 records the decision.

**Tech Stack:** GitHub Actions, Claude Code CLI, `gh`, DeepSeek endpoint (same env as `.github/workflows/claude-issue.yml`), MADR for the ADR.

**Spec:** `docs/superpowers/specs/2026-11-12-issue-refinement-workflow-design.md`

## Global Constraints

- Never read, write, or inspect `.env` files; only `CLAUDE_GH_TOKEN` / `DEEPSEEK_API_KEY` secrets are used, and they are never printed.
- Do not push or merge. The dry run in Task 4 is human-gated: it starts after the owner puts the workflow on `main`.
- Label `refine` only triggers this workflow. The agent must never add `auto-implement` (it would start implementation) or `epic`.
- Commits are short, imperative, English, and start with `Add` (AGENTS.md).
- The rulebook is the agent's contract; keep it free of placeholders.
- `bun run lint:adr` must pass after Task 3.
- The full check suite (`bun run typecheck`, `bun run lint:all`, `bun run test`) must pass at the end. Tests may need `--env-file=.env` or an inline `DATABASE_URL`.

## Review Focus

1. **Second `refine` run while one is active** — the second run must queue, never rewrite roadmap #32 concurrently.
2. **Agent crash or no-op** — the label must still be removed, the job must be red, and a retry must be possible.
3. **Vague issue** — the agent asks questions and flags a provisional priority instead of inventing scope.
4. **Answer round** — free-form answers are folded in; the roadmap row is updated in place, not duplicated.
5. **No accidental implementation** — no `auto-implement` label is added, and removing `refine` does not retrigger this workflow.

## Task 1: Rulebook `docs/issue-refinement.md`

**Files:**
- Create: `docs/issue-refinement.md`

**Interfaces:**
- Produces: the headings and rules read by the Task 2 prompt. Task 4 checks the agent's behavior against this document.

- [ ] **Step 1: Write the rulebook with exactly these sections and rules**

```markdown
# Issue Refinement Rulebook

You refine GitHub issues. Never invent requirements: ask.

## Inputs

- Read the issue title, body, labels, and all comments with `gh issue view`.
- Comments written by `marculm` after your most recent summary comment are answers to
  your previous questions. Ignore your own comments and other bot comments.
- The issue number is in the `ISSUE_NUMBER` environment variable.

## Definition of Ready

The body must contain: context, goal, scope (in/out), acceptance criteria,
dependencies, affected areas, and test approach. Anything missing or ambiguous becomes
a question.

## Body

Use this order:

1. `## Context`
2. `## Goal`
3. `## Scope` with `### In` and `### Out`
4. `## Acceptance criteria` as `- [ ]` items
5. `## Dependencies`
6. `## Affected areas`
7. `## Test approach`
8. `<details><summary>Original idea</summary>` with the issue text from before the
   first refinement run, verbatim.

On later runs, fold answers into the sections above and leave the `Original idea` block
unchanged.

## Labels

- Use existing labels only. Pick at most one type label that fits (`bug`,
  `enhancement`, `tech-debt`, `security`, `documentation`, `accessibility`).
- Never add `auto-implement`, `epic`, or `refine`.

## Project 1

- Add the issue to project 1 if it is not already there.
- Set `Priority` to `P0`, `P1`, or `P2`. If the priority is uncertain, set a
  provisional priority and say so with the reason in the summary comment.
- Do not touch `Size` or `Status`.

## Roadmap #32

- Add one row to the `## Implementation order` table, or update the existing row for
  this issue in place; never duplicate it.
- Renumber the first column from 1 after inserting.
- Order: priority first (`P0`, then `P1`, then `P2`), then dependencies (an issue
  another depends on comes earlier). Keep the existing relative order on ties.
- `Note` column: priority plus any dependency, e.g. `P2; depends on #4`.
- Extend `## Dependencies` when this issue adds one.
- Change only the `## Implementation order` and `## Dependencies` sections; leave the
  rest of the body byte-for-byte identical.

## Questions and summary

- Post exactly one comment per run.
- It contains: what changed (body, labels, priority and reason, roadmap position) and,
  if information is missing, a numbered question list.
- End question lists with: answer as a comment using `1) … 2) …`, then add the `refine`
  label again.
- If no questions remain, say that the issue is ready.
- Remove the `refine` label as your final action.

## Never

- Never guess or invent requirements, acceptance criteria, or dependencies.
- Never add `auto-implement` or `epic`.
- Never set `Size` or `Status`, edit epics, or close the issue.
- Never read or write `.env` files.
```

- [ ] **Step 2: Verify the document contains every section**

Run: `grep -n "^## " docs/issue-refinement.md`
Expected: `## Inputs`, `## Definition of Ready`, `## Body`, `## Labels`, `## Project 1`, `## Roadmap #32`, `## Questions and summary`, `## Never`.

- [ ] **Step 3: Commit**

```bash
git add docs/issue-refinement.md
git commit -m "Add issue refinement rulebook"
```

## Task 2: Workflow `.github/workflows/refine-issue.yml`

**Files:**
- Create: `.github/workflows/refine-issue.yml`

**Interfaces:**
- Consumes: `docs/issue-refinement.md` from Task 1.
- Produces: workflow named `Refine Issue`, triggered by label `refine`, for Task 4's dry run.

- [ ] **Step 1: Write the workflow**

```yaml
name: "Refine Issue"

on:
  issues:
    types: [labeled]

concurrency:
  group: refine-issue
  cancel-in-progress: false

jobs:
  refine:
    if: >-
      github.event.label.name == 'refine' &&
      github.event.issue.state == 'open' &&
      github.event.issue.pull_request == null
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    permissions:
      contents: read
    env:
      GH_TOKEN: ${{ secrets.CLAUDE_GH_TOKEN }}
      ISSUE_NUMBER: ${{ github.event.issue.number }}
      ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic"
      ANTHROPIC_AUTH_TOKEN: ${{ secrets.DEEPSEEK_API_KEY }}
      ANTHROPIC_MODEL: "deepseek-flash[1m]"
      ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-flash[1m]"
      ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-flash[1m]"
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-flash"
      CLAUDE_CODE_SUBAGENT_MODEL: "deepseek-flash"
      CLAUDE_CODE_EFFORT_LEVEL: "max"
      CLAUDE_CODE_AUTO_COMPACT_WINDOW: "786432"

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          token: ${{ secrets.CLAUDE_GH_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Run Claude Code
        run: |
          PROMPT="Refine GitHub issue #$ISSUE_NUMBER in this repository. Follow docs/issue-refinement.md exactly.

          - Read the issue, its labels, and all comments with gh. Treat comments written by marculm after your last summary comment as answers to your previous questions. Ignore your own comments.
          - Update the issue body, labels, project priority, and roadmap issue #32 as the rulebook describes.
          - Never guess and never invent requirements. If information is missing, ask numbered questions.
          - Post exactly one comment per run: the summary of changes plus any numbered questions and how to answer them.
          - Remove the refine label as your final action. Never add auto-implement, epic, Size, or Status."
          claude -p --dangerously-skip-permissions "$PROMPT"

      - name: Remove refine label
        if: always()
        run: gh issue edit "$ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --remove-label refine 2>/dev/null || true
```

- [ ] **Step 2: Verify the YAML parses**

Run: `ruby -ryaml -e 'YAML.load_file(ARGV[0])' .github/workflows/refine-issue.yml`
Expected: exit 0, no output. (`ruby` is available at `/usr/bin/ruby`.)

- [ ] **Step 3: Verify the trigger guards are present**

Run: `grep -n "label.name == 'refine'\|pull_request == null\|cancel-in-progress" .github/workflows/refine-issue.yml`
Expected: three matching lines.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/refine-issue.yml
git commit -m "Add refine issue workflow"
```

## Task 3: ADR-0052

**Files:**
- Create: `docs/adr/0052-issue-refinement-workflow.md`

**Interfaces:**
- Consumes: the decision approved in the spec. No code depends on it.

- [ ] **Step 1: Write the ADR**

Title: `# Issue Refinement Workflow`

Required sections, each filled:

- `## Status` — `Accepted`
- `## Context` — rough issues; manual refinement of scope, labels, priority, roadmap
  placement; existing Claude Code + DeepSeek workflow (`claude-issue.yml`); Priority in
  Project 1; roadmap #32 as the execution order; manual epic checklists.
- `## Decision` — label `refine` triggers `refine-issue.yml`; the agent reads
  `docs/issue-refinement.md`, rewrites the body with the original preserved, sets
  labels and `Priority`, updates roadmap #32, and posts numbered questions instead of
  assuming; the owner answers in the issue and re-adds `refine`; the label is removed
  after every run; epics, `Size`, `Status`, and `auto-implement` stay untouched.
- `## Consequences` — tickets arrive implementation-ready; the roadmap stays ordered
  without manual sorting; each run costs tokens and needs a PAT with issue and project
  write access; the answer loop is manual by design; the agent edits roadmap #32
  free-form, so a corrupting run means switching to a deterministic mutation script
  (approach C in the spec); no application code changes.

- [ ] **Step 2: Run the ADR linter**

Run: `bun run lint:adr`
Expected: PASS with ADR-0052 listed, no violations.

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0052-issue-refinement-workflow.md
git commit -m "Add ADR-0052 issue refinement workflow"
```

## Task 4: Label and human-gated dry run

**Files:** none.

**Interfaces:**
- Consumes: Tasks 1–3 on `main`.
- Produces: verified end-to-end behavior; no code artifact.

- [ ] **Step 1: Create the label**

Run: `gh label create refine --repo marculm/GymOS --description "Run the issue refinement agent" --color 0e8a16`
Expected: `label refine created`. If it exists, skip.

- [ ] **Step 2: Hand off to the owner**

The owner must push/merge Tasks 1–3 to `main` because `issues` workflows run from the
default branch. Do not push. Wait for the owner's confirmation.

- [ ] **Step 3: Dry run on a scratch issue**

Create a deliberately vague issue (e.g. "Improve the history page"). Add the `refine`
label. Watch the run:

```bash
gh run list --workflow=refine-issue.yml --limit 3
```

Expected after success:
- exactly one new summary comment,
- body uses the template with the original idea inside `<details>`,
- one fitting type label and no `auto-implement`/`epic`,
- `Priority` set in Project 1 (provisional is allowed if stated),
- one new row in roadmap #32 at a priority/dependency-correct position,
- `refine` label removed.

- [ ] **Step 4: Verify the answer loop**

Answer the numbered questions with a free-form comment (not numbered) and add
`refine` again. Expected: answers are folded into the body, the roadmap row is updated
in place without a duplicate, a new summary comment appears, and `refine` is removed.

- [ ] **Step 5: Verify the guards**

- Re-add `refine` twice while a run is active: the second run waits (concurrency
  group), it does not run in parallel.
- Confirm no `auto-implement` label was added and the implementation workflow did not
  start (check `gh run list --workflow=claude-issue.yml`).
- Confirm the `if: always()` cleanup step exists in the workflow; a live failure-path
  test is not required.

- [ ] **Step 6: Clean up and run the full checks**

Remove the scratch issue's roadmap row and Project 1 item, then close the scratch
issue. Run:

```bash
bun run typecheck
bun run lint:all
bun run test
```

Expected: all pass. If tests need the database URL, run with `--env-file=.env` or an
inline `DATABASE_URL` as in the repo's CI.
