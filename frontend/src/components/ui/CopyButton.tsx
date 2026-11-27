"use client";

import { useState } from "react";
import { Check, Clipboard } from "lucide-react";

export interface CopyButtonProps {
  value: string;
  label?: string;
  successDurationMs?: number;
  className?: string;
  iconSize?: number;
}

/**
 * Accessible copy-to-clipboard button with success/error feedback.
 * Works for public keys, transaction IDs, evidence references, etc.
 */
export function CopyButton({
  value,
  label = "Copy",
  successDurationMs = 1500,
  className = "",
  iconSize = 14,
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      setTimeout(() => setState("idle"), successDurationMs);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  const ariaLabel =
    state === "copied"
      ? "Copied!"
      : state === "error"
      ? "Copy failed — try again"
      : label;

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold rounded ${className}`}
    >
      {state === "copied" ? (
        <Check
          aria-hidden="true"
          style={{ width: iconSize, height: iconSize }}
          className="text-emerald"
        />
      ) : (
        <Clipboard
          aria-hidden="true"
          style={{ width: iconSize, height: iconSize }}
          className={state === "error" ? "text-status-danger" : undefined}
        />
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {state === "copied" ? "Copied to clipboard" : state === "error" ? "Copy failed" : ""}
      </span>
    </button>
  );
}
