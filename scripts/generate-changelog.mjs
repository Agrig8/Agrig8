#!/usr/bin/env node
/**
 * Drafts release changelog entries from merged pull requests.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs <prs.json> [--version <v>] [--out <file>]
 *
 * <prs.json> is an array of { number, title, url, labels: string[] } objects,
 * e.g. the output of `gh pr list --state merged --json number,title,url,labels`.
 *
 * Output is a DRAFT for human review. Nothing is published automatically.
 *   - PRs labelled `skip-changelog` are omitted.
 *   - PRs with no recognised category label are listed under "Needs Review".
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SECTIONS = [
  { key: "breaking", title: "Breaking Changes", labels: ["breaking", "breaking-change"] },
  { key: "added", title: "Added", labels: ["feature", "enhancement"] },
  { key: "fixed", title: "Fixed", labels: ["bug", "fix"] },
  { key: "docs", title: "Documentation", labels: ["docs", "documentation"] },
  { key: "infra", title: "Infrastructure & CI", labels: ["ci", "infra", "chore"] },
];
const SKIP_LABEL = "skip-changelog";
const REVIEW_KEY = "review";

/**
 * Pure transform: PR list -> { sections: { [key]: entries[] }, skipped: number }.
 * A PR is placed in the first section (in SECTIONS order) that matches one of its labels.
 */
export function categorize(prs) {
  const sections = Object.fromEntries([...SECTIONS.map((s) => s.key), REVIEW_KEY].map((k) => [k, []]));
  let skipped = 0;
  const seen = new Set();

  for (const pr of prs) {
    if (!pr || typeof pr.number !== "number" || typeof pr.title !== "string") {
      throw new Error(`Invalid PR entry: ${JSON.stringify(pr)}`);
    }
    if (seen.has(pr.number)) continue; // de-duplicate repeated PR numbers
    seen.add(pr.number);

    const labels = (pr.labels ?? []).map((l) => (typeof l === "string" ? l : l.name).toLowerCase());
    if (labels.includes(SKIP_LABEL)) {
      skipped += 1;
      continue;
    }
    const section = SECTIONS.find((s) => s.labels.some((l) => labels.includes(l)));
    sections[section ? section.key : REVIEW_KEY].push(pr);
  }
  return { sections, skipped };
}

/** Render categorized PRs as Markdown. Output is deterministic for a given input. */
export function renderChangelog({ sections, skipped }, { version = "Unreleased" } = {}) {
  const lines = [`## ${version} (DRAFT — review before publishing)`, ""];
  for (const s of SECTIONS) {
    const entries = sections[s.key];
    if (entries.length === 0) continue;
    lines.push(`### ${s.title}`, "");
    for (const pr of entries) lines.push(`- ${pr.title} ([#${pr.number}](${pr.url ?? `#${pr.number}`}))`);
    lines.push("");
  }
  if (sections.review.length > 0) {
    lines.push("### Needs Review", "", "_These PRs have no category label. Label them or remove them from this release._", "");
    for (const pr of sections.review) lines.push(`- ${pr.title} ([#${pr.number}](${pr.url ?? `#${pr.number}`}))`);
    lines.push("");
  }
  lines.push(`_${skipped} PR(s) skipped via \`${SKIP_LABEL}\`._`, "");
  return lines.join("\n");
}

function main(argv) {
  const args = argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (!file) {
    console.error("usage: generate-changelog.mjs <prs.json> [--version <v>] [--out <file>]");
    process.exit(2);
  }
  const prs = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(prs)) {
    console.error("input must be a JSON array of PRs");
    process.exit(2);
  }
  const md = renderChangelog(categorize(prs), { version: flag("--version") });
  const out = flag("--out");
  if (out) writeFileSync(out, md, "utf8");
  else process.stdout.write(md);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv);
}
