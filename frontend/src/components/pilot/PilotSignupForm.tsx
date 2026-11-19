"use client";

import React, { useId, useState } from "react";
import {
  PILOT_SIGNUP_FEEDBACK,
  isValidPilotEmail,
  submitPilotSignup,
  type PilotSignupState,
} from "@/lib/pilot/pilotSignup";

/**
 * Public pilot registration form with explicit success, duplicate, and
 * failure states. Validation happens before submit so typos are reported
 * inline instead of as a registration failure.
 */
export function PilotSignupForm() {
  const emailId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<PilotSignupState>("idle");

  const emailValid = isValidPilotEmail(email);
  const showEmailError = touched && !emailValid;
  const feedback = PILOT_SIGNUP_FEEDBACK[state];
  const submitting = state === "submitting";
  const finished = state === "success" || state === "duplicate";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!emailValid || submitting) return;
    setState("submitting");
    setState(await submitPilotSignup({ email }));
  }

  return (
    <section aria-labelledby={`${emailId}-heading`} className="space-y-4">
      <h2 id={`${emailId}-heading`} className="text-lg font-semibold text-text-primary">
        {feedback.title}
      </h2>
      <p
        role={state === "failure" ? "alert" : "status"}
        aria-live="polite"
        data-testid="pilot-signup-feedback"
        data-state={state}
        className="text-sm text-text-secondary"
      >
        {feedback.message}
      </p>
      {!finished && (
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={emailId} className="block text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              value={email}
              disabled={submitting}
              aria-invalid={showEmailError}
              aria-describedby={showEmailError ? errorId : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === "failure") setState("idle");
              }}
              onBlur={() => setTouched(true)}
              className="w-full rounded-md border border-border-default bg-transparent px-3 py-2 text-sm"
            />
            {showEmailError && (
              <p id={errorId} className="text-sm text-status-error">
                Enter a valid email address.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Submitting…" : state === "failure" ? "Try again" : "Request pilot access"}
          </button>
        </form>
      )}
    </section>
  );
}
