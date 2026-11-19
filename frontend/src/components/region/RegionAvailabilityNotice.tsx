"use client";

import React from "react";
import Link from "next/link";
import { getRegionAvailability } from "@/lib/region/regionAvailability";

interface RegionAvailabilityNoticeProps {
  /** ISO 3166-1 alpha-2 code selected by or known for the user. */
  countryCode: string | null | undefined;
  /** Optional override for the supported list (defaults to env config). */
  supportedCountries?: readonly string[];
}

/**
 * Explains pilot coverage. Renders nothing when the region is supported, so
 * it can be placed unconditionally on trade-creation and onboarding screens.
 */
export function RegionAvailabilityNotice({
  countryCode,
  supportedCountries,
}: RegionAvailabilityNoticeProps) {
  const availability = getRegionAvailability(countryCode, supportedCountries);

  if (availability.status === "supported") {
    return null;
  }

  const isUnsupported = availability.status === "unsupported";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="region-availability-notice"
      data-status={availability.status}
      className={
        isUnsupported
          ? "rounded-xl border border-status-warning p-4 space-y-2"
          : "rounded-xl border border-border-default p-4 space-y-2"
      }
    >
      <h2 className="text-base font-semibold text-text-primary">{availability.title}</h2>
      <p className="text-sm text-text-secondary">{availability.message}</p>
      {availability.nextSteps.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
          {availability.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}
      {isUnsupported && (
        <Link href="/help" className="text-sm underline text-text-primary">
          View supported regions
        </Link>
      )}
    </div>
  );
}
