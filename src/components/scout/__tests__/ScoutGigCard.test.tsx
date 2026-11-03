import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ user: { id: "u1" } as null | { id: string }, load: vi.fn(), draft: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: h.user, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/profile/profileService", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/thriveCopilot", () => ({ streamCopilot: vi.fn() }));
vi.mock("@/lib/kretoDraft", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/kretoDraft")>()),
  loadPassportContext: (...a: unknown[]) => h.load(...a),
  draftWithKreto: (...a: unknown[]) => h.draft(...a),
}));

import { ScoutGigCard, type ScoutGigCardProps } from "../ScoutGigCard";

const PASSPORT = { name: "Ada", headline: null, roles: ["Cinematographer"], skills: ["Handheld", "Night exteriors"], location: null, bio: "Shoots.", credits: [{ title: "Static Bloom", role: "DoP", year: 2025, type: "Music video", client: null, evidence: "verified" as const, summary: null }], recentProjects: [], passportUrl: null };

const base = (over: Partial<ScoutGigCardProps> = {}): ScoutGigCardProps => ({
  title: "Mixing engineer",
  company: "Northline Records",
  art: { category: "audio-music", title: "Mixing engineer" },
  href: "/opportunity/1",
  pills: <span>Kretopia</span>,
  pay: "$800",
  location: "Porto",
  apply: { label: "View gig", to: "/opportunity/1" },
  brief: { text: "Mix a four-track EP.\n\nTwo days in Porto." },
  details: [{ label: "Company", value: "Northline Records" }, { label: "Pay", value: "$800" }],
  opportunity: { title: "Mixing engineer", company: "Northline Records", description: "Mix a four-track EP." },
  testId: "card",
  ...over,
});

const renderCard = (props: Partial<ScoutGigCardProps> = {}) =>
  render(
    <MemoryRouter>
      <ScoutGigCard {...base(props)} />
    </MemoryRouter>,
  );

const card = () => screen.getByTestId("card");

beforeEach(() => {
  h.user = { id: "u1" };
  h.load.mockReset().mockResolvedValue(PASSPORT);
  h.draft.mockReset();
});

describe("the Scout card: front", () => {
  it("shows the headline, pay and place, and the pills the surface gives it", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Mixing engineer" })).toHaveAttribute("href", "/opportunity/1");
    expect(card()).toHaveTextContent("Northline Records");
    expect(card()).toHaveTextContent("$800");
    expect(card()).toHaveTextContent("Porto");
    expect(card()).toHaveTextContent("Kretopia");
  });

  it("says so when pay or place are not listed, rather than leaving a gap or inventing one", () => {
    renderCard({ pay: null, location: null });
    expect(card()).toHaveTextContent("Pay not listed");
    expect(card()).toHaveTextContent("Not listed");
  });

  it("wears the illustration of the role: a different room for a different kind of work", () => {
    const src = (art: ScoutGigCardProps["art"]) => {
      const { container, unmount } = renderCard({ art });
      const value = container.querySelector("img")!.getAttribute("src")!;
      unmount();
      return value;
    };
    expect(src({ category: "audio-music", title: "Mixing engineer" })).toContain("music-studio");
    expect(src({ category: "engineering", title: "Backend engineer" })).toContain("workspace");
    expect(src({ title: "Podcast host" })).toContain("soundstages");
    expect(src({ title: "Zorblax wrangler" })).toContain("scout"); // the documented default
    expect(src({ category: "photo", title: "Photographer" })).toContain("studio"); // the stand-in: no photographer art yet
  });

  it("never uses a remote picture for the cover", () => {
    const { container } = renderCard();
    for (const img of container.querySelectorAll("img")) expect(img.getAttribute("src")).not.toMatch(/^https?:/);
  });

  it("opens the caller's own detail from the title when asked to", () => {
    const onOpen = vi.fn();
    renderCard({ href: undefined, onOpen });
    fireEvent.click(screen.getByRole("button", { name: "View brief for Mixing engineer" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders the primary action as a link in the app, a new-tab link to another site, or a button", () => {
    const { unmount } = renderCard();
    expect(screen.getByRole("link", { name: /View gig/ })).toHaveAttribute("href", "/opportunity/1");
    unmount();
    const external = renderCard({ apply: { label: "Apply at source", href: "https://jobs.example/1", rel: "noopener noreferrer nofollow", ariaLabel: "Apply at source: Mixing engineer" } });
    const link = screen.getByRole("link", { name: "Apply at source: Mixing engineer" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
    external.unmount();
    const onClick = vi.fn();
    renderCard({ apply: { label: "Apply", onClick } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("keeps the back of the card out of the page until it is first flipped", () => {
    renderCard();
    expect(screen.queryByTestId("quick-look-brief")).toBeNull();
    expect(screen.queryByTestId("flip-back")).toBeNull();
  });
});

describe("the Scout card: quick look, in place", () => {
  it("flips to the brief and the listing's own fields, without leaving the page", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("quick-look"));
    const brief = screen.getByTestId("quick-look-brief");
    expect(brief).toHaveTextContent("Mix a four-track EP.");
    expect(brief).toHaveTextContent("Two days in Porto.");
    expect(card()).toHaveAttribute("data-flipped", "true");
    // the fields the listing has, and only those
    const back = screen.getByRole("group", { name: /Mixing engineer: quick look/ });
    expect(within(back).getByText("Company")).toBeInTheDocument();
    expect(within(back).getByText("Pay")).toBeInTheDocument();
    expect(within(back).queryByText("Duration")).toBeNull();
    // no external link is needed to understand the opportunity
    expect(within(back).queryByRole("link", { name: /original listing/i })).toBeNull();
  });

  it("turns the front away: inert and hidden from assistive technology, while the back is live", () => {
    renderCard();
    // before a flip there is one face, and it is not hidden
    const before = Array.from(card().querySelectorAll(":scope > div > div")) as HTMLElement[];
    expect(before).toHaveLength(1);
    expect(before[0].hasAttribute("aria-hidden")).toBe(false);
    fireEvent.click(screen.getByTestId("quick-look"));
    const faces = Array.from(card().querySelectorAll(":scope > div > div")) as HTMLElement[];
    expect(faces).toHaveLength(2);
    expect(faces[0]).toHaveAttribute("aria-hidden", "true");
    expect(faces[0].hasAttribute("inert")).toBe(true);
    expect(faces[1]).toHaveAttribute("aria-hidden", "false");
    expect(faces[1].hasAttribute("inert")).toBe(false);
  });

  it("moves focus to 'Flip back', announces the state, and Escape returns to 'Quick look'", () => {
    renderCard();
    const quick = screen.getByTestId("quick-look");
    expect(quick).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(quick);
    expect(quick).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(screen.getByTestId("flip-back"));
    fireEvent.keyDown(screen.getByTestId("flip-back"), { key: "Escape" });
    expect(card()).toHaveAttribute("data-flipped", "false");
    expect(quick).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(quick);
  });

  it("flips back with the button too", () => {
    renderCard();
    fireEvent.click(screen.getByTestId("quick-look"));
    fireEvent.click(screen.getByTestId("flip-back"));
    expect(card()).toHaveAttribute("data-flipped", "false");
  });

  it("lets a surface fetch the full text the first time the card is opened", () => {
    const onQuickLook = vi.fn();
    renderCard({ onQuickLook });
    expect(onQuickLook).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("quick-look"));
    expect(onQuickLook).toHaveBeenCalled();
  });

  it("shows that the full listing is loading, then the text", () => {
    const { rerender } = renderCard({ brief: { text: "Short.", loading: true } });
    fireEvent.click(screen.getByTestId("quick-look"));
    expect(screen.getByTestId("quick-look-brief")).toHaveTextContent("Loading the full listing…");
    rerender(<MemoryRouter><ScoutGigCard {...base({ brief: { text: "Short." } })} /></MemoryRouter>);
    expect(screen.getByTestId("quick-look-brief")).toHaveTextContent("Short.");
  });

  it("says plainly when the listing has no description, and offers the original only then", () => {
    renderCard({ brief: { text: null, originalUrl: "https://jobs.example/1" } });
    fireEvent.click(screen.getByTestId("quick-look"));
    expect(screen.getByTestId("quick-look-brief")).toHaveTextContent("This listing did not include a description.");
    expect(within(screen.getByTestId("quick-look-brief")).getByRole("link", { name: "Read the original listing" })).toHaveAttribute("target", "_blank");
  });

  it("does not invent anything for a listing with no description and no original", () => {
    renderCard({ brief: { text: "   " }, details: [] });
    fireEvent.click(screen.getByTestId("quick-look"));
    expect(screen.getByTestId("quick-look-brief")).toHaveTextContent("This listing did not include a description.");
    expect(within(screen.getByTestId("quick-look-brief")).queryByRole("link")).toBeNull();
  });
});

describe("the Scout card: apply with Kreto", () => {
  const open = () => fireEvent.click(screen.getByTestId("apply-with-kreto-open"));

  it("opens Kreto's panel on the back, with an editable field", () => {
    renderCard();
    open();
    expect(card()).toHaveAttribute("data-flipped", "true");
    const panel = screen.getByTestId("apply-with-kreto");
    expect(within(panel).getByText(/nothing is sent from here/i)).toBeInTheDocument();
    expect(within(panel).getByRole("textbox", { name: "Your application draft" })).toBeEnabled();
  });

  it("drafts from the listing and the Passport into the editable field, and sends nothing", async () => {
    const onApply = vi.fn();
    h.draft.mockResolvedValue("I mixed Static Bloom for Maya Rios and would love to work on this EP.");
    renderCard({ apply: { label: "Apply", onClick: onApply } });
    open();
    fireEvent.change(screen.getByLabelText(/Anything to emphasise/), { target: { value: "free in March" } });
    fireEvent.click(screen.getByTestId("kreto-draft-application"));
    const field = (await screen.findByDisplayValue(/I mixed Static Bloom/)) as HTMLTextAreaElement;

    const request = h.draft.mock.calls[0][0] as { prompt: string; surface: string };
    expect(h.load).toHaveBeenCalledWith("u1");
    expect(request.surface).toBe("gigs");
    expect(request.prompt).toContain("Title: Mixing engineer");
    expect(request.prompt).toContain("Static Bloom"); // the Passport's credit
    expect(request.prompt).toContain("free in March"); // the person's stated intent
    expect(screen.getByRole("status")).toHaveTextContent(/1 credit, 2 skills/);

    // editable, and still not sent
    fireEvent.change(field, { target: { value: `${field.value} I am free in March.` } });
    expect(field.value).toContain("I am free in March.");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows Kreto's own message when the allowance is used, and keeps what is in the field", async () => {
    h.draft.mockRejectedValue(new Error("You've used today's 20/20 for this. Resets at midnight UTC."));
    renderCard();
    open();
    fireEvent.change(screen.getByRole("textbox", { name: "Your application draft" }), { target: { value: "my own words" } });
    fireEvent.click(screen.getByTestId("kreto-draft-application"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Resets at midnight UTC.");
    expect(screen.getByRole("textbox", { name: "Your application draft" })).toHaveValue("my own words");
  });

  it("copies the draft on request", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderCard({ draft: { value: "Hello there, this is my draft.", onChange: () => {} } });
    open();
    fireEvent.click(screen.getByRole("button", { name: /Copy/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Hello there, this is my draft."));
  });

  it("keeps the draft in the caller's state, so it follows the person to the fuller apply flow", () => {
    const onChange = vi.fn();
    renderCard({ draft: { value: "kept elsewhere", onChange } });
    open();
    const field = screen.getByRole("textbox", { name: "Your application draft" });
    expect(field).toHaveValue("kept elsewhere");
    fireEvent.change(field, { target: { value: "edited" } });
    expect(onChange).toHaveBeenCalledWith("edited");
  });

  it("asks a signed-out visitor to sign in for the draft, and still lets them write their own", () => {
    h.user = null;
    renderCard();
    open();
    expect(screen.queryByTestId("kreto-draft-application")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toContain("/auth?redirect=");
    expect(screen.getByRole("textbox", { name: "Your application draft" })).toBeEnabled();
  });

  it("can go back to the brief from the panel", () => {
    renderCard();
    open();
    fireEvent.click(within(card()).getAllByRole("button", { name: "Brief" })[1] ?? within(card()).getByRole("button", { name: "Brief" }));
    expect(screen.getByTestId("quick-look-brief")).toBeInTheDocument();
  });
});
