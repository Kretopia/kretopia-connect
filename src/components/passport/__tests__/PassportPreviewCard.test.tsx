import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PassportPreviewCard } from "../PassportPreviewCard";

function renderCard(props: Partial<React.ComponentProps<typeof PassportPreviewCard>> = {}) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <PassportPreviewCard
          userId="user-1"
          fullName="Ava Chen"
          avatarUrl="https://example.com/ava.jpg"
          role="Photographer"
          matchScore={87}
          reason="Shares your Los Angeles base"
          {...props}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe("PassportPreviewCard", () => {
  it("links to the person's own Passport", () => {
    renderCard();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/profile/user-1");
  });

  it("shows their name, role, match score and reason", () => {
    renderCard();
    expect(screen.getByText("Ava Chen")).toBeInTheDocument();
    expect(screen.getByText("Photographer")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText("Shares your Los Angeles base")).toBeInTheDocument();
  });

  it("falls back to Creator when role is missing, matching the Passport-wide default", () => {
    renderCard({ role: null });
    expect(screen.getByText("Creator")).toBeInTheDocument();
  });
});
