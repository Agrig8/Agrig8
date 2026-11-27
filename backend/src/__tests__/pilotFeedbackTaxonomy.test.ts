/**
 * Tests for pilot feedback categorization and aggregate reporting (issue #179).
 */
import {
  aggregateFeedbackReport,
  categorizeFeedback,
  FEEDBACK_TAXONOMY,
} from "../services/pilotFeedbackTaxonomy";

describe("categorizeFeedback", () => {
  it("returns no categories for empty or missing text", () => {
    expect(categorizeFeedback("")).toEqual([]);
    expect(categorizeFeedback(null)).toEqual([]);
    expect(categorizeFeedback(undefined)).toEqual([]);
  });

  it("matches each category case-insensitively", () => {
    expect(categorizeFeedback("The Button labels are CONFUSING")).toEqual(["usability"]);
    expect(categorizeFeedback("Delivery to the WAREHOUSE was late")).toEqual(["logistics"]);
    expect(categorizeFeedback("Escrow release took too long")).toEqual(["contract"]);
  });

  it("allows an item to belong to several categories, in taxonomy order", () => {
    expect(categorizeFeedback("Delivery fees are unclear on the screen")).toEqual([
      "usability",
      "logistics",
      "contract",
    ]);
  });

  it("does not treat the word feedback as a fee keyword", () => {
    expect(categorizeFeedback("Great feedback from the pilot team")).toEqual([]);
  });

  it("returns an empty list for text matching no keyword", () => {
    expect(categorizeFeedback("All good, thanks")).toEqual([]);
  });

  it("keeps every taxonomy keyword lowercase so matching is reliable", () => {
    for (const keywords of Object.values(FEEDBACK_TAXONOMY)) {
      for (const keyword of keywords) {
        expect(keyword).toBe(keyword.toLowerCase());
      }
    }
  });
});

describe("aggregateFeedbackReport", () => {
  it("returns zero counts for an empty set", () => {
    expect(aggregateFeedbackReport([])).toEqual({
      total: 0,
      byCategory: { usability: 0, logistics: 0, contract: 0 },
      uncategorized: 0,
      itemIds: { usability: [], logistics: [], contract: [], uncategorized: [] },
    });
  });

  it("counts items per category and tracks uncategorized items", () => {
    const report = aggregateFeedbackReport([
      { id: "f1", title: "Navigation", content: "hard to find the screen" },
      { id: "f2", title: null, content: "Shipment arrived late" },
      { id: "f3", title: "Escrow", content: "release is slow, delivery too" },
      { id: "f4", title: "Thanks", content: null },
    ]);

    expect(report.total).toBe(4);
    expect(report.byCategory).toEqual({ usability: 1, logistics: 2, contract: 1 });
    expect(report.uncategorized).toBe(1);
    expect(report.itemIds.logistics).toEqual(["f2", "f3"]);
    expect(report.itemIds.uncategorized).toEqual(["f4"]);
  });

  it("does not double count an item within a single category", () => {
    const report = aggregateFeedbackReport([
      { id: "x", content: "delivery, shipment and pickup" },
    ]);
    expect(report.byCategory.logistics).toBe(1);
    expect(report.itemIds.logistics).toEqual(["x"]);
  });
});
