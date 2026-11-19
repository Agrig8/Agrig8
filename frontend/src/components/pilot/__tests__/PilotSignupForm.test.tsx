import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PilotSignupForm } from "../PilotSignupForm";
import { ApiError, request } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  request: jest.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const mockedRequest = request as jest.MockedFunction<typeof request>;

function fillAndSubmit(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Request pilot access" }));
}

beforeEach(() => mockedRequest.mockReset());

describe("<PilotSignupForm />", () => {
  it("shows success after a registration is accepted", async () => {
    mockedRequest.mockResolvedValueOnce({});
    render(<PilotSignupForm />);
    fillAndSubmit("farmer@example.com");

    expect(await screen.findByText("You're on the list")).toBeInTheDocument();
    expect(screen.getByTestId("pilot-signup-feedback")).toHaveAttribute("data-state", "success");
    expect(screen.queryByRole("button", { name: "Request pilot access" })).toBeNull();
  });

  it("shows a duplicate message for an already-registered email", async () => {
    mockedRequest.mockRejectedValueOnce(new ApiError(409, "exists"));
    render(<PilotSignupForm />);
    fillAndSubmit("farmer@example.com");

    expect(await screen.findByText("Already registered")).toBeInTheDocument();
    expect(screen.getByTestId("pilot-signup-feedback")).toHaveAttribute("data-state", "duplicate");
  });

  it("shows an alert on failure and lets the user retry", async () => {
    mockedRequest.mockRejectedValueOnce(new ApiError(500, "boom"));
    render(<PilotSignupForm />);
    fillAndSubmit("farmer@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong on our side/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("validates the email inline without calling the server", () => {
    render(<PilotSignupForm />);
    fillAndSubmit("not-an-email");

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it("disables the form while submitting", async () => {
    let resolve!: () => void;
    mockedRequest.mockReturnValueOnce(new Promise<never>((r) => { resolve = () => r({} as never); }));
    render(<PilotSignupForm />);
    fillAndSubmit("farmer@example.com");

    await waitFor(() => expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled());
    expect(screen.getByLabelText("Email")).toBeDisabled();
    resolve();
    expect(await screen.findByText("You're on the list")).toBeInTheDocument();
  });
});
