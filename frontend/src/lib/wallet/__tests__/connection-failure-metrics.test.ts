/**
 * Wallet connection failure telemetry (#174).
 */
import * as analytics from "@/lib/analytics";
import {
  categorizeWalletError,
  normalizeWalletNetwork,
  trackWalletConnectionFailure,
} from "@/lib/wallet/state-machine";

jest.mock("@/lib/analytics", () => ({
  trackEvent: jest.fn(),
  trackFailure: jest.fn(),
}));

const trackFailure = analytics.trackFailure as jest.Mock;

describe("normalizeWalletNetwork", () => {
  it("maps known network names case-insensitively", () => {
    expect(normalizeWalletNetwork("TESTNET")).toBe("testnet");
    expect(normalizeWalletNetwork(" public ")).toBe("public");
    expect(normalizeWalletNetwork("futurenet")).toBe("futurenet");
  });

  it("maps unexpected values to other and missing values to unknown", () => {
    expect(normalizeWalletNetwork("Some Private Net 0xabc")).toBe("other");
    expect(normalizeWalletNetwork(null)).toBe("unknown");
    expect(normalizeWalletNetwork("")).toBe("unknown");
  });
});

describe("categorizeWalletError", () => {
  it("categorizes known failure messages", () => {
    expect(categorizeWalletError(new Error("User declined access"))).toBe("declined");
    expect(categorizeWalletError("wallet is locked")).toBe("locked");
    expect(categorizeWalletError(new Error("request timed out"))).toBe("timeout");
    expect(categorizeWalletError("extension not installed")).toBe("not_installed");
  });

  it("falls back to unknown for anything else, including non-string errors", () => {
    expect(categorizeWalletError(new Error("boom"))).toBe("unknown");
    expect(categorizeWalletError({ code: 42 })).toBe("unknown");
    expect(categorizeWalletError(undefined)).toBe("unknown");
  });
});

describe("trackWalletConnectionFailure", () => {
  beforeEach(() => trackFailure.mockClear());

  it("emits only provider, normalized network, and category labels", () => {
    trackWalletConnectionFailure("declined", { network: "testnet" });

    expect(trackFailure).toHaveBeenCalledTimes(1);
    expect(trackFailure).toHaveBeenCalledWith("wallet_connection_failed", {
      provider: "freighter",
      network: "testnet",
      error_category: "declined",
    });
  });

  it("never forwards raw network strings that are not in the allowlist", () => {
    trackWalletConnectionFailure("unknown", { network: "GABCDEF-PRIVATE" });

    const payload = trackFailure.mock.calls[0][1];
    expect(payload.network).toBe("other");
    expect(JSON.stringify(payload)).not.toContain("GABCDEF");
  });
});
