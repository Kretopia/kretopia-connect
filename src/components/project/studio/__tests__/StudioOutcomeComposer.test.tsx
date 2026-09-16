import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { StudioOutcomeComposer } from "../StudioOutcomeComposer";

/**
 * Smoke coverage for the room's one direct-command input. Mainly guards
 * the header avatar swap (generic Sparkles icon -> a real KretoCharacter)
 * so a future edit can't silently drop Kreto's presence here without a
 * test noticing.
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) } },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/brand/KretoCharacter", () => ({
  KretoCharacter: ({ variant, size }: { variant?: string; size?: number }) => (
    <div data-testid="kreto-avatar" data-variant={variant} data-size={size} />
  ),
}));

function renderComposer() {
  return render(
    <MemoryRouter>
      <StudioOutcomeComposer projectId="p1" projectTitle="Test Project" />
    </MemoryRouter>,
  );
}

describe("StudioOutcomeComposer", () => {
  it("shows Kreto's own avatar next to its direct-command line, not a generic icon", () => {
    renderComposer();
    expect(screen.getByText("Tell Kreto what you need")).toBeInTheDocument();
    const avatar = screen.getByTestId("kreto-avatar");
    expect(avatar).toHaveAttribute("data-size", "40");
  });

  it("still renders the prompt input and quick-start chips", () => {
    renderComposer();
    expect(screen.getByPlaceholderText(/Create a sponsor deck/i)).toBeInTheDocument();
    expect(screen.getByText("Sponsor deck")).toBeInTheDocument();
  });
});
