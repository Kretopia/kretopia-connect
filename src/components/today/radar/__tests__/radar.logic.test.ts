import { describe, expect, it } from "vitest";
import { skillNames } from "@/lib/skillNames";
import {
  ageLabel,
  buildProposals,
  countryOf,
  firstName,
  pickNearbyEvents,
  rankPeopleToMeet,
  startsIn,
  type Me,
  type NearbyEvent,
  type PersonRow,
  type RadarGig,
} from "../radar.logic";

const NOW = new Date("2026-10-09T12:00:00Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const ME: Me = { role: "Motion Designer", location: "Paris, France", skills: ["After Effects", "Cinema 4D"] };

const person = (id: string, over: Partial<PersonRow> = {}): PersonRow => ({
  user_id: id, username: `u${id}`, full_name: `Person ${id}`, role: "Colorist", avatar_url: null, cover_image_url: null,
  location: "Lyon, France", verification_tier: null, professional_skills: [], created_at: daysAgo(200), ...over,
});

describe("skillNames", () => {
  it("reads strings, { skill } objects, a record keyed by skill, and nothing else", () => {
    expect(skillNames(["Editing", " Grading "])).toEqual(["Editing", "Grading"]);
    expect(skillNames([{ skill: "Colour", category: "Post", level: "expert" }, { name: "Sound" }, { level: "x" }, null, 3])).toEqual(["Colour", "Sound"]);
    expect(skillNames({ Editing: "expert", Grading: "beginner" })).toEqual(["Editing", "Grading"]);
    expect(skillNames(null)).toEqual([]);
    expect(skillNames("Editing")).toEqual([]);
  });
});

describe("rankPeopleToMeet", () => {
  it("puts shared skills first, with a reason that names them", () => {
    const out = rankPeopleToMeet(ME, [
      person("a", { professional_skills: [{ skill: "after effects" }, "Cinema 4D"] }),
      person("b", { location: "Paris, France" }),
      person("c"),
    ], new Set(), NOW);
    expect(out.map((o) => o.person.user_id)).toEqual(["a", "b", "c"]);
    expect(out[0].reason).toBe("Shares your After Effects and Cinema 4D skills");
    expect(out[0].sharedSkills).toEqual(["After Effects", "Cinema 4D"]);
    expect(out[1].reason).toBe("Also in Paris");
    expect(out[1].sameCity).toBe(true);
  });

  it("phrases one shared skill, many shared skills, newcomers and the plain case", () => {
    const [one] = rankPeopleToMeet(ME, [person("a", { professional_skills: ["Cinema 4D"] })], new Set(), NOW);
    expect(one.reason).toBe("Shares your Cinema 4D skill");
    const [many] = rankPeopleToMeet({ ...ME, skills: ["A", "B", "C"] }, [person("a", { professional_skills: ["A", "B", "C"] })], new Set(), NOW);
    expect(many.reason).toBe("Shares 3 of your skills");
    const [fresh] = rankPeopleToMeet(ME, [person("a", { created_at: daysAgo(3) })], new Set(), NOW);
    expect(fresh.reason).toBe("Joined Kretopia recently");
    expect(fresh.isNew).toBe(true);
    const [plain] = rankPeopleToMeet(ME, [person("a")], new Set(), NOW);
    expect(plain.reason).toBe("Colorist on Kretopia");
  });

  it("leaves out the viewer, people already connected, duplicates and rows without an id", () => {
    const out = rankPeopleToMeet(ME, [person("me"), person("friend"), person("a"), person("a"), person("x", { user_id: null })], new Set(["me", "friend"]), NOW);
    expect(out.map((o) => o.person.user_id)).toEqual(["a"]);
  });

  it("never invents a match: no shared skill, no city, no newness, no reason beyond the role", () => {
    const [p] = rankPeopleToMeet({ role: null, location: null, skills: [] }, [person("a", { role: null })], new Set(), NOW);
    expect(p.reason).toBe("Active on Kretopia");
    expect(p.sharedSkills).toEqual([]);
  });

  it("does not match a city on a short fragment, and caps the list", () => {
    const [p] = rankPeopleToMeet({ ...ME, location: "NY" }, [person("a", { location: "NY, USA" })], new Set(), NOW);
    expect(p.sameCity).toBe(false);
    const many = Array.from({ length: 30 }, (_, i) => person(String(i)));
    expect(rankPeopleToMeet(ME, many, new Set(), NOW, 10)).toHaveLength(10);
  });
});

describe("events", () => {
  const ev = (id: string, h: number, over: Partial<NearbyEvent> = {}): NearbyEvent => ({
    id, title: `Event ${id}`, start_time: hoursFromNow(h), end_time: null, venue_name: "Le Palais", category: "film",
    cover_image_url: null, event_mode: null, status: null, ...over,
  });

  it("keeps live upcoming events, soonest first, without the viewer's own next one", () => {
    const mine = { ...ev("mine", 5), role: "going" as const };
    const out = pickNearbyEvents([ev("b", 30), ev("mine", 5), ev("past", -2), ev("a", 10), ev("dead", 8, { status: "cancelled" })], mine, NOW);
    expect(out.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("caps the list", () => {
    expect(pickNearbyEvents([ev("1", 1), ev("2", 2), ev("3", 3), ev("4", 4)], null, NOW, 3)).toHaveLength(3);
  });

  it("says how far away an event is", () => {
    expect(startsIn(hoursFromNow(0.4), NOW)).toBe("in 24 min");
    expect(startsIn(hoursFromNow(0.01), NOW)).toBe("in 1 min");
    expect(startsIn(hoursFromNow(3), NOW)).toBe("in 3 h");
    expect(startsIn(hoursFromNow(24), NOW)).toBe("in 1 day");
    expect(startsIn(hoursFromNow(72), NOW)).toBe("in 3 days");
    expect(startsIn(hoursFromNow(-1), NOW)).toBe("now");
    expect(startsIn("nope", NOW)).toBe("");
  });

  it("reads the country only when the location has one", () => {
    expect(countryOf("Paris, France")).toBe("France");
    expect(countryOf("Paris")).toBeNull();
    expect(countryOf(null)).toBeNull();
    expect(countryOf("Bali, Indonesia ")).toBe("Indonesia");
  });
});

describe("ageLabel", () => {
  const t = NOW.getTime();
  it("tells how old the numbers are", () => {
    expect(ageLabel(null, t)).toBe("");
    expect(ageLabel(t - 2_000, t)).toBe("just now");
    expect(ageLabel(t - 12_000, t)).toBe("12 s ago");
    expect(ageLabel(t - 3 * 60_000, t)).toBe("3 min ago");
    expect(ageLabel(t - 2 * 3_600_000, t)).toBe("2 h ago");
  });
});

describe("buildProposals", () => {
  const gig: RadarGig = { id: "g", title: "Motion Designer / Video Editor", company: "Dataiku", location: null, remote: true, fit_score: 82.4, source_name: "Jobicy", compensation: null, posted_at: null, scouted_at: daysAgo(1) };
  const top = rankPeopleToMeet(ME, [person("a", { full_name: "Lena Hart", professional_skills: ["Cinema 4D"], location: "Paris, France" })], new Set(), NOW)[0];

  it("proposes a person, an event and a gig, each asking for a draft or a plan to review", () => {
    const out = buildProposals({ person: top, event: { title: "Rooftop screening", start_time: hoursFromNow(30) }, gig, now: NOW });
    expect(out.map((p) => p.id)).toEqual(["person", "event", "gig"]);
    expect(out[0].label).toBe("Draft a hello to Lena");
    expect(out[0].prompt).toContain("Lena Hart");
    expect(out[0].prompt).toContain("Shares your Cinema 4D skill");
    expect(out[1].prompt).toContain("Rooftop screening");
    expect(out[2].prompt).toContain("Dataiku");
    expect(out[2].prompt).toContain("82% fit");
    // every prompt asks for something to review; no button claims anything is already done
    for (const p of out) expect(p.prompt).toMatch(/review/i);
    for (const p of out) expect(p.label).not.toMatch(/\b(sent|booked|applied|done|scheduled)\b/i);
  });

  it("only proposes what is on screen, and asks one open question when nothing is", () => {
    expect(buildProposals({ person: null, event: null, gig, now: NOW }).map((p) => p.id)).toEqual(["gig"]);
    const empty = buildProposals({ person: null, event: null, gig: null, now: NOW });
    expect(empty).toHaveLength(1);
    expect(empty[0].id).toBe("open");
  });

  it("shortens long titles in the button, not in the prompt", () => {
    const long = { ...gig, title: "A very long gig title that keeps going and going" };
    const [p] = buildProposals({ person: null, event: null, gig: long, now: NOW });
    expect(p.label.length).toBeLessThan(40);
    expect(p.prompt).toContain(long.title);
  });

  it("first names", () => {
    expect(firstName("Lena Hart")).toBe("Lena");
    expect(firstName("  ")).toBe("");
    expect(firstName(null)).toBe("");
  });
});
