import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { ProfileRow } from "../../today.types";

/**
 * The Radar: nothing fetched before it is about to be seen; real counts that
 * link to where they lead; the viewer's own next event; events and gigs worth a
 * look (and only those Scout itself would show); people to meet, each with a
 * factual reason; and Kreto proposals that only open Kreto.
 */

vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
const view = { inView: true };
vi.mock("@/hooks/useInView", async () => {
  const { createRef } = await import("react");
  return { useInView: () => [createRef(), view.inView] };
});

/* ── a small in-memory database, one answer per table and query shape ── */
const future = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const past = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const db = {
  hosted: [] as Record<string, unknown>[],
  going: [] as Record<string, unknown>[],
  attending: [] as Record<string, unknown>[],
  nearby: [] as Record<string, unknown>[],
  weekCount: 0,
  gigs: [] as Record<string, unknown>[],
  newGigs: 0,
  dismissed: [] as Record<string, unknown>[],
  stages: [] as Record<string, unknown>[],
  stageCount: 0,
  people: [] as Record<string, unknown>[],
  known: [] as Record<string, unknown>[],
  joined: 0,
  credits: [] as Record<string, unknown>[],
  failAll: false,
};
const calls: string[] = [];

function builder(table: string) {
  const f = { eqs: new Set<string>(), usedIn: false, head: false, count: false };
  const q: Record<string, unknown> = {};
  for (const m of ["not", "gte", "lte", "gt", "or", "order", "limit"]) q[m] = () => q;
  q.select = (_cols?: string, opts?: { head?: boolean; count?: string }) => {
    f.head = !!opts?.head;
    f.count = !!opts?.count;
    return q;
  };
  q.eq = (col: string) => {
    f.eqs.add(col);
    return q;
  };
  q.in = () => {
    f.usedIn = true;
    return q;
  };
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
    calls.push(table + (f.head ? "#count" : ""));
    if (db.failAll) return Promise.resolve({ data: null, count: null, error: { message: "boom" } }).then(res, rej);
    let data: unknown = [];
    let count: number | null = null;
    switch (table) {
      case "creative_jams":
        if (f.head) count = db.weekCount;
        else data = f.usedIn ? db.attending : f.eqs.has("created_by") ? db.hosted : db.nearby;
        break;
      case "jam_participants": data = db.going; break;
      case "scouted_gigs":
        if (f.head) count = db.newGigs;
        else data = db.gigs;
        break;
      case "scouted_gig_actions": data = db.dismissed; break;
      case "sound_stages": data = db.stages; count = db.stageCount; break;
      case "public_profiles_safe":
        if (f.head) count = db.joined;
        else data = db.people;
        break;
      case "connections": data = db.known; break;
      case "credits": data = db.credits; break;
    }
    return Promise.resolve({ data, count, error: null }).then(res, rej);
  };
  return q;
}
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => builder(t) } }));

import { TodayRadar } from "../TodayRadar";

const profile = { user_id: "me", full_name: "Maya Laurent", role: "Motion Designer", location: "Paris, France", professional_skills: [{ skill: "After Effects", category: "Motion", level: "expert" }], passion_skills: [] } as unknown as ProfileRow;

const goodGig = { id: "g1", title: "Motion Designer / Video Editor", company: "Dataiku", location: null, remote: true, fit_score: 88.4, source_name: "Jobicy", compensation: "$60k / year", posted_at: past(5), scouted_at: past(2), description: "Make things move with After Effects across a long programme of brand work.", apply_url: "https://jobicy.com/jobs/154420-motion-designer", source_url: null };
const thinGig = { ...goodGig, id: "g2", title: "Empty shell", description: "", company: null, compensation: null, apply_url: "https://example.com/jobs" };
const dismissedGig = { ...goodGig, id: "g3", title: "Dismissed one" };

const person = (id: string, over: Record<string, unknown> = {}) => ({
  user_id: id, username: `u${id}`, full_name: `Lena ${id}`, role: "Colorist", avatar_url: null, cover_image_url: null,
  location: "Lyon, France", verification_tier: null, professional_skills: [], created_at: past(24 * 100), ...over,
});

const renderRadar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TodayRadar userId="me" profile={profile} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.assign(db, {
    hosted: [], going: [], attending: [], nearby: [], weekCount: 0, gigs: [], newGigs: 0, dismissed: [], stages: [], stageCount: 0,
    people: [], known: [], joined: 0, credits: [], failAll: false,
  });
  calls.length = 0;
  view.inView = true;
});

const signal = (name: RegExp) => screen.getByRole("link", { name });

describe("TodayRadar", () => {
  it("fetches nothing until it is about to be seen, then loads", async () => {
    view.inView = false;
    const { rerender } = renderRadar();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toHaveLength(0);
    expect(screen.getByRole("heading", { name: /What's happening around you/ })).toBeInTheDocument();

    view.inView = true;
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <TodayRadar userId="me" profile={profile} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  });

  it("brands the panel and says it is live", async () => {
    renderRadar();
    expect(await screen.findByText("Kretopia radar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What's happening around you/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/^Live$/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Refresh the radar" })).toBeInTheDocument();
  });

  it("shows real counts as links to where they lead", async () => {
    Object.assign(db, { stageCount: 2, stages: [{ id: "s1", title: "Colour grading office hours", vibe_tag: "learn", participant_count: 7, started_at: past(1) }], newGigs: 4, weekCount: 3, joined: 9 });
    renderRadar();
    await waitFor(() => expect(within(signal(/Stages live now/)).getByText("2")).toBeInTheDocument());
    await waitFor(() => expect(within(signal(/new gigs for you/)).getByText("4")).toBeInTheDocument());
    await waitFor(() => expect(within(signal(/events this week/)).getByText("3")).toBeInTheDocument());
    await waitFor(() => expect(within(signal(/creatives joined/)).getByText("9")).toBeInTheDocument());
    expect(signal(/Stages live now/)).toHaveAttribute("href", "/circle?tab=stages");
    expect(signal(/new gigs for you/)).toHaveAttribute("href", "/scout");
    expect(signal(/events this week/)).toHaveAttribute("href", "/meetup");
    expect(signal(/in France/)).toBeInTheDocument();
    expect(signal(/creatives joined/)).toHaveAttribute("href", "/passport");
  });

  it("a live Stage is a banner you can join; with none live there is no banner", async () => {
    Object.assign(db, { stageCount: 1, stages: [{ id: "s1", title: "Colour grading office hours", vibe_tag: "learn", participant_count: 7, started_at: past(1) }] });
    renderRadar();
    const banner = await screen.findByRole("region", { name: "Live now" });
    expect(within(banner).getByRole("link", { name: /Colour grading office hours/ })).toHaveAttribute("href", "/circle?tab=stages&join=s1");
    expect(within(banner).getByText(/7 in the room/)).toBeInTheDocument();
  });

  it("no banner and a plain zero when nothing is live", async () => {
    renderRadar();
    await waitFor(() => expect(within(signal(/Stages live now/)).getByText("0")).toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Live now" })).not.toBeInTheDocument();
  });

  it("shows my own next event with its real cover, and its countdown", async () => {
    db.hosted = [{ id: "e1", title: "Rooftop screening", start_time: future(5), end_time: null, venue_name: "Le Palais", category: "film", cover_image_url: "https://cdn.example.com/c.jpg", event_mode: "in_person", status: null }];
    const { container } = renderRadar();
    const lead = await screen.findByRole("region", { name: "Your next event" });
    expect(within(lead).getByRole("heading", { name: "Rooftop screening" })).toBeInTheDocument();
    expect(within(lead).getByText("Hosting")).toBeInTheDocument();
    expect(within(lead).getByText(/in [45] h/)).toBeInTheDocument();
    expect(within(lead).getByRole("link", { name: "Open event" })).toHaveAttribute("href", "/event/e1");
    expect(container.querySelector('img[src="https://cdn.example.com/c.jpg"]')).toHaveAttribute("loading", "lazy");
  });

  it("with no event of its own it says so and points at events", async () => {
    renderRadar();
    const lead = await screen.findByRole("region", { name: "Your next event" });
    expect(await within(lead).findByText("Nothing on your calendar yet.")).toBeInTheDocument();
    expect(within(lead).getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/meetup");
  });

  it("lists events near me, soonest first, without mine and without cancelled ones", async () => {
    db.hosted = [{ id: "mine", title: "My own", start_time: future(5), end_time: null, venue_name: null, category: null, cover_image_url: null, event_mode: null, status: null }];
    db.nearby = [
      { id: "b", title: "Later one", start_time: future(60), end_time: null, venue_name: "Studio B", category: null, cover_image_url: null, event_mode: null, status: null },
      { id: "mine", title: "My own", start_time: future(5), end_time: null, venue_name: null, category: null, cover_image_url: null, event_mode: null, status: null },
      { id: "x", title: "Cancelled one", start_time: future(8), end_time: null, venue_name: null, category: null, cover_image_url: null, event_mode: null, status: "cancelled" },
      { id: "a", title: "Sooner one", start_time: future(20), end_time: null, venue_name: "Studio A", category: null, cover_image_url: null, event_mode: null, status: null },
    ];
    renderRadar();
    const list = await screen.findByRole("region", { name: "Events near you" });
    const rows = await within(list).findAllByRole("link", { name: /one/ });
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(["/event/a", "/event/b"]);
    expect(within(list).queryByText("Cancelled one")).not.toBeInTheDocument();
    expect(within(list).getByRole("link", { name: /All events/ })).toHaveAttribute("href", "/meetup");
  });

  it("lists the gigs Scout found, hides empty shells and dismissed ones, and links to Scout", async () => {
    db.gigs = [goodGig, thinGig, dismissedGig];
    db.dismissed = [{ scouted_gig_id: "g3" }];
    renderRadar();
    const list = await screen.findByRole("region", { name: "Gigs for you" });
    const row = await within(list).findByRole("link", { name: "Motion Designer / Video Editor. Open Scout." });
    expect(row).toHaveAttribute("href", "/scout");
    expect(within(list).getByText(/Dataiku/)).toBeInTheDocument();
    expect(within(list).queryByText(/%/)).not.toBeInTheDocument();
    expect(within(list).queryByText("Empty shell")).not.toBeInTheDocument();
    expect(within(list).queryByText("Dismissed one")).not.toBeInTheDocument();
  });

  it("Discover Creatives: ranked for me, each with its reason, one action, never Kreto art for a person", async () => {
    db.people = [
      person("plain"),
      person("skill", { full_name: "Lena Skill", professional_skills: [{ skill: "after effects" }], location: "Paris, France", avatar_url: "https://cdn.example.com/a.jpg" }),
      person("me"),
      person("friend"),
    ];
    db.known = [{ connected_user_id: "friend" }];
    const { container } = renderRadar();
    expect(await screen.findByRole("heading", { name: "Discover Creatives" })).toBeInTheDocument();
    expect(screen.getByText("Real Passports from the Kretopia community.")).toBeInTheDocument();

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2); // me and my connection are left out
    expect(within(cards[0]).getByRole("heading", { name: "Lena Skill" })).toBeInTheDocument();
    expect(within(cards[0]).getByText("Shares your After Effects skill")).toBeInTheDocument();
    for (const c of cards) {
      expect(within(c).getAllByRole("link")).toHaveLength(1);
      expect(within(c).queryByRole("button")).not.toBeInTheDocument();
    }
    expect(within(cards[0]).getByRole("link", { name: /View Lena Skill's Passport/ })).toHaveAttribute("href", "/@uskill");
    expect(container.querySelector("article img[src*='kreto']")).toBeNull();
  });

  it("Kreto proposes drafts tied to what is on screen, and only opens Kreto", async () => {
    db.people = [person("skill", { full_name: "Lena Skill", professional_skills: ["After Effects"] })];
    db.gigs = [goodGig];
    db.hosted = [{ id: "e1", title: "Rooftop screening", start_time: future(30), end_time: null, venue_name: null, category: null, cover_image_url: null, event_mode: null, status: null }];
    const events: CustomEvent[] = [];
    window.addEventListener("thrive-copilot:open", (e) => events.push(e as CustomEvent));

    renderRadar();
    const bar = await screen.findByRole("complementary", { name: "Kreto proposes" });
    await within(bar).findByRole("button", { name: /Draft a hello to Lena/ });
    expect(within(bar).getAllByRole("button")).toHaveLength(3);
    expect(within(bar).getByText(/Nothing goes out without you/)).toBeInTheDocument();

    fireEvent.click(within(bar).getByRole("button", { name: /Draft a hello to Lena/ }));
    expect(events).toHaveLength(1);
    expect(events[0].detail.prompt).toContain("Lena Skill");
    expect(events[0].detail.prompt).toContain("Shares your After Effects skill");
    expect(events[0].detail.prompt).toMatch(/review/i);
  });

  it("with nothing to propose it asks one open question instead", async () => {
    renderRadar();
    const bar = await screen.findByRole("complementary", { name: "Kreto proposes" });
    await waitFor(() => expect(within(bar).getAllByRole("button")).toHaveLength(1));
    expect(within(bar).getByRole("button", { name: /Ask Kreto what to do next/ })).toBeInTheDocument();
  });

  it("refresh asks everything again", async () => {
    renderRadar();
    await waitFor(() => expect(calls.length).toBeGreaterThan(5));
    const button = screen.getByRole("button", { name: "Refresh the radar" });
    await waitFor(() => expect(button).not.toBeDisabled());
    const before = calls.length;
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(calls.length).toBeGreaterThan(before));
  });

  it("when every read fails it says it is offline instead of showing zeros", async () => {
    db.failAll = true;
    renderRadar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't reach the radar/);
    expect(screen.getByText(/^Offline$/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Live signals" })).not.toBeInTheDocument();
  });
});
