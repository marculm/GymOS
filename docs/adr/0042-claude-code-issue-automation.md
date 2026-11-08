# Claude Code Issue Implementation on GitHub Runners

## Status

Accepted

## Context

Issues labeled `auto-implement` should be implemented by Claude Code on a GitHub runner. The
local workflow depends on AGENTS.md, the `issue-to-pr` skill, and the user-installed
`superpowers` and `ponytail` plugins; a runner starts without any of that user configuration.
The repository checks need Bun, a generated Prisma client, and Postgres, and the
implementation must push a branch and open a PR.

## Decision

- `.github/workflows/claude-issue.yml` runs on `issues: labeled` for `auto-implement` and
  uses the Claude Code CLI against the DeepSeek Anthropic-compatible endpoint.
- Before Claude starts, the job installs Bun, Node, `superpowers` from the official
  `anthropics/claude-plugins-official` marketplace, and `ponytail` from
  `DietrichGebert/ponytail`.
- The job mirrors the CI setup: Postgres 17 service, `DATABASE_URL`, Prisma
  generate/migrate/seed, and a frozen Bun install, so `bun run typecheck`, `bun run lint:all`
  and `bun run test` work inside the agent run.
- Claude runs headless (`claude -p --dangerously-skip-permissions`) with a prompt that
  invokes the `issue-to-pr` skill. The runner checkout counts as the isolated workspace, so
  the skill skips its worktree step; stop conditions report instead of asking.
- Claude commits in behavior slices per the skill, pushes the branch, and opens the PR with
  `Closes #N`.
- A classic PAT (`CLAUDE_GH_TOKEN`) is used for checkout, `gh`, and push instead of
  `GITHUB_TOKEN`. This lets `gh project` update the project board and makes pushed commits
  trigger CI, which `GITHUB_TOKEN` pushes do not. A classic PAT is required because
  fine-grained PATs cannot access user-owned Projects v2. The PAT needs `repo` and
  `project`; without `workflow`, pushes that change `.github/workflows/*` are rejected.
- A final step fails the run when uncommitted changes remain or no open PR closes the issue.

## Consequences

- The runner reproduces the local skill workflow without per-user configuration. Plugin
  versions follow their marketplaces instead of being pinned.
- The repository needs the `DEEPSEEK_API_KEY` and `CLAUDE_GH_TOKEN` secrets.
- Headless runs cannot ask questions, so an ambiguous issue stops without a PR.
- The issue body is untrusted input executed with write access. Runs are limited to issues
  labeled by a maintainer, and the PAT should belong to a dedicated account with access
  limited to this repository.
