import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { UnifiedSearchDropdown } from "../UnifiedSearchDropdown";

const mocks = vi.hoisted(() => ({ search: vi.fn(), web: vi.fn() }));
vi.mock("@/lib/scoutPeopleSearch", () => ({ SCOUT_PEOPLE_PAGE_SIZE: 50, scoutSearchTarget: (q: string) => `/scout?q=${encodeURIComponent(q)}`, searchScoutPeople: mocks.search }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useVoiceSearch", () => ({ useVoiceSearch: () => ({ supported: false, status: "idle" }) }));
vi.mock("../PublicWebSearchResults", () => ({ PublicWebSearchResults: () => { mocks.web(); return null; } }));
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
describe("Hero Scout search", () => {
  it("previews real UX Designer users and submits the unchanged phrase directly to Scout for guests", async () => {
    mocks.search.mockResolvedValue({ users: [{ user_id: "real-person", full_name: "Ada", role: "UX Designer", location: "Bali", avatar_url: null }], hasMore: false });
    render(<MemoryRouter><UnifiedSearchDropdown variant="hero" /><Location /></MemoryRouter>);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "UX Designer" } });
    await screen.findByRole("button", { name: /Ada UX Designer/ });
    expect(mocks.search).toHaveBeenCalledWith("UX Designer", 0);
    expect(mocks.web).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search Scout UX Designer" }));
    expect(screen.getByRole("status")).toHaveTextContent("/scout?q=UX%20Designer");
  });
});