import { ApiError, request } from "@/lib/api/client";

/**
 * Public pilot registration. The endpoint is expected to answer:
 *   201 - registered
 *   409 - this email is already registered (duplicate)
 *   400 - invalid input (validation message from the server, if any)
 * Anything else, including network failures, is reported as a generic failure
 * so the user always gets a clear next action.
 */

export const PILOT_REGISTRATION_ENDPOINT = "/pilot/registrations";

export type PilotSignupState = "idle" | "submitting" | "success" | "duplicate" | "failure";

export interface PilotSignupFeedback {
  state: PilotSignupState;
  title: string;
  message: string;
}

export const PILOT_SIGNUP_FEEDBACK: Record<PilotSignupState, PilotSignupFeedback> = {
  idle: {
    state: "idle",
    title: "Join the pilot",
    message: "Enter your email to request access to the pilot.",
  },
  submitting: {
    state: "submitting",
    title: "Submitting…",
    message: "Sending your pilot request.",
  },
  success: {
    state: "success",
    title: "You're on the list",
    message: "Thanks for registering. We'll email you when your pilot access is ready.",
  },
  duplicate: {
    state: "duplicate",
    title: "Already registered",
    message: "This email is already registered for the pilot. No action is needed.",
  },
  failure: {
    state: "failure",
    title: "We couldn't register you",
    message: "Something went wrong on our side. Please try again in a few minutes.",
  },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPilotEmail(email: string): boolean {
  const value = email.trim();
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/** Maps a thrown error from the registration request to a feedback state. */
export function classifyPilotSignupError(error: unknown): PilotSignupState {
  if (error instanceof ApiError) {
    if (error.status === 409) return "duplicate";
    return "failure";
  }
  return "failure";
}

export interface PilotSignupInput {
  email: string;
  name?: string;
}

/**
 * Submits a pilot registration and resolves with the resulting state.
 * Never throws: every outcome is expressed as a state.
 */
export async function submitPilotSignup(
  input: PilotSignupInput,
  send: typeof request = request,
): Promise<PilotSignupState> {
  const email = input.email.trim().toLowerCase();
  if (!isValidPilotEmail(email)) return "failure";

  try {
    await send(PILOT_REGISTRATION_ENDPOINT, {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, ...(input.name ? { name: input.name.trim() } : {}) }),
    });
    return "success";
  } catch (error) {
    return classifyPilotSignupError(error);
  }
}
