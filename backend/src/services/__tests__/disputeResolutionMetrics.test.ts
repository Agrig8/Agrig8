import {
  buildDisputeResolutionReport,
  DisputeDurationInput,
  summarizeDurations,
  UNCATEGORIZED,
} from "../disputeResolutionMetrics";

const HOUR = 60 * 60 * 1000;
const base = new Date("2026-01-01T00:00:00Z");

const resolved = (
  hours: number,
  categoryName: string | null = "Late delivery",
  status: "RESOLVED" | "CLOSED" = "RESOLVED",
): DisputeDurationInput => ({
  status,
  createdAt: base,
  resolvedAt: new Date(base.getTime() + hours * HOUR),
  categoryName,
});

describe("summarizeDurations", () => {
  it("returns nulls for an empty sample", () => {
    expect(summarizeDurations([])).toEqual({
      count: 0,
      minMs: null,
      maxMs: null,
      meanMs: null,
      medianMs: null,
      p90Ms: null,
    });
  });

  it("computes min, max, mean, median, and p90 with nearest-rank percentiles", () => {
    const stats = summarizeDurations([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(stats).toMatchObject({
      count: 10,
      minMs: 1,
      maxMs: 10,
      meanMs: 6, // 55 / 10 = 5.5, rounded
      medianMs: 5,
      p90Ms: 9,
    });
  });

  it("does not depend on input order", () => {
    expect(summarizeDurations([9, 1, 5])).toEqual(summarizeDurations([1, 5, 9]));
  });
});

describe("buildDisputeResolutionReport", () => {
  it("groups completed disputes by category and outcome", () => {
    const report = buildDisputeResolutionReport([
      resolved(2),
      resolved(4),
      resolved(6, "Quality", "CLOSED"),
      resolved(8, null),
    ]);

    expect(report.groups).toEqual([
      expect.objectContaining({ category: "Late delivery", outcome: "RESOLVED", count: 2, medianMs: 2 * HOUR, maxMs: 4 * HOUR }),
      expect.objectContaining({ category: "Quality", outcome: "CLOSED", count: 1, meanMs: 6 * HOUR }),
      expect.objectContaining({ category: UNCATEGORIZED, outcome: "RESOLVED", count: 1, medianMs: 8 * HOUR }),
    ]);
  });

  it("counts open and under-review disputes as pending, not as durations", () => {
    const report = buildDisputeResolutionReport([
      { status: "OPEN", createdAt: base, resolvedAt: null, categoryName: null },
      { status: "UNDER_REVIEW", createdAt: base, resolvedAt: null, categoryName: "Fraud" },
      resolved(1),
    ]);
    expect(report.pendingCount).toBe(2);
    expect(report.groups.reduce((acc, g) => acc + g.count, 0)).toBe(1);
  });

  it("skips completed disputes with missing or inconsistent timestamps", () => {
    const report = buildDisputeResolutionReport([
      { status: "RESOLVED", createdAt: base, resolvedAt: null, categoryName: null },
      resolved(-1), // resolved before created
      resolved(0), // zero duration is valid
    ]);
    expect(report.invalidCount).toBe(2);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]).toMatchObject({ count: 1, minMs: 0 });
  });

  it("treats a blank category name as uncategorized", () => {
    const report = buildDisputeResolutionReport([resolved(3, "   ")]);
    expect(report.groups[0].category).toBe(UNCATEGORIZED);
  });

  it("returns an empty report for no disputes", () => {
    expect(buildDisputeResolutionReport([])).toEqual({
      groups: [],
      pendingCount: 0,
      invalidCount: 0,
    });
  });

  it("output contains no trade, initiator, or mediator identifiers", () => {
    const report = buildDisputeResolutionReport([
      { ...resolved(2), initiator: "GSECRET" } as DisputeDurationInput,
    ]);
    expect(JSON.stringify(report)).not.toContain("GSECRET");
  });
});
