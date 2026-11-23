"use client";

import React from "react";

export type EscrowStageStatus = "completed" | "current" | "pending";

export interface EscrowStage {
  id: string;
  title: string;
  description: string;
  status: EscrowStageStatus;
}

export interface TradeStatusTimelineProps {
  stages: EscrowStage[];
  /** Accessible label for the timeline landmark. */
  label?: string;
  className?: string;
}

const ESCROW_STAGES: Omit<EscrowStage, "status">[] = [
  {
    id: "pending",
    title: "Trade Created",
    description: "The trade has been created and is awaiting funding from both parties.",
  },
  {
    id: "funded",
    title: "Escrow Funded",
    description: "Funds have been deposited into the escrow contract and the trade is active.",
  },
  {
    id: "in_transit",
    title: "In Transit",
    description: "Goods are being transported. The buyer will confirm delivery.",
  },
  {
    id: "settled",
    title: "Settled",
    description: "Delivery confirmed and funds have been released to the seller.",
  },
];

/** Returns the standard escrow stages with status derived from the given trade status. */
export function deriveStagesFromTradeStatus(
  tradeStatus: "PENDING" | "IN TRANSIT" | "SETTLED" | "DISPUTED" | "DRAFT",
): EscrowStage[] {
  const statusOrder: Record<typeof tradeStatus, number> = {
    DRAFT: -1,
    PENDING: 0,
    "IN TRANSIT": 1,
    SETTLED: 3,
    DISPUTED: 2,
  };
  const currentIndex = statusOrder[tradeStatus] ?? 0;

  return ESCROW_STAGES.map((stage, i) => ({
    ...stage,
    status:
      i < currentIndex
        ? "completed"
        : i === currentIndex
        ? "current"
        : "pending",
  }));
}

function StageIcon({ status }: { status: EscrowStageStatus }) {
  if (status === "completed") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: 14, height: 14 }}
      >
        <path d="M2.5 7l3 3 6-6" />
      </svg>
    );
  }
  if (status === "current") {
    return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "block" }} />;
  }
  return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", opacity: 0.3, display: "block" }} />;
}

const nodeStyle: Record<EscrowStageStatus, React.CSSProperties> = {
  completed: {},
  current: {},
  pending: {},
};

const NODE_CLASS: Record<EscrowStageStatus, string> = {
  completed: "bg-emerald text-text-inverse border-emerald",
  current: "bg-status-warning text-text-inverse border-status-warning ring-4 ring-status-warning/20",
  pending: "bg-elevated text-text-muted border-border-default",
};

const STATUS_LABEL: Record<EscrowStageStatus, string> = {
  completed: "Completed",
  current: "Current stage",
  pending: "Upcoming",
};

/**
 * Accessible escrow trade status timeline.
 *
 * Uses `role="list"` / `role="listitem"` so screen readers announce the
 * stage count. The active stage carries `aria-current="step"`. Each stage
 * has a visually hidden status label so the colour cues have text equivalents.
 */
export function TradeStatusTimeline({
  stages,
  label = "Trade status timeline",
  className = "",
}: TradeStatusTimelineProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol role="list" className="flex flex-col gap-0">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          const isCurrent = stage.status === "current";

          return (
            <li
              key={stage.id}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex gap-3 group"
            >
              {/* Connector line */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className="absolute left-[17px] top-9 bottom-0 w-px bg-border-default"
                />
              )}

              {/* Stage node */}
              <div
                className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border transition-all duration-200 ${NODE_CLASS[stage.status]}`}
                style={nodeStyle[stage.status]}
                aria-hidden="true"
              >
                <StageIcon status={stage.status} />
              </div>

              {/* Stage content */}
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
                <div className="flex items-start justify-between gap-2 pt-1.5 mb-0.5">
                  <p
                    className={`text-sm font-semibold leading-tight ${
                      stage.status === "pending" ? "text-text-muted" : "text-text-primary"
                    }`}
                  >
                    {stage.title}
                    {/* Visually hidden status so colour is not the only cue */}
                    <span className="sr-only"> — {STATUS_LABEL[stage.status]}</span>
                  </p>
                  {isCurrent && (
                    <span
                      aria-hidden="true"
                      className="text-[10px] px-1.5 py-0.5 rounded bg-status-warning/10 text-status-warning border border-status-warning/20 font-semibold tracking-wide uppercase flex-shrink-0"
                    >
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {stage.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
