/**
 * Pilot feedback taxonomy and aggregate reporting (issue #179).
 *
 * Feedback is classified into three categories using case-insensitive keyword
 * rules. An item can belong to several categories. Items matching none are
 * reported as `uncategorized` so reviewers can extend the rules instead of
 * losing them. See docs/pilot-feedback-taxonomy.md for the full definition.
 */

export const FEEDBACK_CATEGORIES = ["usability", "logistics", "contract"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Keyword stems matched as case-insensitive substrings of the feedback text. */
export const FEEDBACK_TAXONOMY: Record<FeedbackCategory, readonly string[]> = {
  usability: [
    "confus",
    "unclear",
    "hard to",
    "difficult",
    "navigat",
    "button",
    "screen",
    "layout",
    "label",
    "usability",
    "onboarding",
  ],
  logistics: [
    "delivery",
    "shipment",
    "shipping",
    "pickup",
    "pick-up",
    "warehouse",
    "transport",
    "logistic",
    "harvest",
    "farm",
    "storage",
    "route",
  ],
  contract: [
    "escrow",
    "contract",
    "release",
    "payout",
    "dispute",
    "clawback",
    "deposit",
    "refund",
    "milestone",
    "fees",
    "payment",
  ],
};

export const UNCATEGORIZED = "uncategorized" as const;

/** Returns every category whose keywords appear in the text, in taxonomy order. */
export function categorizeFeedback(text: string | null | undefined): FeedbackCategory[] {
  if (!text) return [];
  const haystack = text.toLowerCase();
  return FEEDBACK_CATEGORIES.filter((category) =>
    FEEDBACK_TAXONOMY[category].some((keyword) => haystack.includes(keyword)),
  );
}

export interface FeedbackReportItem {
  id: string;
  title?: string | null;
  content?: string | null;
}

export interface FeedbackAggregateReport {
  total: number;
  /** Count of items per category. An item counted in two categories adds to both. */
  byCategory: Record<FeedbackCategory, number>;
  /** Items matching no category. */
  uncategorized: number;
  /** Item ids per category, for drill-down. */
  itemIds: Record<FeedbackCategory | typeof UNCATEGORIZED, string[]>;
}

/** Aggregates feedback into per-category counts, preserving every item id once per category. */
export function aggregateFeedbackReport(items: FeedbackReportItem[]): FeedbackAggregateReport {
  const byCategory = {} as Record<FeedbackCategory, number>;
  const itemIds = { [UNCATEGORIZED]: [] } as FeedbackAggregateReport["itemIds"];
  for (const category of FEEDBACK_CATEGORIES) {
    byCategory[category] = 0;
    itemIds[category] = [];
  }

  let uncategorized = 0;
  for (const item of items) {
    const categories = categorizeFeedback(`${item.title ?? ""} ${item.content ?? ""}`);
    if (categories.length === 0) {
      uncategorized++;
      itemIds[UNCATEGORIZED].push(item.id);
      continue;
    }
    for (const category of categories) {
      byCategory[category]++;
      itemIds[category].push(item.id);
    }
  }

  return { total: items.length, byCategory, uncategorized, itemIds };
}
