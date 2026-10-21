import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateFacts } from "@/lib/matching/evaluate";

const m = vi.hoisted(() => ({ load: vi.fn(), navigate: vi.fn(), read: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "company-1" } }) }));
vi.mock("@/lib/matching/candidates", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/matching/candidates")>()), loadCandidatePool: m.load }));
vi.mock("@/lib/matching/kreto", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/matching/kreto")>()), requestNeedFromBrief: m.read }));
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

import { KretoNeedError } from "@/lib/matching/kreto";
import { CriteriaMatch } from "../CriteriaMatch";

const facts = (over: Partial<CandidateFacts>): CandidateFacts => ({ userId: "u", fullName: "Someone", role: null, bio: null, location: null, skills: [], links: {}, synced: {}, credits: [], ...over });
const POOL: CandidateFacts[] = [
  facts({ userId: "ana", fullName: "Ana Lopez", role: "TikTok creator", links: { tiktok: true }, credits: [{ projectName: "Swimwear drop", evidence: "co_signed" }] }),
  facts({ userId: "ben", fullName: "Ben Carter", role: "Photographer", location: "Paris, France" }),
  facts({ userId: "cleo", fullName: "Cleo Park" }),
];

const onShortlist = vi.fn();
// The page owns the brief; this stands in for it so the textarea behaves as it does there.
function Page(props: Partial<React.ComponentProps<typeof CriteriaMatch>>) {
  const [brief, setBrief] = useState("");
  return <CriteriaMatch brief={brief} onBriefChange={setBrief} onShortlist={onShortlist} shortlisted={{}} savingId={null} {...props} />;
}
const view = (props: Partial<React.ComponentProps<typeof CriteriaMatch>> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter>
        <Page {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const search = () => fireEvent.click(screen.getByRole("button", { name: /Find matches/ }));
const chooseCreator = () => fireEvent.change(screen.getByLabelText("Craft"), { target: { value: "creator" } });
const card = (name: string) => within(screen.getByText(name).closest(".rounded-lg") as HTMLElement);

beforeEach(() => {
  m.load.mockReset();
  m.navigate.mockReset();
  m.read.mockReset();
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
    expect(screen.queryByLabelText(/minimum audience/i)).toBeNull();
    fireEvent.click(screen.getByLabelText("YouTube"));
    expect(screen.getByLabelText(/YouTube minimum audience/i)).toBeTruthy();
    expect(screen.getByText(/only knows a follower count when the account is connected/)).toBeTruthy();
  });

  it("lets each group be marked required or preferred", async () => {
    view();
    const location = screen.getByRole("group", { name: "Location: how important" });
    fireEvent.click(within(location).getByRole("button", { name: "Preferred" }));
    expect(within(location).getByRole("button", { name: "Preferred" })).toHaveAttribute("aria-pressed", "true");
    expect(within(location).getByRole("button", { name: "Required" })).toHaveAttribute("aria-pressed", "false");
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

const BRIEF = "A swimwear brand looking for TikTok creators in Los Angeles who must have verified past work. Budget $500.";
const writeBrief = (text = BRIEF) => fireEvent.change(screen.getByLabelText(/Describe what you need/), { target: { value: text } });
const readButton = () => screen.getByRole("button", { name: /Fill the criteria with Kreto|Re-read my brief|Kreto is reading/ });
const READING = {
  need: {
    craft: { category: "creator", importance: "required" },
    skills: [{ term: "ugc video", importance: "required" }],
    themes: [{ term: "swimwear", importance: "preferred" }],
    location: { text: "Los Angeles", remoteOk: false, importance: "preferred" },
    platforms: [{ platform: "tiktok", importance: "required" }],
    backedWork: "required",
  },
  ignored: ["budget $500"],
};

describe("describe the need to Kreto", () => {
  it("keeps the button off until there is a sentence to read", () => {
    view();
    expect(readButton()).toBeDisabled();
    writeBrief("too short");
    expect(readButton()).toBeDisabled();
    writeBrief();
    expect(readButton()).toBeEnabled();
  });

  it("fills the criteria for the person to check, says how many and what was left out, and searches nothing by itself", async () => {
    m.read.mockResolvedValue(READING);
    view();
    writeBrief();
    fireEvent.click(readButton());

    const summary = await screen.findByText(/Kreto set 6 criteria from your brief: 4 required, 2 preferred/);
    expect(summary.closest("[role=status]")).toHaveTextContent("Not used for matching: budget $500");
    // the criteria are in the form, where they can be changed
    expect(screen.getByLabelText("Craft")).toHaveValue("creator");
    expect(screen.getByRole("list", { name: "Skills, added" })).toHaveTextContent("ugc video");
    expect(screen.getByRole("list", { name: "Has worked on, added" })).toHaveTextContent("swimwear");
    expect(screen.getByRole("textbox", { name: "Location" })).toHaveValue("Los Angeles");
    expect(screen.getByLabelText("TikTok")).toBeChecked();
    expect(screen.getByLabelText("Include this criterion")).toBeChecked();
    // reading a brief is not a search: nobody was looked at
    expect(m.load).not.toHaveBeenCalled();
    expect(screen.queryByText("Ana Lopez")).toBeNull();
  });

  it("sends Kreto the brief and nothing else: no profile, no criteria already typed", async () => {
    m.read.mockResolvedValue(READING);
    view();
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), { target: { value: "Paris" } });
    writeBrief();
    fireEvent.click(readButton());
    await screen.findByText(/Kreto set 6 criteria/);
    expect(m.read).toHaveBeenCalledTimes(1);
    expect(m.read.mock.calls[0].slice(1)).toEqual([BRIEF]);
    expect(m.load).not.toHaveBeenCalled();
  });

  it("lets the person edit what Kreto set before searching, and the search uses the edited criteria", async () => {
    m.read.mockResolvedValue(READING);
    view();
    writeBrief();
    fireEvent.click(readButton());
    await screen.findByText(/Kreto set 6 criteria/);

    fireEvent.click(screen.getByRole("button", { name: "Remove ugc video" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove swimwear" }));
    fireEvent.click(screen.getByLabelText("Include this criterion"));
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("TikTok"));
    search();
    await screen.findByText("Ana Lopez");
    expect(screen.getByText("Checked against: Works as Creator (required)")).toBeTruthy();
  });

  it("names every criterion the results were checked against, required ones marked", async () => {
    view();
    chooseCreator();
    fireEvent.click(screen.getByLabelText("TikTok"));
    search();
    await screen.findByText("Ana Lopez");
    expect(screen.getByText("Checked against: Works as Creator (required) · Present on TikTok (required)")).toBeTruthy();
  });

  it("reads a brief once, however many times the button is pressed while it waits", async () => {
    let finish: (value: typeof READING) => void = () => undefined;
    m.read.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    view();
    writeBrief();
    fireEvent.click(readButton());
    expect(await screen.findByRole("button", { name: /Kreto is reading/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Kreto is reading/ }));
    expect(m.read).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Describe what you need/)).toBeDisabled();
    finish(READING);
    await screen.findByText(/Kreto set 6 criteria/);
    await waitFor(() => expect(readButton()).toHaveTextContent("Re-read my brief (replaces the criteria below)"));
  });

  it("keeps the brief and the criteria already typed when Kreto fails, and says what to do", async () => {
    m.read.mockRejectedValue(new KretoNeedError("timeout"));
    view();
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), { target: { value: "Paris" } });
    writeBrief();
    fireEvent.click(readButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Kreto took too long. Try again, or set the criteria yourself.");
    expect(screen.getByLabelText(/Describe what you need/)).toHaveValue(BRIEF);
    expect(screen.getByRole("textbox", { name: "Location" })).toHaveValue("Paris");
    expect(readButton()).toBeEnabled();
    expect(screen.queryByText(/Kreto set/)).toBeNull();
  });

  it("shows what a brief with nothing to search by contained, without turning it into criteria", async () => {
    m.read.mockRejectedValue(new KretoNeedError("no_criteria", ["budget $500", "deadline friday"]));
    view();
    writeBrief("Budget is $500 and it is due Friday, so nothing fancy.");
    fireEvent.click(readButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Kreto found nothing to search by in that brief.");
    expect(alert).toHaveTextContent("Not used for matching: budget $500 · deadline friday");
  });

  it("treats an unexpected failure as 'Kreto can't be reached', never as a blank form", async () => {
    m.read.mockRejectedValue(new Error("boom"));
    view();
    writeBrief();
    fireEvent.click(readButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Kreto can't be reached right now. You can set the criteria yourself.");
  });

  it("clears a previous reading's summary when the next one fails, so it cannot describe criteria that were not set", async () => {
    m.read.mockResolvedValueOnce(READING).mockRejectedValueOnce(new KretoNeedError("rate_limited"));
    view();
    writeBrief();
    fireEvent.click(readButton());
    await screen.findByText(/Kreto set 6 criteria/);
    fireEvent.click(readButton());
    await screen.findByText(/Kreto is busy/);
    expect(screen.queryByText(/Kreto set 6 criteria/)).toBeNull();
  });

  it("tells the person that Kreto never sees a profile and that the criteria are theirs to check", () => {
    view();
    expect(screen.getByText(/It never sees a profile, it can misread a brief, and you check and edit the criteria before anything is searched/)).toBeTruthy();
  });
});

describe("importance per term and per platform", () => {
  it("adds terms one at a time, each with its own importance that a press changes", () => {
    view();
    const skills = screen.getByRole("textbox", { name: "Skills" });
    fireEvent.change(skills, { target: { value: "premiere" } });
    fireEvent.keyDown(skills, { key: "Enter" });
    fireEvent.change(skills, { target: { value: "after effects" } });
    fireEvent.keyDown(skills, { key: "," });
    const list = screen.getByRole("list", { name: "Skills, added" });
    expect(within(list).getByRole("button", { name: "premiere: required. Press to change." })).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: "after effects: required. Press to change." }));
    expect(within(list).getByRole("button", { name: "after effects: preferred. Press to change." })).toBeTruthy();
    expect(within(list).getByRole("button", { name: "premiere: required. Press to change." })).toBeTruthy();
    expect(skills).toHaveValue("");
  });

  it("keeps a term still being typed when the search runs, as a required skill", async () => {
    view();
    fireEvent.change(screen.getByRole("textbox", { name: "Skills" }), { target: { value: "tiktok editing" } });
    search();
    // nobody in the pool lists this skill, so the profiles are behind the button: the criterion is still the one that was typed
    expect(await screen.findByText("Checked against: Skill: tiktok editing (required)")).toBeTruthy();
  });

  it("marks a platform required or preferred on its own, apart from the others", async () => {
    view();
    fireEvent.click(screen.getByLabelText("TikTok"));
    fireEvent.click(screen.getByLabelText("YouTube"));
    const tiktok = screen.getByRole("group", { name: "TikTok: how important" });
    fireEvent.click(within(tiktok).getByRole("button", { name: "Preferred" }));
    search();
    await screen.findByText(/Checked against/);
    expect(screen.getByText("Checked against: Present on TikTok · Present on YouTube (required)")).toBeTruthy();
  });
});
