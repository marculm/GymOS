---
name: issue-to-pr
description: Use when the user names a GymOS GitHub issue to implement (e.g. "nimm #25", "start issue 25", "arbeite an Issue #25").
---

# Issue to PR

One named issue → isolated worktree → docs/ADR → implementation → review → PR → cleanup.

**REQUIRED SUB-SKILL:** superpowers:using-git-worktrees
**REQUIRED SUB-SKILL:** superpowers:test-driven-development

## 1. Read the issue

```bash
gh issue view <N> --json number,title,body,labels,state,url
```

- Closed or already being worked on → stop and ask.
- Open assumptions or missing decisions → ask the user, then continue.
- Slug: 2–3 kebab-case words from the title, e.g. `25-inline-set-logging`.

## 2. Worktree and branch

Base is always `origin/main` (user decision 2026-10-29).

```bash
git fetch origin
git rev-list --count origin/main..HEAD   # > 0 → warn: the issue branch will miss these commits
```

Warn and confirm before continuing if the current branch is ahead of `origin/main`.

Then create the worktree with `EnterWorktree`:

```
EnterWorktree(name: "feature/<N>-<slug>")
```

Run `bun install`. Confirm `git branch --show-current` is `feature/<N>-<slug>`; if not, rename it with `git branch -m feature/<N>-<slug>`.

Already inside a worktree → stop and ask; do not nest worktrees.

## 3. Project: In Progress

```bash
ITEM=$(gh project item-list 1 --owner marculm --format json --limit 200 \
  | jq -r '.items[] | select(.content.number==<N>) | .id')
if [ -z "$ITEM" ]; then
  gh project item-add 1 --owner marculm --url <issue-url>
  ITEM=$(gh project item-list 1 --owner marculm --format json --limit 200 \
    | jq -r '.items[] | select(.content.number==<N>) | .id')
fi
gh project item-edit --project-id PVT_kwHOEAw6oM4BpWhe --id "$ITEM" \
  --field-id PVTSSF_lAHOEAw6oM4BpWhezhnyjDk --single-select-option-id 47fc9ee4
```

## 4. Docs and ADR first

Check before coding:

- `docs/known-issues.md` — does this issue resolve a listed known issue? Update it.
- `docs/architecture.md`, `README.md` — API, commands or behavior changed? Update them.
- `docs/adr/` — architectural, infrastructural or design decision? Add a MADR ADR (`Status`, `Context`, `Decision`, `Consequences`) with a number that is free in `origin/main` and in every open PR, then run `bun run lint:adr`. Step 8 rechecks this before the PR.

Commit docs separately: `Add ADR-0020 Workout rotation`, `Update known issues`.

## 5. Implement

- Test first; follow `superpowers:test-driven-development`.
- Bun, Vitest, Pino, shared schemas; keep comments sparse.
- Never read or edit `.env` files.

### Commit slicing

Each commit must be understandable alone on a phone in about two minutes.

- Slice by observable behavior, not by file type or review round. One commit changes one behavior and contains the test that proves it.
- Never create an `Add <feature> tests` commit for behavior introduced in the same PR. A test-only commit is only for covering behavior that already exists.
- Before editing, state the planned slices as behavior steps, e.g. "a swipe hides the set" → "undo restores it" → "the delayed delete runs" → "a failure restores it" → "finish and unmount flush". Implement one slice end to end, commit, repeat.
- Target one behavior per commit: up to ~80 changed lines and 1–3 files. Above ~100 lines, split the behavior into smaller observable steps; never split code from its test to get under the limit.
- Bad: one `Add <feature>` code commit plus one `Add <feature> tests` commit. Good: `Delete a set on a swipe` (code+test), then `Add the undo window` (code+test).
- Each commit leaves the suite green and reads as one sentence. If the subject needs "and", it is two slices.
- Keep separate: docs/ADR (step 4), pure refactors/renames/formatting, dependency bumps.
- Review fixes: one commit per finding, with the test that proves the fix.
- If a commit grew too large, `git reset --soft HEAD~1` and re-commit in behavior slices before pushing.
- Messages: `#<N>: <verb> <target>` with `Add|Update|Remove|Move|Fix`, e.g. `#<N>: Add set limit guard`. No attribution trailer.

## 6. Verify

```bash
bun run typecheck
bun run lint:all
bun run test
```

Run `bun run build` if `apps/web` changed. Do not continue on failures.

## 7. Review and fix

- `superpowers:requesting-code-review`
- `ponytail:ponytail-review` on `git diff origin/main...HEAD`
- Fix findings, re-run step 6, and commit each finding separately as `#<N>: Fix <target>`; do not bundle unrelated fixes.

## 8. Push and PR

### Pre-PR preflight

Run this after review and before pushing. It catches work that would collide with an open PR; it cannot see a PR that another agent opens at the same moment.

```bash
git fetch origin
git rebase origin/main        # already pushed? use `git merge origin/main`; never force-push
bun run lint:adr
git diff --name-only origin/main...HEAD

gh pr list --state open --json number,title,files \
  --jq '.[] | "#\(.number) \(.title): \([.files[].path] | join(", "))"'
```

Stop and fix before opening the PR when:
- the rebase conflicts;
- an open PR already uses the same `NNNN` ADR number → renumber yours and rerun `bun run lint:adr`;
- an open PR also changes `docs/known-issues.md` → coordinate with the user and do not open a competing PR;
- an open PR touches the same source files and the change looks conflict-prone → report it and ask before opening;
- checks fail after the rebase.

Overlapping files are not automatically a conflict, but report them. Never reuse an ADR number from `origin/main` or an open PR.

AGENTS.md allows pushing only inside this workflow.

```bash
git push -u origin feature/<N>-<slug>
gh pr create --base main --head feature/<N>-<slug> \
  --title "<imperative verb> <target>" \
  --body "<2–4 bullets: what changed, why, checks run>

Closes #<N>"
```

`Closes #<N>` belongs in the PR body, not the title. The branch name alone links nothing; the issue closes only when the PR is merged into `main`. An issue ID in a commit is just a cross-reference.

Keep the PR body short. If push or PR creation fails, stop and report; never force-push.

## 9. Project: In Review

Opening the PR may move the item automatically. Check the status; if it is still `In progress`, set `In review`:

```bash
gh project item-list 1 --owner marculm --format json --limit 200 \
  | jq -r '.items[] | select(.content.number==<N>) | .status'

gh project item-edit --project-id PVT_kwHOEAw6oM4BpWhe --id "$ITEM" \
  --field-id PVTSSF_lAHOEAw6oM4BpWhezhnyjDk --single-select-option-id df73e18b
```

The issue closes on merge. The project item moves to `Done` only if the project workflow "Item closed → Done" is enabled; otherwise set it manually with option `98236657`.

## 10. Remove the worktree

Once the PR exists, the worktree is disposable. Prove nothing is left behind, then exit and remove it:

```bash
git status --short                                 # must be empty
git log --oneline origin/feature/<N>-<slug>..HEAD  # must be empty
```

```
ExitWorktree(action: "remove", discard_changes: true)
```

This deletes the worktree and the local branch; the branch stays on `origin` and in the PR. `discard_changes` only skips the commits the two checks above proved are pushed — if either check is non-empty, stop instead.

## Quick reference

| Field | ID |
| :-- | :-- |
| Project | `PVT_kwHOEAw6oM4BpWhe` |
| Status field | `PVTSSF_lAHOEAw6oM4BpWhezhnyjDk` |
| In progress | `47fc9ee4` |
| In review | `df73e18b` |
| Done | `98236657` |

## Stop conditions

- Issue closed or already being worked on → ask.
- Current branch ahead of `origin/main` → warn, confirm.
- Tests fail before or after the change → report, do not open the PR.
- Open PR uses the same ADR number or also edits `docs/known-issues.md` → stop and coordinate.
- Worktree not clean or commits not pushed at cleanup → stop, do not remove it.
- `.env` involved → stop.
