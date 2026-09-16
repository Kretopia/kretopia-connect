import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleStamp } from "../RoleStamp";

function renderStamp(props: React.ComponentProps<typeof RoleStamp>) {
  return render(
    <TooltipProvider>
      <RoleStamp {...props} />
    </TooltipProvider>,
  );
}

describe("RoleStamp", () => {
  it("labels the stamp with the inferred craft, not a generic level badge", () => {
    renderStamp({ role: "Photographer" });
    expect(screen.getByText(/Photo & Video — Kretopia Passport/)).toBeInTheDocument();
  });

  it("falls back to Creator for an unrecognized or missing role", () => {
    renderStamp({ role: null });
    expect(screen.getByText(/Creator — Kretopia Passport/)).toBeInTheDocument();
  });

  it("respects the requested size", () => {
    renderStamp({ role: "Musician", size: 48 });
    const stamp = screen.getByText(/Music — Kretopia Passport/).parentElement;
    expect(stamp).toHaveStyle({ width: "48px", height: "48px" });
  });
});
