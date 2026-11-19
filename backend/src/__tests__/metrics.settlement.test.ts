/**
 * Settlement outcome metrics (#175).
 */
import {
    __resetSettlementMetricsForTests,
    __setSettlementRecorderForTests,
    classifyDisputeSettlement,
    recordSettlementOutcome,
    SettlementMetricsRecorder,
    SettlementOutcome,
    SettlementSource,
} from "../lib/metrics";

describe("classifyDisputeSettlement", () => {
    it("classifies a seller-only payout as released", () => {
        expect(classifyDisputeSettlement(BigInt(500), BigInt(0))).toBe("released");
    });

    it("classifies a buyer-only refund as refunded", () => {
        expect(classifyDisputeSettlement(BigInt(0), BigInt(500))).toBe("refunded");
    });

    it("classifies a payout to both parties as split", () => {
        expect(classifyDisputeSettlement(BigInt(300), BigInt(200))).toBe("split");
    });

    it("returns null when no funds moved", () => {
        expect(classifyDisputeSettlement(BigInt(0), BigInt(0))).toBeNull();
    });

    it("accepts string and number amounts from parsed events", () => {
        expect(classifyDisputeSettlement("1000", "0")).toBe("released");
        expect(classifyDisputeSettlement(0, "7")).toBe("refunded");
    });

    it("treats missing or malformed amounts as zero", () => {
        expect(classifyDisputeSettlement(undefined, null)).toBeNull();
        expect(classifyDisputeSettlement("not-a-number", BigInt(5))).toBe("refunded");
    });
});

describe("recordSettlementOutcome", () => {
    const seen: Array<[SettlementOutcome, SettlementSource]> = [];
    const recorder: SettlementMetricsRecorder = {
        recordSettlementOutcome: (outcome, source) => seen.push([outcome, source]),
    };

    beforeEach(() => {
        seen.length = 0;
        __setSettlementRecorderForTests(recorder);
    });

    afterEach(() => {
        __resetSettlementMetricsForTests();
    });

    it("forwards outcome and source labels to the recorder", () => {
        recordSettlementOutcome("released", "release");
        recordSettlementOutcome("split", "dispute");
        expect(seen).toEqual([
            ["released", "release"],
            ["split", "dispute"],
        ]);
    });
});
