import { env } from "../config/env";

/**
 * Trade Archive Retention Policy (Issue #144).
 *
 * Defines when terminal trade records move to archive storage: a trade is
 * archivable once it has been in a terminal status longer than the configured
 * retention window, and it must not have an open dispute (dispute access
 * keeps working while the dispute is unresolved).
 */

/** Terminal trade statuses eligible for archive storage. */
export const ARCHIVABLE_TERMINAL_STATUSES = [
    "COMPLETED",
    "DISPUTED",
    "CANCELLED",
    "EXPIRED",
] as const;

export type ArchivableTerminalStatus = (typeof ARCHIVABLE_TERMINAL_STATUSES)[number];

export interface ArchivableTrade {
    status: string;
    /** Terminal timestamp of the trade (e.g. `completedAt` for COMPLETED; `createdAt` fallback). */
    terminalAt: Date;
    /** True while a dispute is open on the trade — archiving is deferred. */
    hasOpenDispute?: boolean;
}

/**
 * Retention window in days. Override with `TRADE_ARCHIVE_RETENTION_DAYS`;
 * default is `env.TRADE_ARCHIVE_RETENTION_DAYS` (730 days ≈ 2 years).
 */
export function getTradeArchiveRetentionDays(): number {
    const raw = process.env.TRADE_ARCHIVE_RETENTION_DAYS;
    if (raw !== undefined) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }
    }
    return env.TRADE_ARCHIVE_RETENTION_DAYS;
}

export function isTerminalTradeStatus(status: string): status is ArchivableTerminalStatus {
    return (ARCHIVABLE_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * True when a terminal trade record has passed the archive retention window.
 * Non-terminal trades are never archivable, and trades with open disputes are
 * excluded so audit and dispute access keep working until the dispute resolves.
 */
export function isTradeArchivable(trade: ArchivableTrade, now: Date = new Date()): boolean {
    if (trade.hasOpenDispute) return false;
    if (!isTerminalTradeStatus(trade.status)) return false;
    const retentionMs = getTradeArchiveRetentionDays() * 24 * 60 * 60 * 1000;
    return now.getTime() - trade.terminalAt.getTime() >= retentionMs;
}
