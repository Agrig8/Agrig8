/**
 * Amount denomination clarity tests (issue #151).
 *
 * Display formatters must make the denomination explicit and must not
 * silently shift decimals: stroops are always scaled by the asset's decimals,
 * XLM output carries its unit, and large amounts keep every fractional digit.
 */

import { formatStroops, formatXlm, formatUsdc } from "../format";

describe("stroop denomination display", () => {
  it("scales stroops by the asset decimals and keeps fixed precision", () => {
    expect(formatStroops(10_000_000, 7)).toBe("1.0000000");
    expect(formatStroops(1, 7)).toBe("0.0000001");
  });

  it("groups thousands while preserving all 7 fractional digits", () => {
    expect(formatStroops(123_456_789_012, 7)).toBe("12,345.6789012");
  });

  it("does not drift when decimals differ from the 7-digit Stellar default", () => {
    expect(formatStroops(1_500_000, 6)).toBe("1.500000");
    expect(formatStroops(0, 2)).toBe("0.00");
  });
});

describe("XLM denomination display", () => {
  it("always appends the XLM unit so the amount is never ambiguous", () => {
    expect(formatXlm(10_000_000)).toMatch(/XLM$/);
  });

  it("shows 4 decimal places for XLM amounts", () => {
    expect(formatXlm(12_345_678)).toBe("1.2346 XLM");
  });

  it("groups large XLM amounts", () => {
    expect(formatXlm(1_234_567_890_000)).toBe("123,456.7890 XLM");
  });
});

describe("USDC denomination display", () => {
  it("renders stroop-based USDC as a currency with two decimals", () => {
    expect(formatUsdc(10_000_000)).toBe("$1.00");
  });
});
