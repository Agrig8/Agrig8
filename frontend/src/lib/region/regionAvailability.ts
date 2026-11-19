/**
 * Pilot coverage check. Supported ISO 3166-1 alpha-2 country codes come from
 * NEXT_PUBLIC_SUPPORTED_COUNTRIES (comma-separated), falling back to the
 * pilot default. An unknown or missing country never blocks the user: it is
 * reported as "unknown" so the UI can ask for a country instead.
 */

export const DEFAULT_SUPPORTED_COUNTRIES = ["NG"] as const;

export type RegionStatus = "supported" | "unsupported" | "unknown";

export interface RegionAvailability {
  status: RegionStatus;
  countryCode: string | null;
  title: string;
  message: string;
  nextSteps: string[];
}

/** Parses a comma-separated list of country codes; invalid entries are dropped. */
export function parseSupportedCountries(raw: string | undefined | null): string[] {
  if (!raw) return [...DEFAULT_SUPPORTED_COUNTRIES];
  const codes = raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return codes.length > 0 ? Array.from(new Set(codes)) : [...DEFAULT_SUPPORTED_COUNTRIES];
}

export function getSupportedCountries(): string[] {
  return parseSupportedCountries(process.env.NEXT_PUBLIC_SUPPORTED_COUNTRIES);
}

/** Normalizes user input such as " ng " to "NG"; returns null when invalid. */
export function normalizeCountryCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function getRegionAvailability(
  input: string | null | undefined,
  supported: readonly string[] = getSupportedCountries(),
): RegionAvailability {
  const countryCode = normalizeCountryCode(input);

  if (!countryCode) {
    return {
      status: "unknown",
      countryCode: null,
      title: "Choose your country",
      message: "Select your country to check whether trading is available where you are.",
      nextSteps: [],
    };
  }

  if (supported.includes(countryCode)) {
    return {
      status: "supported",
      countryCode,
      title: "Trading is available",
      message: "Trades can be created in your region.",
      nextSteps: [],
    };
  }

  return {
    status: "unsupported",
    countryCode,
    title: "Not available in your region yet",
    message:
      "Amana pilot trading is not yet available where you are, so new trades and deposits are paused for your location.",
    nextSteps: [
      "Your existing trades and funds remain accessible.",
      "Check the Help page for the current list of supported regions.",
      "Contact support to be notified when your region opens.",
    ],
  };
}
