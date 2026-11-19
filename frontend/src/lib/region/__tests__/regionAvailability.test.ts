import {
  DEFAULT_SUPPORTED_COUNTRIES,
  getRegionAvailability,
  normalizeCountryCode,
  parseSupportedCountries,
} from "../regionAvailability";

describe("parseSupportedCountries", () => {
  it("falls back to the pilot default when unset or invalid", () => {
    expect(parseSupportedCountries(undefined)).toEqual([...DEFAULT_SUPPORTED_COUNTRIES]);
    expect(parseSupportedCountries("")).toEqual([...DEFAULT_SUPPORTED_COUNTRIES]);
    expect(parseSupportedCountries("USA, 1, ????")).toEqual([...DEFAULT_SUPPORTED_COUNTRIES]);
  });

  it("parses, uppercases, trims and de-duplicates codes", () => {
    expect(parseSupportedCountries(" ng, gh ,NG,xx1")).toEqual(["NG", "GH"]);
  });
});

describe("normalizeCountryCode", () => {
  it("accepts two-letter codes regardless of case or whitespace", () => {
    expect(normalizeCountryCode(" ng ")).toBe("NG");
  });

  it("rejects anything that is not a two-letter code", () => {
    expect(normalizeCountryCode("NGA")).toBeNull();
    expect(normalizeCountryCode("")).toBeNull();
    expect(normalizeCountryCode(null)).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});

describe("getRegionAvailability", () => {
  const supported = ["NG", "GH"];

  it("reports supported regions with no next steps", () => {
    const result = getRegionAvailability("gh", supported);
    expect(result.status).toBe("supported");
    expect(result.countryCode).toBe("GH");
    expect(result.nextSteps).toEqual([]);
  });

  it("reports unsupported regions with actionable next steps", () => {
    const result = getRegionAvailability("US", supported);
    expect(result.status).toBe("unsupported");
    expect(result.countryCode).toBe("US");
    expect(result.title).toBe("Not available in your region yet");
    expect(result.nextSteps.length).toBeGreaterThan(0);
    expect(result.nextSteps.join(" ")).toMatch(/existing trades and funds remain accessible/i);
  });

  it("reports unknown when no valid country is provided, without blocking", () => {
    const result = getRegionAvailability("not-a-code", supported);
    expect(result.status).toBe("unknown");
    expect(result.countryCode).toBeNull();
    expect(result.title).toBe("Choose your country");
  });
});
