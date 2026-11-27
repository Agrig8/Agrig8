/**
 * Issue #37 — CopyButton accessibility and feedback tests.
 */

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CopyButton } from "../CopyButton";

function mockClipboard(resolves: boolean) {
  const writeText = jest.fn().mockImplementation(() =>
    resolves ? Promise.resolve() : Promise.reject(new Error("denied")),
  );
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("CopyButton", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("renders with default label", () => {
    mockClipboard(true);
    render(<CopyButton value="GABC123" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("renders with custom label", () => {
    mockClipboard(true);
    render(<CopyButton value="tx-abc" label="Copy TX ID" />);
    expect(screen.getByRole("button", { name: "Copy TX ID" })).toBeInTheDocument();
  });

  it("calls clipboard.writeText with the value on click", async () => {
    const writeText = mockClipboard(true);
    render(<CopyButton value="GXYZ789" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("GXYZ789"));
  });

  it("shows Copied! aria-label after success", async () => {
    mockClipboard(true);
    render(<CopyButton value="tx-id-1" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument(),
    );
  });

  it("reverts to idle after successDurationMs", async () => {
    mockClipboard(true);
    render(<CopyButton value="key" successDurationMs={1500} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument(),
    );
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("shows error label when clipboard write fails", async () => {
    mockClipboard(false);
    render(<CopyButton value="key" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Copy failed — try again" }),
      ).toBeInTheDocument(),
    );
  });

  it("announces status via live region", async () => {
    mockClipboard(true);
    render(<CopyButton value="evidence-ref-42" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toBe("Copied to clipboard");
    });
  });
});
