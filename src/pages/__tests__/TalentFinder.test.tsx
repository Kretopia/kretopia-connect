import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ upsert: vi.fn(), invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => {
  const select = () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) });
  return { supabase: { from: () => ({ select, upsert: m.upsert }), functions: { invoke: m.invoke } } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "company-1" } }) }));
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => ({ isBusiness: true }) }));
vi.mock("@/hooks/useFeatureGate", () => ({ useFeatureGate: () => ({ guard: () => true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/components/PageTransition", () => ({ PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/FreeTierGate", () => ({ FreeTierGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: () => null }));
vi.mock("@/components/studio-reference/StudioFeatureShell", () => ({ StudioFeatureShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/brand/KretopiaLoader", () => ({ KretopiaSpinner: () => <span />, KretopiaLoader: () => <span /> }));
// The criteria search has its own tests; here it only has to be wired to the page's shortlist.
vi.mock("@/components/match/CriteriaMatch", () => ({
  CriteriaMatch: ({ brief, onBriefChange, onShortlist }: { brief: string; onBriefChange: (v: string) => void; onShortlist: (id: string, name: string, reasons: string[]) => void }) => {
    const [draft, setDraft] = useState("");
    return (
      <div>
        <input aria-label="criteria brief" value={brief} onChange={(e) => onBriefChange(e.target.value)} />
        <input aria-label="criteria draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button onClick={() => onShortlist("t-9", "Cleo Park", ['Works as Creator: Role: "UGC creator"'])}>shortlist from criteria</button>
      </div>
    );
  },
}));

import TalentFinder from "../TalentFinder";

const SUGGESTION = { user_id: "t-1", full_name: "Ana Lopez", role: "Editor", avatar_url: "", location: "Paris", level: 1, xp: 0, professional_skills: [], match_score: 92, match_reasons: ["Edits music videos"], headline: "Fast cutter" };

beforeEach(() => {
  m.upsert.mockReset().mockResolvedValue({ error: null });
  m.invoke.mockReset().mockResolvedValue({ data: { suggestions: [SUGGESTION] }, error: null });
});
afterEach(cleanup);

const view = () => render(<MemoryRouter><TalentFinder /></MemoryRouter>);
const runBrief = async () => {
  fireEvent.change(screen.getByPlaceholderText(/video editor for a music video/i), { target: { value: "I need an editor for a music video" } });
  fireEvent.click(screen.getByRole("button", { name: /Find My Top Matches/ }));
  await screen.findByText("Ana Lopez");
};

describe("Talent Finder", () => {
  it("offers both ways in: describe it, or set criteria", () => {
    view();
    expect(screen.getByRole("tab", { name: "Describe it" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Set criteria" })).toBeTruthy();
  });

  // Regression: each AI result showed "92%" and "Excellent": a number the model made up, which nothing behind it supports.
  it("shows Kreto's results by rank, with no percentage and no score label", async () => {
    view();
    await runBrief();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/%|Excellent|\bStrong\b/);
    expect(screen.getByText("Edits music videos")).toBeTruthy();
  });

  it("still stores the model's own score and reasons when an AI result is shortlisted", async () => {
    view();
    await runBrief();
    fireEvent.click(screen.getByRole("button", { name: /Shortlist/ }));
    await waitFor(() => expect(m.upsert).toHaveBeenCalledOnce());
    expect(m.upsert.mock.calls[0][0]).toMatchObject({ company_user_id: "company-1", talent_user_id: "t-1", match_score: 92, match_reasons: ["Edits music videos"], status: "shortlisted" });
  });

  it("shortlists a profile found by criteria with its reasons and no score", async () => {
    view();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Set criteria" }));
    fireEvent.click(await screen.findByRole("button", { name: "shortlist from criteria" }));
    await waitFor(() => expect(m.upsert).toHaveBeenCalledOnce());
    expect(m.upsert.mock.calls[0][0]).toMatchObject({ talent_user_id: "t-9", match_score: null, match_reasons: ['Works as Creator: Role: "UGC creator"'], status: "shortlisted" });
  });

  it("hands the criteria tab the same brief that the other tab holds, so nothing is typed twice", () => {
    view();
    fireEvent.change(screen.getByPlaceholderText(/video editor for a music video/i), { target: { value: "I need an editor for a music video" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Set criteria" }));
    expect(screen.getByLabelText("criteria brief")).toHaveValue("I need an editor for a music video");
    fireEvent.change(screen.getByLabelText("criteria brief"), { target: { value: "A swimwear brand needs UGC creators" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Describe it" }));
    expect(screen.getByPlaceholderText(/video editor for a music video/i)).toHaveValue("A swimwear brand needs UGC creators");
  });

  it("keeps the criteria being set when the person looks at the other tab and comes back", () => {
    view();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Set criteria" }));
    fireEvent.change(screen.getByLabelText("criteria draft"), { target: { value: "half-built criteria" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Describe it" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Set criteria" }));
    expect(screen.getByLabelText("criteria draft")).toHaveValue("half-built criteria");
  });
});
