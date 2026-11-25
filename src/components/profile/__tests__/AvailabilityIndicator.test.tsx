import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));

import { AvailabilityIndicator } from "../AvailabilityIndicator";

describe("AvailabilityIndicator: a visitor is told only what the member chose", () => {
  it("says nothing when the profile has no availability status", () => {
    const { container } = render(<AvailabilityIndicator isOwnProfile={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Available for work/)).toBeNull();
  });

  it("says nothing for an empty or unknown status", () => {
    for (const status of ["", "something-else"]) {
      const { container, unmount } = render(<AvailabilityIndicator isOwnProfile={false} status={status} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("shows the status the member chose, with their note", () => {
    render(<AvailabilityIndicator isOwnProfile={false} status="busy" note="Back in March" />);
    expect(screen.getByText("Currently busy")).toBeInTheDocument();
    expect(screen.getByText(/Back in March/)).toBeInTheDocument();
  });

  it("still lets the owner set it when nothing is set yet", () => {
    render(<AvailabilityIndicator isOwnProfile />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
