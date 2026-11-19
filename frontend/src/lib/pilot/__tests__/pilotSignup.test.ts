import { ApiError } from "@/lib/api/client";
import {
  PILOT_REGISTRATION_ENDPOINT,
  classifyPilotSignupError,
  isValidPilotEmail,
  submitPilotSignup,
} from "../pilotSignup";

describe("isValidPilotEmail", () => {
  it("accepts ordinary addresses and trims whitespace", () => {
    expect(isValidPilotEmail("farmer@example.com")).toBe(true);
    expect(isValidPilotEmail("  farmer@example.com  ")).toBe(true);
  });

  it("rejects malformed or oversized addresses", () => {
    expect(isValidPilotEmail("")).toBe(false);
    expect(isValidPilotEmail("no-at-sign.com")).toBe(false);
    expect(isValidPilotEmail("a b@example.com")).toBe(false);
    expect(isValidPilotEmail(`${"a".repeat(250)}@x.co`)).toBe(false);
  });
});

describe("classifyPilotSignupError", () => {
  it("maps 409 to duplicate and everything else to failure", () => {
    expect(classifyPilotSignupError(new ApiError(409, "exists"))).toBe("duplicate");
    expect(classifyPilotSignupError(new ApiError(400, "bad"))).toBe("failure");
    expect(classifyPilotSignupError(new ApiError(500, "boom"))).toBe("failure");
    expect(classifyPilotSignupError(new TypeError("Failed to fetch"))).toBe("failure");
  });
});

describe("submitPilotSignup", () => {
  it("posts a normalized payload and resolves to success on 2xx", async () => {
    const send = jest.fn().mockResolvedValue({});
    const state = await submitPilotSignup({ email: " Farmer@Example.com ", name: " Ada " }, send);

    expect(state).toBe("success");
    expect(send).toHaveBeenCalledWith(PILOT_REGISTRATION_ENDPOINT, {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email: "farmer@example.com", name: "Ada" }),
    });
  });

  it("resolves to duplicate when the email is already registered", async () => {
    const send = jest.fn().mockRejectedValue(new ApiError(409, "already"));
    await expect(submitPilotSignup({ email: "a@b.co" }, send)).resolves.toBe("duplicate");
  });

  it("resolves to failure on server or network errors without throwing", async () => {
    const send = jest.fn().mockRejectedValue(new ApiError(503, "down"));
    await expect(submitPilotSignup({ email: "a@b.co" }, send)).resolves.toBe("failure");
  });

  it("does not call the server for an invalid email", async () => {
    const send = jest.fn();
    await expect(submitPilotSignup({ email: "nope" }, send)).resolves.toBe("failure");
    expect(send).not.toHaveBeenCalled();
  });
});
