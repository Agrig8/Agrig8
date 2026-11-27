import React from "react";
import { render, screen } from "@testing-library/react";
import {
  TradeStatusTimeline,
  deriveStagesFromTradeStatus,
  type EscrowStage,
} from "../TradeStatusTimeline";

const STAGES: EscrowStage[] = [
  { id: "s1", title: "Created", description: "Trade created", status: "completed" },
  { id: "s2", title: "Funded", description: "Escrow funded", status: "current" },
  { id: "s3", title: "In Transit", description: "Goods in transit", status: "pending" },
  { id: "s4", title: "Settled", description: "Funds released", status: "pending" },
];

describe("TradeStatusTimeline", () => {
  it("renders a nav landmark with aria-label", () => {
    render(<TradeStatusTimeline stages={STAGES} label="Trade progress" />);
    expect(screen.getByRole("navigation", { name: "Trade progress" })).toBeInTheDocument();
  });

  it("uses default label when none provided", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    expect(screen.getByRole("navigation", { name: "Trade status timeline" })).toBeInTheDocument();
  });

  it("renders all stage titles", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Funded")).toBeInTheDocument();
    expect(screen.getByText("In Transit")).toBeInTheDocument();
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });

  it("renders all stage descriptions", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    expect(screen.getByText("Trade created")).toBeInTheDocument();
    expect(screen.getByText("Escrow funded")).toBeInTheDocument();
  });

  it("sets aria-current=step on the current stage", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    const items = screen.getAllByRole("listitem");
    // s2 is current (index 1)
    expect(items[1]).toHaveAttribute("aria-current", "step");
  });

  it("does not set aria-current on completed or pending stages", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[2]).not.toHaveAttribute("aria-current");
    expect(items[3]).not.toHaveAttribute("aria-current");
  });

  it("renders visually hidden status labels for screen readers", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    expect(screen.getByText(/— Completed/)).toBeInTheDocument();
    expect(screen.getByText(/— Current stage/)).toBeInTheDocument();
    // Both pending stages
    const upcomingLabels = screen.getAllByText(/— Upcoming/);
    expect(upcomingLabels).toHaveLength(2);
  });

  it("shows Active badge only on the current stage", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    expect(screen.getAllByText("Active")).toHaveLength(1);
  });

  it("renders an ordered list", () => {
    render(<TradeStatusTimeline stages={STAGES} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});

describe("deriveStagesFromTradeStatus", () => {
  it("marks first stage as current for PENDING trade", () => {
    const stages = deriveStagesFromTradeStatus("PENDING");
    expect(stages[0].status).toBe("current");
    expect(stages[1].status).toBe("pending");
  });

  it("marks first stage as current for DRAFT trade", () => {
    const stages = deriveStagesFromTradeStatus("DRAFT");
    expect(stages[0].status).toBe("current");
  });

  it("marks first stage as completed for IN TRANSIT trade", () => {
    const stages = deriveStagesFromTradeStatus("IN TRANSIT");
    expect(stages[0].status).toBe("completed");
    expect(stages[1].status).toBe("current");
  });

  it("marks all stages as completed for SETTLED trade", () => {
    const stages = deriveStagesFromTradeStatus("SETTLED");
    expect(stages.every((s) => s.status === "completed")).toBe(true);
  });

  it("returns 4 stages", () => {
    expect(deriveStagesFromTradeStatus("PENDING")).toHaveLength(4);
  });

  it("returns stages with required fields", () => {
    const stages = deriveStagesFromTradeStatus("PENDING");
    for (const stage of stages) {
      expect(stage).toHaveProperty("id");
      expect(stage).toHaveProperty("title");
      expect(stage).toHaveProperty("description");
      expect(stage).toHaveProperty("status");
    }
  });
});
