import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateFacts } from "@/lib/matching/evaluate";

const m = vi.hoisted(() => ({ load: vi.fn(), navigate: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "company-1" } }) }));
vi.mock("@/lib/matching/candidates", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/matching/candidates")>()), loadCandidatePool: m.load }));
vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useNavigate: () => m.navigate }));
vi.mock("@/components/brand/KretopiaLoader", () => ({ KretopiaLoader: ({ label }: { label?: string }) => <span role="progressbar">{label}</span>, KretopiaSpinner: () => <span data-testid="spinner" /> }));
// Radix Select needs pointer APIs jsdom lacks; a native select has the same value/onChange contract.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => <select aria-label="Craft" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));

import { CriteriaMatch } from "../CriteriaMatch";

const facts = (over: Partial<CandidateFacts>): CandidateFacts => ({ userId: "u", fullName: "Someone", role: null, bio: null, location: null, skills: [], links: {}, synced: {}, credits: [], ...over });
const POOL: CandidateFacts[] = [
  facts({ userId: "ana", fullName: "Ana Lopez", role: "TikTok creator", links: { tiktok: true }, credits: [{ projectName: "Swimwear drop", evidence: "co_signed" }] }),
  facts({ userId: "ben", fullName: "Ben Carter", role: "Photographer", location: "Paris, France" }),
  facts({ userId: "cleo", fullName: "Cleo Park" }),
];

const onShortlist = vi.fn();
const view = (props: Partial<React.ComponentProps<typeof CriteriaMatch>> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <CriteriaMatch onShortlist={onShortlist} shortlisted={{}} savingId={null} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const search = () => fireEvent.click(screen.getByRole("button", { name: /Find matches/ }));
const chooseCreator = () => fireEvent.change(screen.getByLabelText("Craft"), { target: { value: "creator" } });
const card = (name: string) => within(screen.getByText(name).closest(".rounded-lg") as HTMLElement);

beforeEach(() => {
  m.load.mockReset();
  m.navigate.mockReset();
  onShortlist.mockReset();
  m.load.mockResolvedValue({ pool: POOL, examined: 3, truncated: false });
});
afterEach(cleanup);

describe("search by criteria", () => {
  it("asks for at least one criterion before it searches anything", () => {
    view();
    search();
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one criterion.");
    expect(m.load).not.toHaveBeenCalled();
  });

  it("explains a criterion it cannot use, instead of failing silently", () => {
    view();
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), { target: { value: "P" } });
    search();
    expect(screen.getByRole("alert")).toHaveTextContent("Give a place of at least 2 characters.");
  });

  it("checks every profile with a completed Passport, searcher excluded, and shows a fit in words with its coverage", async () => {
    view();
    chooseCreator();
    search();
    await screen.findByText("Ana Lopez");
    expect(m.load).toHaveBeenCalledWith(expect.anything(), { excludeUserId: "company-1" });
    expect(screen.getByRole("status")).toHaveTextContent("3 profiles with a completed Passport checked");

    const ana = card("Ana Lopez");
    expect(ana.getByText("Meets your requirements")).toBeTruthy();
    expect(ana.getByText("Checked 1 of 1 criterion")).toBeTruthy();
    expect(ana.getByText(/Works as Creator/)).toBeTruthy();
    // no role on the profile: nothing could be checked, which is not the same as a match
    expect(card("Cleo Park").getByText("Not enough information")).toBeTruthy();
    expect(card("Cleo Park").getByText("Checked 0 of 1 criterion")).toBeTruthy();
  });

  it("counts a missing link as a requirement not met, which sends the profile behind the button", async () => {
    view();
    chooseCreator();
    fireEvent.click(screen.getByLabelText("TikTok"));
    search();
    await screen.findByText("Ana Lopez");
    expect(card("Ana Lopez").getByText("Checked 2 of 2 criteria")).toBeTruthy();
    expect(screen.queryByText("Cleo Park")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show 2 profiles that don't meet a requirement/ }));
    expect(card("Cleo Park").getByText("Doesn't meet a requirement")).toBeTruthy();
  });

  it("shows no percentage or score anywhere in the results", async () => {
    view();
    chooseCreator();
    search();
    await screen.findByText("Ana Lopez");
    expect(document.body.textContent).not.toMatch(/%|percent|\bscore\b/i);
  });

  it("puts the best fit first and keeps profiles that miss a requirement behind a button", async () => {
    view();
    chooseCreator();
    search();
    await screen.findByText("Ana Lopez");
    expect(screen.queryByText("Ben Carter")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show 1 profile that doesn't meet a requirement/ }));
    expect(card("Ben Carter").getByText("Doesn't meet a requirement")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Hide 1 profile/ }));
    expect(screen.queryByText("Ben Carter")).toBeNull();
    const names = screen.getAllByText(/Ana Lopez|Cleo Park/).map((n) => n.textContent);
    expect(names).toEqual(["Ana Lopez", "Cleo Park"]);
  });

  it("never claims the audience fits: a required audience stays 'not provided' and keeps the profile at 'some requirements'", async () => {
    view();
    chooseCreator();
    fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "women 18 to 24 in the US" } });
    search();
    await screen.findByText("Ana Lopez");
    const ana = card("Ana Lopez");
    expect(ana.getByText("Meets some requirements")).toBeTruthy();
    fireEvent.click(ana.getByRole("button", { name: /How this was checked/ }));
    expect(ana.getByText("Audience: women 18 to 24 in the US")).toBeTruthy();
    expect(ana.getByText(/Audience data not provided/)).toBeTruthy();
  });

  it("offers a minimum audience only once a platform is chosen, and says what it can be checked against", () => {
    view();
    expect(screen.queryByLabelText(/Minimum audience/)).toBeNull();
    fireEvent.click(screen.getByLabelText("YouTube"));
    expect(screen.getByLabelText(/Minimum audience/)).toBeTruthy();
    expect(screen.getByText(/only knows a follower count when the account is connected/)).toBeTruthy();
  });

  it("lets each group be marked required or preferred", async () => {
    view();
    const skills = screen.getByRole("group", { name: "Skills (comma separated): how important" });
    fireEvent.click(within(skills).getByRole("button", { name: "Preferred" }));
    expect(within(skills).getByRole("button", { name: "Preferred" })).toHaveAttribute("aria-pressed", "true");
    expect(within(skills).getByRole("button", { name: "Required" })).toHaveAttribute("aria-pressed", "false");
  });

  it("says so, with a way forward, when nothing meets the criteria", async () => {
    m.load.mockResolvedValue({ pool: [POOL[1]], examined: 1, truncated: false });
    view();
    chooseCreator();
    search();
    expect(await screen.findByText("No profile meets or partly meets these criteria.")).toBeTruthy();
    expect(screen.getByText(/post it as a gig/)).toBeTruthy();
  });

  it("notes a pool that may be incomplete", async () => {
    m.load.mockResolvedValue({ pool: POOL, examined: 300, truncated: true });
    view();
    chooseCreator();
    search();
    expect(await screen.findByText(/some profiles may be missing/)).toBeTruthy();
  });

  it("reports a failure to load and offers to try again", async () => {
    m.load.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ pool: POOL, examined: 3, truncated: false });
    view();
    chooseCreator();
    search();
    const alert = await screen.findByText("Couldn't load the profiles to check.");
    fireEvent.click(within(alert.closest("div") as HTMLElement).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ana Lopez")).toBeTruthy();
    expect(m.load).toHaveBeenCalledTimes(2);
  });
});

describe("next steps", () => {
  it("opens the Passport through the existing profile route", async () => {
    view();
    chooseCreator();
    search();
    await screen.findByText("Ana Lopez");
    fireEvent.click(card("Ana Lopez").getByRole("button", { name: /View Passport/ }));
    expect(m.navigate).toHaveBeenCalledWith("/profile/ana");
  });

  it("shortlists with the reasons that were found, and no score", async () => {
    view();
    chooseCreator();
    search();
    await screen.findByText("Ana Lopez");
    fireEvent.click(card("Ana Lopez").getByRole("button", { name: /Shortlist/ }));
    expect(onShortlist).toHaveBeenCalledWith("ana", "Ana Lopez", ['Works as Creator: Role: "TikTok creator"']);
  });

  it("offers to message someone already shortlisted", async () => {
    view({ shortlisted: { ana: true } });
    chooseCreator();
    search();
    await screen.findByText("Ana Lopez");
    fireEvent.click(card("Ana Lopez").getByRole("button", { name: "Message" }));
    expect(m.navigate).toHaveBeenCalledWith("/messages?to=ana");
    expect(card("Ana Lopez").queryByRole("button", { name: /Shortlist/ })).toBeNull();
  });
});
