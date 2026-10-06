import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { FinishProfileBanner } from "../FinishProfileBanner";

describe("FinishProfileBanner", () => {
  it("puts the setup wizard one clear click away from the profile", () => {
    render(
      <MemoryRouter>
        <FinishProfileBanner />
      </MemoryRouter>,
    );
    expect(screen.getByRole("complementary", { name: "Finish setting up your profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finish setup" })).toHaveAttribute("href", "/onboarding");
  });
});
