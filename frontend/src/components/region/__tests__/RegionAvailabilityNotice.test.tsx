import React from "react";
import { render, screen } from "@testing-library/react";
import { RegionAvailabilityNotice } from "../RegionAvailabilityNotice";

describe("<RegionAvailabilityNotice />", () => {
  it("renders nothing for a supported region", () => {
    const { container } = render(
      <RegionAvailabilityNotice countryCode="NG" supportedCountries={["NG"]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("explains unsupported regions and links to supported regions", () => {
    render(<RegionAvailabilityNotice countryCode="US" supportedCountries={["NG"]} />);
    const notice = screen.getByTestId("region-availability-notice");
    expect(notice).toHaveAttribute("data-status", "unsupported");
    expect(screen.getByRole("heading", { name: "Not available in your region yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View supported regions" })).toHaveAttribute("href", "/help");
    expect(screen.getByText(/Contact support/i)).toBeInTheDocument();
  });

  it("asks for a country without showing a blocking link when unknown", () => {
    render(<RegionAvailabilityNotice countryCode={null} supportedCountries={["NG"]} />);
    expect(screen.getByTestId("region-availability-notice")).toHaveAttribute("data-status", "unknown");
    expect(screen.getByText("Choose your country")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
