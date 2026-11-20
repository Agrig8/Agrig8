import {
    ARCHIVABLE_TERMINAL_STATUSES,
    isTerminalTradeStatus,
    isTradeArchivable,
} from "../tradeArchivePolicy";

describe("tradeArchivePolicy", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    afterEach(() => {
        delete process.env.TRADE_ARCHIVE_RETENTION_DAYS;
    });

    it("treats COMPLETED/DISPUTED/CANCELLED/EXPIRED as terminal statuses", () => {
        expect([...ARCHIVABLE_TERMINAL_STATUSES].sort()).toEqual([
            "CANCELLED",
            "COMPLETED",
            "DISPUTED",
            "EXPIRED",
        ]);
        for (const status of ARCHIVABLE_TERMINAL_STATUSES) {
            expect(isTerminalTradeStatus(status)).toBe(true);
        }
        expect(isTerminalTradeStatus("CREATED")).toBe(false);
        expect(isTerminalTradeStatus("FUNDED")).toBe(false);
    });

    it("is archivable once past the default retention window (730 days)", () => {
        expect(isTradeArchivable({ status: "COMPLETED", terminalAt: daysAgo(731) }, now)).toBe(true);
        expect(isTradeArchivable({ status: "COMPLETED", terminalAt: daysAgo(729) }, now)).toBe(false);
    });

    it("honors the TRADE_ARCHIVE_RETENTION_DAYS override", () => {
        process.env.TRADE_ARCHIVE_RETENTION_DAYS = "10";
        expect(isTradeArchivable({ status: "EXPIRED", terminalAt: daysAgo(11) }, now)).toBe(true);
        expect(isTradeArchivable({ status: "EXPIRED", terminalAt: daysAgo(9) }, now)).toBe(false);
    });

    it("never archives non-terminal trades or trades with an open dispute", () => {
        expect(isTradeArchivable({ status: "CREATED", terminalAt: daysAgo(4000) }, now)).toBe(false);
        expect(isTradeArchivable({ status: "FUNDED", terminalAt: daysAgo(4000) }, now)).toBe(false);
        expect(
            isTradeArchivable(
                { status: "COMPLETED", terminalAt: daysAgo(4000), hasOpenDispute: true },
                now,
            ),
        ).toBe(false);
    });
});
