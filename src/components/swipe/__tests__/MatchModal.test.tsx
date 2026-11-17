import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));
vi.mock("react-dom-confetti", () => ({ default: () => null }));
vi.mock("@/components/project/StartProjectFromMatchDialog", () => ({ StartProjectFromMatchDialog: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), functions: { invoke: vi.fn() } } }));
import { MatchModal } from "../MatchModal";

const matchedProfile = { user_id: "creator", full_name: "Ava Chen", avatar_url: null, role: "Designer" };

describe("Mutual Match celebration", () => {
  it("celebrates reciprocity and offers equal message and collaboration actions", () => {
    const onOpenChange = vi.fn();
    render(<MemoryRouter><MatchModal open onOpenChange={onOpenChange} matchedProfile={matchedProfile} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Congratulations — you have a match!" })).toBeVisible();
    expect(screen.getByText(/You and Ava Chen chose each other/)).toBeVisible();
    const message = screen.getByRole("button", { name: "Message" });
    const project = screen.getByRole("button", { name: "Create & collaborate" });
    expect(message).toHaveClass("h-12");
    expect(project).toHaveClass("h-12");
    fireEvent.click(project);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
