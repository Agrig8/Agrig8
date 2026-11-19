/**
 * Tests for classifyWaivers() in scripts/check-audit-waivers.mjs.
 */
import { classifyWaivers } from "../check-audit-waivers.mjs";

const NOW = new Date("2026-06-15T00:00:00Z");
const waiver = (over = {}) => ({
  advisory: "GHSA-aaaa-bbbb-cccc",
  package: "left-pad",
  owner: "security-team",
  reason: "No fixed version available; tracked in #999",
  expires: "2026-12-31",
  ...over,
});

describe("classifyWaivers", () => {
  it("accepts a waiver with owner and future expiry as active", () => {
    const { active, expired } = classifyWaivers([waiver()], NOW);
    expect(active).toHaveLength(1);
    expect(expired).toHaveLength(0);
  });

  it("classifies a past expiry as expired", () => {
    const { active, expired } = classifyWaivers([waiver({ expires: "2026-01-01" })], NOW);
    expect(expired).toHaveLength(1);
    expect(active).toHaveLength(0);
  });

  it("rejects a waiver with no owner", () => {
    const w = waiver();
    delete w.owner;
    expect(() => classifyWaivers([w], NOW)).toThrow(/missing a non-empty `owner`/);
  });

  it("rejects a blank owner", () => {
    expect(() => classifyWaivers([waiver({ owner: "   " })], NOW)).toThrow(/owner/);
  });

  it("rejects a missing expiry", () => {
    const w = waiver();
    delete w.expires;
    expect(() => classifyWaivers([w], NOW)).toThrow(/YYYY-MM-DD/);
  });

  it("rejects an expiry that is not YYYY-MM-DD", () => {
    expect(() => classifyWaivers([waiver({ expires: "31/12/2026" })], NOW)).toThrow(/YYYY-MM-DD/);
  });

  it("rejects an impossible calendar date", () => {
    expect(() => classifyWaivers([waiver({ expires: "2026-02-30" })], NOW)).toThrow(/invalid/);
  });

  it("rejects an entry without an advisory id", () => {
    expect(() => classifyWaivers([waiver({ advisory: "" })], NOW)).toThrow(/advisory/);
  });

  it("returns empty lists for an empty ecosystem", () => {
    expect(classifyWaivers([], NOW)).toEqual({ active: [], expired: [] });
  });
});
