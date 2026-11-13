# Agent Guidelines for GymOS

This document specifies mandatory rules and operational conventions for all AI agents working in this repository.

---

## 1. Architectural Decisions & ADRs

- **Mandatory Documentation:** Every architectural, infrastructural, or design decision must be documented as an **Architectural Decision Record (ADR)** in `docs/adr/`.
- **Format:** Must follow the **MADR** (Markdown Architectural Decision Records) standard.
- **Required Sections:**
  - `## Status` (`Proposed` | `Accepted` | `Deprecated` | `Superseded by ADR-NNNN`)
  - `## Context`
  - `## Decision`
  - `## Consequences`
- **Validation:** Every new or edited ADR must pass the project's ADR linter:
  ```bash
  bun run lint:adr
  ```
  Ensure file naming follows `NNNN-kebab-case-title.md` with no gaps in sequential numbering.

---

## 2. Git & Version Control Rules

### Push Only Through the `issue-to-pr` Workflow
- **Do NOT execute `git push`** unless the user invoked the `issue-to-pr` workflow for a named issue.
- That workflow explicitly authorizes pushing the issue branch and opening its pull request.
- All other remote synchronization remains reserved for the human user.

### Strictly No `.env` Access
- **Do NOT touch `.env` files.**
- Agents must **NEVER read, write, create, edit, or inspect** any `.env` file (including `.env.local`, `.env.*`, etc.).
- Agents may only reference or update template files like `.env.example`.
- All secret configuration and `.env` files are exclusively managed by the human user.

### Commit Conventions
- Keep commits **small, lean, and logically cohesive** (atomic commits).
- Never bundle unrelated changes (e.g. documentation, fixes, features, configuration) into a single commit.
- **Commit messages must be as short and concise as possible** (only essential words, no filler, e.g. `Add AGENTS.md`, `Fix lint error`).
- **Commit messages must start with the issue ID or one of the following imperative verbs:**
  - `#12: Add <target>` (issue ID followed by an imperative verb)
  - `Add <target>` (for new features, files, packages, tests)
  - `Update <target>` (for modifications to existing code, dependencies, configs)
  - `Remove <target>` (for deleting dead code, deprecated files)
  - `Move <target>` (for moving or renaming files/directories)
  - `Fix <target>` (for bug fixes, type errors, lint issues)
- Keep commit messages in English.

---

## 3. Technology Stack & Runtime Conventions

- **Runtime & Tooling:** Default to **Bun** across the entire repository (package management, scripts, runtime).
- **Monorepo Layout:**
  - `apps/api`: Backend service built with Hono, Prisma, and Pino.
  - `apps/web`: Frontend PWA built with Svelte 5 and SvelteKit.
  - `packages/shared`: Shared types, constants, and Zod schemas. Leaf package (must never import from `apps/*`).
- **Testing:** Use **Vitest** for all test suites (`bun run test`).
- **Logging:** Use **Pino** for structured logging (with `pino-pretty` in local development).
- **Code Quality:** Before completing any task, ensure all checks pass:
  ```bash
  bun run typecheck
  bun run lint:all
  bun run test
  ```

---

## 4. Code Style & Comments

- **Self-Documenting Code:** Prefer clean, expressive code with descriptive naming over comments.
- **Sparse Comments:** Only write code comments when the logic is inherently complex, non-obvious, or difficult to understand. Do not add comments for self-explanatory code.
