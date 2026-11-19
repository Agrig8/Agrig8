/**
 * Tests for scripts/generate-changelog.mjs (pure categorize/render functions).
 */
import { categorize, renderChangelog } from "../generate-changelog.mjs";

const pr = (number, title, labels = []) => ({
  number,
  title,
  url: `https://github.com/o/r/pull/${number}`,
  labels,
});

describe("categorize", () => {
  it("places PRs into sections by label", () => {
    const { sections } = categorize([
      pr(1, "Add export", ["feature"]),
      pr(2, "Fix crash", ["bug"]),
      pr(3, "Breaking API", ["breaking"]),
    ]);
    expect(sections.added.map((p) => p.number)).toEqual([1]);
    expect(sections.fixed.map((p) => p.number)).toEqual([2]);
    expect(sections.breaking.map((p) => p.number)).toEqual([3]);
  });

  it("accepts label objects as returned by gh CLI", () => {
    const { sections } = categorize([pr(4, "Docs", [{ name: "docs" }])]);
    expect(sections.docs.map((p) => p.number)).toEqual([4]);
  });

  it("uses the first matching section when a PR has several category labels", () => {
    const { sections } = categorize([pr(5, "Both", ["bug", "breaking"])]);
    expect(sections.breaking.map((p) => p.number)).toEqual([5]);
    expect(sections.fixed).toEqual([]);
  });

  it("sends uncategorised PRs to the review section", () => {
    const { sections } = categorize([pr(6, "No label", [])]);
    expect(sections.review.map((p) => p.number)).toEqual([6]);
  });

  it("omits skip-changelog PRs and counts them", () => {
    const { sections, skipped } = categorize([pr(7, "Internal", ["skip-changelog", "feature"])]);
    expect(skipped).toBe(1);
    Object.values(sections).forEach((list) => expect(list).toEqual([]));
  });

  it("de-duplicates repeated PR numbers", () => {
    const { sections } = categorize([pr(8, "Once", ["bug"]), pr(8, "Once", ["bug"])]);
    expect(sections.fixed).toHaveLength(1);
  });

  it("rejects malformed entries", () => {
    expect(() => categorize([{ title: "no number" }])).toThrow(/Invalid PR entry/);
    expect(() => categorize([null])).toThrow(/Invalid PR entry/);
  });
});

describe("renderChangelog", () => {
  it("marks the output as a draft and includes the version", () => {
    const md = renderChangelog(categorize([]), { version: "1.2.0" });
    expect(md).toMatch(/^## 1\.2\.0 \(DRAFT/);
  });

  it("renders sections in a fixed order with links", () => {
    const md = renderChangelog(
      categorize([pr(2, "Fix crash", ["bug"]), pr(1, "Add export", ["feature"])]),
    );
    const added = md.indexOf("### Added");
    const fixed = md.indexOf("### Fixed");
    expect(added).toBeGreaterThan(-1);
    expect(fixed).toBeGreaterThan(added);
    expect(md).toContain("- Add export ([#1](https://github.com/o/r/pull/1))");
  });

  it("flags uncategorised PRs under Needs Review", () => {
    const md = renderChangelog(categorize([pr(9, "Mystery", [])]));
    expect(md).toContain("### Needs Review");
    expect(md).toContain("- Mystery ([#9]");
  });

  it("omits empty sections", () => {
    const md = renderChangelog(categorize([pr(1, "Add", ["feature"])]));
    expect(md).not.toContain("### Fixed");
    expect(md).not.toContain("### Needs Review");
  });

  it("is deterministic for the same input", () => {
    const input = [pr(1, "A", ["feature"]), pr(2, "B", ["bug"])];
    expect(renderChangelog(categorize(input))).toBe(renderChangelog(categorize(input)));
  });
});
