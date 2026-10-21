import { describe, expect, it } from "vitest";
import { evaluateCandidate, evaluateCriterion, rankCandidates, type CandidateFacts, type FactsCredit } from "../evaluate";
import { matchNeedSchema, needToCriteria, type MatchNeed } from "../need";

const facts = (over: Partial<CandidateFacts> = {}): CandidateFacts => ({
  userId: "u-1", fullName: "Ana", role: null, bio: null, location: null, skills: [], links: {}, synced: {}, credits: [], ...over,
});
const credit = (over: Partial<FactsCredit> = {}): FactsCredit => ({ evidence: "self_claimed", ...over });
const need = (input: Partial<MatchNeed>): MatchNeed => matchNeedSchema.parse(input);
const one = (n: Partial<MatchNeed>, f: CandidateFacts) => evaluateCriterion(needToCriteria(need(n))[0], f);

describe("craft", () => {
  const n = { craft: { category: "photo_video" as const, importance: "required" as const } };
  it("is met from the role they wrote, and from their work when there is some", () => {
    expect(one(n, facts({ role: "Videographer" }))).toMatchObject({ status: "met", basis: "stated", evidence: 'Role: "Videographer"' });
    const both = one(n, facts({ role: "Videographer", credits: [credit({ category: "film" }), credit({ projectType: "music_video" })] }));
    expect(both).toMatchObject({ status: "met", basis: "demonstrated" });
    expect(both.evidence).toContain("2 credits in this field");
  });
  it("is met from their credits even when the role names another craft", () => {
    expect(one(n, facts({ role: "Founder", credits: [credit({ category: "tv" })] }))).toMatchObject({ status: "met", basis: "demonstrated" });
  });
  it("is not met when the role reads as another craft and nothing shows this one", () => {
    expect(one(n, facts({ role: "Music Producer" }))).toMatchObject({ status: "not_met", evidence: 'Role: "Music Producer" (reads as Music); no credits in this field' });
  });
  it("is unknown, not met, when the role names no craft or is missing", () => {
    expect(one(n, facts({ role: "Chef" }))).toMatchObject({ status: "unknown", basis: null });
    expect(one(n, facts({ role: null }))).toMatchObject({ status: "unknown", evidence: "No role on their profile" });
  });
  it("does not treat the 'creator' fallback as a match for a creator need", () => {
    const creator = { craft: { category: "creator" as const, importance: "required" as const } };
    expect(one(creator, facts({ role: "Chef" })).status).toBe("unknown");
    expect(one(creator, facts({ role: "TikTok creator" })).status).toBe("met");
  });
});

describe("skills and themes", () => {
  it("finds a skill they list, a credit role, or their bio, and says which", () => {
    const n = { skills: [{ term: "color grading", importance: "required" as const }] };
    expect(one(n, facts({ skills: ["Color Grading", "Editing"] }))).toMatchObject({ status: "met", basis: "stated" });
    expect(one(n, facts({ credits: [credit({ role: "Color grading lead", projectName: "Nord" })] }))).toMatchObject({ status: "met", basis: "demonstrated", evidence: 'Credited as "Color grading lead" on Nord' });
    expect(one(n, facts({ bio: "I do color grading for brands." }))).toMatchObject({ status: "met", basis: "stated", evidence: "Mentioned in their bio" });
  });
  it("is not met when they have a record and it never mentions the skill, and unknown when they have no record", () => {
    const n = { skills: [{ term: "rigging", importance: "required" as const }] };
    expect(one(n, facts({ skills: ["Editing"] })).status).toBe("not_met");
    expect(one(n, facts()).status).toBe("unknown");
  });
  it("shows a theme from their credits first, and a mention alone as weaker", () => {
    const n = { themes: [{ term: "swimwear", importance: "preferred" as const }] };
    const shown = one(n, facts({ credits: [credit({ projectName: "Swimwear Summer 2025 campaign" })] }));
    expect(shown).toMatchObject({ status: "met", basis: "demonstrated" });
    expect(shown.evidence).toContain("Swimwear Summer 2025 campaign");
    expect(one(n, facts({ bio: "Beach and swimwear content" }))).toMatchObject({ status: "met", basis: "stated", evidence: "Mentioned in their skills or bio, with no credit to show it" });
  });
  it("does not let a neighbouring category stand in for a theme", () => {
    const n = { themes: [{ term: "swimwear", importance: "preferred" as const }] };
    expect(one(n, facts({ credits: [credit({ category: "fashion", projectName: "Winter coats" })] })).status).toBe("not_met");
  });
});

describe("location", () => {
  const n = (remoteOk: boolean) => ({ location: { text: "Los Angeles, USA", remoteOk, importance: "preferred" as const } });
  it("is met when their location names the place, in any of its parts", () => {
    expect(one(n(false), facts({ location: "Los Angeles, California" })).status).toBe("met");
    expect(one(n(false), facts({ location: "Austin, USA" })).status).toBe("met");
  });
  it("is not met elsewhere, unless remote is fine", () => {
    expect(one(n(false), facts({ location: "Paris, France" }))).toMatchObject({ status: "not_met", evidence: "Based in Paris, France" });
    expect(one(n(true), facts({ location: "Paris, France" }))).toMatchObject({ status: "met", evidence: "Based in Paris, France; you said remote is fine" });
  });
  it("is unknown without a location, even when remote is fine", () => {
    expect(one(n(true), facts({ location: "  " })).status).toBe("unknown");
  });
});

describe("platforms and audience", () => {
  const tiktok = { platforms: [{ platform: "tiktok" as const, importance: "required" as const }] };
  it("tells a synced account from a link, and a link from nothing", () => {
    expect(one(tiktok, facts({ synced: { tiktok: { audience: null } } }))).toMatchObject({ status: "met", basis: "demonstrated" });
    expect(one(tiktok, facts({ links: { tiktok: true } }))).toMatchObject({ status: "met", basis: "stated", evidence: "Links to TikTok (not connected, so not checked)" });
    expect(one(tiktok, facts({ links: { instagram: true } }))).toMatchObject({ status: "not_met", evidence: "No TikTok link or connected account on their profile" });
  });

  const sized = matchNeedSchema.parse({ platforms: [{ platform: "youtube", minAudience: 10000, importance: "required" }] });
  const size = (f: CandidateFacts) => evaluateCandidate(sized, f).results.find((r) => r.criterion.kind === "audience-size")!;
  it("checks an audience size only against a synced follower figure", () => {
    expect(size(facts({ synced: { youtube: { audience: 12400 } } }))).toMatchObject({ status: "met", basis: "demonstrated", evidence: "YouTube: 12,400 followers (synced)" });
    expect(size(facts({ synced: { youtube: { audience: 800 } } })).status).toBe("not_met");
  });
  it("leaves the size unknown when the account is only linked, or synced without a figure", () => {
    expect(size(facts({ links: { youtube: true } })).status).toBe("unknown");
    const none = size(facts({ synced: { youtube: { audience: null } } }));
    expect(none.status).toBe("unknown");
    expect(none.consequence).toContain("platform insights");
  });

  it("never reads an audience from a location, a bio or a tag", () => {
    const n = { audience: { description: "women 18 to 24 in the US", importance: "required" as const } };
    const rich = facts({ location: "New York, USA", bio: "My audience is women 18 to 24 in the US", skills: ["women 18-24"], credits: [credit({ tags: ["women", "US"] })], synced: { tiktok: { audience: 900000 } } });
    const result = one(n, rich);
    expect(result).toMatchObject({ status: "unknown", basis: null, evidence: "Audience data not provided" });
    expect(result.consequence).toContain("does not prove who follows someone");
  });
});

describe("backed work", () => {
  const n = { backedWork: "preferred" as const };
  it("counts verified and co-signed credits only", () => {
    expect(one(n, facts({ credits: [credit({ evidence: "verified" }), credit({ evidence: "co_signed" }), credit()] }))).toMatchObject({ status: "met", basis: "demonstrated", evidence: "2 verified or co-signed credits" });
    expect(one(n, facts({ credits: [credit(), credit({ evidence: "publicly_sourced" })] })).evidence).toBe("2 credits, none verified or co-signed yet");
    expect(one(n, facts()).evidence).toBe("No credits on their Passport yet");
  });
});

describe("summary", () => {
  const strict = need({
    craft: { category: "photo_video", importance: "required" },
    skills: [{ term: "editing", importance: "required" }],
    location: { text: "Paris", remoteOk: false, importance: "preferred" },
  });

  it("is weak as soon as a required criterion is not met", () => {
    const s = evaluateCandidate(strict, facts({ role: "Music Producer", skills: ["editing"] })).summary;
    expect(s.fit).toBe("weak");
    expect(s.label).toBe("Doesn't meet a requirement");
  });

  it("meets all only when every requirement is met and enough was checked", () => {
    const s = evaluateCandidate(strict, facts({ role: "Videographer", skills: ["Editing"], location: "Paris, France" })).summary;
    expect(s).toMatchObject({ fit: "meets_all", coverage: { checked: 3, total: 3 }, required: { total: 2, met: 2, notMet: 0, unknown: 0 }, preferred: { total: 1, met: 1 } });
  });

  it("does not make an incomplete profile look compatible: unknown requirements keep it at partial", () => {
    const s = evaluateCandidate(strict, facts({ role: "Videographer" })).summary;
    expect(s.fit).toBe("partial");
    // only the role could be read: the skill and the place are not on their profile
    expect(s.coverage).toEqual({ checked: 1, total: 3 });
    expect(s.required).toMatchObject({ met: 1, unknown: 1, notMet: 0 });
    expect(s.fit).not.toBe("meets_all");
  });

  it("says there is not enough information when nothing could be checked", () => {
    expect(evaluateCandidate(strict, facts()).summary).toMatchObject({ fit: "unclear", label: "Not enough information", coverage: { checked: 0, total: 3 } });
    expect(evaluateCandidate({ skills: [], themes: [], platforms: [] }, facts({ role: "Videographer" })).summary.fit).toBe("unclear");
  });

  it("never reaches 'meets all' while a required audience cannot be checked", () => {
    const withAudience = need({ craft: { category: "creator", importance: "required" }, audience: { description: "women 18 to 24", importance: "required" } });
    const s = evaluateCandidate(withAudience, facts({ role: "TikTok creator", credits: [credit({ evidence: "verified" })], location: "Los Angeles" })).summary;
    expect(s.fit).toBe("partial");
    expect(s.required.unknown).toBe(1);
  });

  it("carries no score, percentage or probability anywhere", () => {
    const e = evaluateCandidate(strict, facts({ role: "Videographer", skills: ["Editing"], location: "Paris" }));
    const text = JSON.stringify({ summary: e.summary, results: e.results });
    expect(text).not.toMatch(/%|percent|probab|"score"|"match_score"/i);
  });
});

describe("ranking", () => {
  const n = need({
    craft: { category: "photo_video", importance: "required" },
    skills: [{ term: "editing", importance: "required" }],
    location: { text: "Paris", remoteOk: false, importance: "preferred" },
  });
  const pool = [
    facts({ userId: "weak", role: "Music Producer", skills: ["editing"] }),
    facts({ userId: "empty" }),
    facts({ userId: "partial", role: "Videographer" }),
    facts({ userId: "all-demo", role: "Videographer", skills: ["Editing"], location: "Paris", credits: [credit({ category: "film", evidence: "verified" })] }),
    facts({ userId: "all", role: "Videographer", skills: ["Editing"], location: "Paris" }),
  ];

  it("orders by fit level, then by how much their work shows", () => {
    expect(rankCandidates(n, pool).map((e) => e.facts.userId)).toEqual(["all-demo", "all", "partial", "empty", "weak"]);
  });

  it("gives the same order whatever order the pool arrives in", () => {
    const expected = rankCandidates(n, pool).map((e) => e.facts.userId);
    for (const shuffled of [[...pool].reverse(), [pool[2], pool[4], pool[0], pool[3], pool[1]]]) {
      expect(rankCandidates(n, shuffled).map((e) => e.facts.userId)).toEqual(expected);
    }
  });

  it("breaks a true tie the same way every time", () => {
    const twins = [facts({ userId: "b", role: "Videographer" }), facts({ userId: "a", role: "Videographer" }), facts({ userId: "c", role: "Videographer" })];
    const first = rankCandidates(n, twins).map((e) => e.facts.userId);
    expect(rankCandidates(n, [...twins].reverse()).map((e) => e.facts.userId)).toEqual(first);
  });

  it("returns nothing for an empty pool", () => expect(rankCandidates(n, [])).toEqual([]));
});

describe("a swimwear brand looking for TikTok creators", () => {
  const brief = need({
    craft: { category: "creator", importance: "required" },
    platforms: [{ platform: "tiktok", importance: "required" }],
    themes: [{ term: "swimwear", importance: "preferred" }],
    audience: { description: "women 18 to 24 in the US", importance: "required" },
  });
  const pool = [
    facts({ userId: "photographer", role: "Photographer", location: "Los Angeles", links: { instagram: true } }),
    facts({ userId: "tiktoker", role: "TikTok creator", links: { tiktok: true }, credits: [credit({ projectName: "Swimwear drop with Coral", evidence: "co_signed" })] }),
    facts({ userId: "ugc", role: "UGC creator" }),
  ];

  it("puts the creator who shows the work first, and never claims the audience fits", () => {
    const ranked = rankCandidates(brief, pool);
    expect(ranked.map((e) => e.facts.userId)).toEqual(["tiktoker", "ugc", "photographer"]);
    const top = ranked[0];
    expect(top.summary.fit).toBe("partial");
    const byId = Object.fromEntries(top.results.map((r) => [r.criterion.id, r]));
    // the role says "TikTok creator"; the credit has no category, so nothing yet shows the craft beyond their own words
    expect(byId["craft:creator"]).toMatchObject({ status: "met", basis: "stated" });
    expect(byId["platform:tiktok"]).toMatchObject({ status: "met", basis: "stated" });
    expect(byId["theme:swimwear"]).toMatchObject({ status: "met", basis: "demonstrated" });
    expect(byId.audience).toMatchObject({ status: "unknown", evidence: "Audience data not provided" });
    expect(ranked[2].summary.fit).toBe("weak");
  });
});
