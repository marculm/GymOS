#!/usr/bin/env bun
/**
 * GymOS ADR Linter
 *
 * Validates that all ADR files in docs/adr/ conform to the MADR format.
 * Run: bun run lint:adr
 *
 * Checks:
 *  - File naming:    NNNN-kebab-case-title.md
 *  - Sequential:     No gaps in numbering
 *  - Required H2s:   Status, Context, Decision, Consequences
 *  - Valid status:    Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
 *  - Title:          H1 heading exists and is non-empty
 *  - Non-empty:      Required sections have content
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// ─── Config ───────────────────────────────────────────────────────────────────

const ADR_DIR = join(import.meta.dir, "..", "docs", "adr");
const FILENAME_RE = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const REQUIRED_SECTIONS = ["Status", "Context", "Decision", "Consequences"];
const VALID_STATUSES = ["Proposed", "Accepted", "Deprecated"];
const SUPERSEDED_RE = /^Superseded by (?:ADR[- ]?)?\d{4}/i;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  message: string;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ─── Checks ───────────────────────────────────────────────────────────────────

function checkFilename(filename: string): Violation[] {
  if (!FILENAME_RE.test(filename)) {
    return [
      {
        file: filename,
        message: `Filename must match pattern ${dim("NNNN-kebab-case-title.md")} (e.g. 0001-my-decision.md)`,
      },
    ];
  }
  return [];
}

function checkSequentialNumbering(filenames: string[]): Violation[] {
  const violations: Violation[] = [];
  const numbers = filenames
    .map((f) => {
      const match = f.match(/^(\d{4})/);
      return match?.[1] != null ? parseInt(match[1], 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i) {
      violations.push({
        file: "docs/adr/",
        message: `Gap in numbering: expected ADR ${String(i).padStart(4, "0")} but next is ${String(numbers[i]).padStart(4, "0")}`,
      });
      break;
    }
  }
  return violations;
}

function checkContent(filename: string, content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split("\n");

  // Check H1 title exists
  const h1 = lines.find((l) => l.startsWith("# "));
  if (!h1 || h1.replace("# ", "").trim().length === 0) {
    violations.push({ file: filename, message: "Missing H1 title (e.g. # My Decision Title)" });
  }

  // Extract H2 sections
  const h2Sections = new Map<string, string>();
  let currentSection = "";
  let currentContent = "";

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) {
        h2Sections.set(currentSection, currentContent.trim());
      }
      currentSection = line.replace("## ", "").trim();
      currentContent = "";
    } else {
      currentContent += line + "\n";
    }
  }
  if (currentSection) {
    h2Sections.set(currentSection, currentContent.trim());
  }

  // Check required sections exist
  for (const section of REQUIRED_SECTIONS) {
    if (!h2Sections.has(section)) {
      violations.push({
        file: filename,
        message: `Missing required section ${bold(`## ${section}`)}`,
      });
    } else {
      const body = h2Sections.get(section) ?? "";
      if (body.length === 0) {
        violations.push({
          file: filename,
          message: `Section ${bold(`## ${section}`)} is empty`,
        });
      }
    }
  }

  // Check Status value
  const statusBody = h2Sections.get("Status");
  if (statusBody) {
    const statusLine = statusBody.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
    const isValid =
      VALID_STATUSES.includes(statusLine) || SUPERSEDED_RE.test(statusLine);
    if (!isValid) {
      violations.push({
        file: filename,
        message: `Invalid status "${statusLine}". Must be one of: ${VALID_STATUSES.join(", ")}, or "Superseded by ADR-NNNN"`,
      });
    }
  }

  return violations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log(bold("📋  GymOS ADR Linter"));
  console.log(dim("   Validating MADR format compliance...\n"));

  let entries: string[];
  try {
    entries = await readdir(ADR_DIR);
  } catch {
    console.log(red("  ✗ ") + `ADR directory not found at docs/adr/`);
    process.exit(1);
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();

  if (mdFiles.length === 0) {
    console.log(yellow("  ⚠ ") + "No ADR files found in docs/adr/");
    process.exit(0);
  }

  const allViolations: Violation[] = [];

  // Check sequential numbering across all files
  allViolations.push(...checkSequentialNumbering(mdFiles));

  // Check each file
  for (const file of mdFiles) {
    allViolations.push(...checkFilename(file));

    const content = await readFile(join(ADR_DIR, file), "utf-8");
    allViolations.push(...checkContent(file, content));
  }

  // Report
  if (allViolations.length === 0) {
    console.log(green("  ✓ ") + `All ${mdFiles.length} ADR(s) conform to MADR format.`);
    console.log();
    process.exit(0);
  }

  // Group violations by file
  const byFile = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const arr = byFile.get(v.file) ?? [];
    arr.push(v);
    byFile.set(v.file, arr);
  }

  for (const [file, violations] of byFile) {
    console.log(red("  ✗ ") + file);
    for (const v of violations) {
      console.log(`    ${red("→")} ${v.message}`);
    }
  }

  console.log();
  console.log(red(bold(`  ✗ ${allViolations.length} issue(s) in ${byFile.size} file(s).`)));
  console.log();
  process.exit(1);
}

main().catch((err) => {
  console.error("ADR linter failed:", err);
  process.exit(2);
});
