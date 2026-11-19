import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import {
  EventChannelPreferences,
  defaultEventChannels,
  normalizeEventChannels,
  toggleChannel,
} from "../EventChannelPreferences";

jest.mock("@/lib/api/client", () => ({
  request: jest.fn(),
}));

import { request } from "@/lib/api/client";
const mockedRequest = request as jest.MockedFunction<typeof request>;

beforeEach(() => {
  mockedRequest.mockReset();
});

describe("normalizeEventChannels", () => {
  it("returns in-app defaults for all four events when payload is empty", () => {
    expect(normalizeEventChannels(undefined)).toEqual(defaultEventChannels());
    expect(normalizeEventChannels(null)).toEqual(defaultEventChannels());
    expect(normalizeEventChannels([])).toEqual(defaultEventChannels());
    expect(normalizeEventChannels("nope")).toEqual(defaultEventChannels());
  });

  it("reads the legacy channel map", () => {
    const result = normalizeEventChannels({ deposit: ["email", "push"] });
    expect(result.deposit).toEqual(["email", "push"]);
    expect(result.delivery).toEqual(["in-app"]);
  });

  it("reads the { channels, quietHours } blob format", () => {
    const result = normalizeEventChannels({
      channels: { settlement: ["email"] },
      quietHours: { quietHoursStart: "22:00", quietHoursEnd: "07:00", timezone: "UTC" },
    });
    expect(result.settlement).toEqual(["email"]);
  });

  it("drops unknown events, unknown channels and duplicates", () => {
    const result = normalizeEventChannels({
      dispute: ["email", "email", "sms", "in-app"],
      unknownEvent: ["email"],
      deposit: "email",
    });
    expect(result.dispute).toEqual(["email", "in-app"]);
    expect(result).not.toHaveProperty("unknownEvent");
    expect(result.deposit).toEqual(["in-app"]);
  });
});

describe("toggleChannel", () => {
  it("adds and removes a channel without mutating the input", () => {
    const base = defaultEventChannels();
    const added = toggleChannel(base, "deposit", "email", true);
    expect(added.deposit).toEqual(["in-app", "email"]);
    expect(base.deposit).toEqual(["in-app"]);

    const removed = toggleChannel(added, "deposit", "in-app", false);
    expect(removed.deposit).toEqual(["email"]);
  });

  it("does not duplicate a channel that is already enabled", () => {
    const result = toggleChannel(defaultEventChannels(), "dispute", "in-app", true);
    expect(result.dispute).toEqual(["in-app"]);
  });
});

describe("<EventChannelPreferences />", () => {
  it("loads saved preferences and reflects them in the checkboxes", async () => {
    mockedRequest.mockResolvedValueOnce({ delivery: ["push"] });
    render(<EventChannelPreferences token="tok" />);

    await waitFor(() =>
      expect(screen.getByLabelText("Delivery via Push")).toBeChecked(),
    );
    expect(screen.getByLabelText("Delivery via In-app")).not.toBeChecked();
    expect(screen.getByLabelText("Deposit via In-app")).toBeChecked();
    expect(mockedRequest).toHaveBeenCalledWith("/notifications/preferences", { token: "tok" });
  });

  it("sends the full per-event map on save", async () => {
    mockedRequest.mockResolvedValueOnce({});
    render(<EventChannelPreferences token="tok" />);
    await waitFor(() => expect(screen.getByLabelText("Dispute via Email")).not.toBeDisabled());

    fireEvent.click(screen.getByLabelText("Dispute via Email"));
    mockedRequest.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Save channels" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Notification channels saved."),
    );
    const [endpoint, options] = mockedRequest.mock.calls[mockedRequest.mock.calls.length - 1];
    expect(endpoint).toBe("/notifications/preferences");
    expect(options).toMatchObject({ method: "PUT", token: "tok" });
    const body = JSON.parse((options as { body: string }).body);
    expect(Object.keys(body).sort()).toEqual(["delivery", "deposit", "dispute", "settlement"]);
    expect(body.dispute).toEqual(["in-app", "email"]);
  });

  it("shows an alert when saving fails", async () => {
    mockedRequest.mockResolvedValueOnce({});
    render(<EventChannelPreferences token="tok" />);
    await waitFor(() => expect(screen.getByLabelText("Deposit via Push")).not.toBeDisabled());

    mockedRequest.mockRejectedValueOnce(new Error("Server exploded"));
    fireEvent.click(screen.getByRole("button", { name: "Save channels" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
  });

  it("disables controls and asks to sign in when there is no token", () => {
    render(<EventChannelPreferences token={null} />);
    expect(screen.getByText("Sign in to choose notification channels.")).toBeInTheDocument();
    expect(screen.getByLabelText("Settlement via Email")).toBeDisabled();
    expect(mockedRequest).not.toHaveBeenCalled();
  });
});
