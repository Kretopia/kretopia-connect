import { describe, expect, it } from "vitest";
import { scoutedOverlap, type ScoutedRow } from "../../../../supabase/functions/_shared/discovery/similarity";

const CANONICAL = "https://remoteok.com/remote-jobs/remote-graphic-designer-video-editor-bluetuskr-1137507";
const DRAFT = { title: "Graphic Designer & Video Editor", original_publisher: "BlueTuskr", location: "Anywhere" };
const row = (over: Partial<ScoutedRow> = {}): ScoutedRow => ({
  target_user_id: "member-1", title: "Graphic Designer & Video Editor", company: "BlueTuskr", location: "Remote",
  source_url: "https://remoteOK.com/remote-jobs/remote-graphic-designer-video-editor-bluetuskr-1137507?utm_source=scout", apply_url: null, ...over,
});

describe("scoutedOverlap: the posting is already in members' Scouted lists", () => {
  it("the same provider id is the same posting, whatever the host case, tracking parameters or http", () => {
    const hit = scoutedOverlap(DRAFT, CANONICAL, [row({ title: "Something else entirely", company: "Elsewhere" }), row({ target_user_id: "member-2", source_url: "http://www.remoteok.com/remote-jobs/other-slug-1137507/" })]);
    expect(hit).toMatchObject({ id: "scouted", lane: "scouted", count: 2, score: 1 });
    expect(hit?.reasons[0]).toBe("same address");
  });

  it("the apply address counts too", () => {
    const hit = scoutedOverlap(DRAFT, CANONICAL, [row({ source_url: "https://other.example/x", apply_url: `${CANONICAL}#apply`, title: "Unrelated", company: null })]);
    expect(hit).toMatchObject({ count: 1, score: 1 });
  });

  it("without an address match, a close title AND an alike publisher is advice; the same title at another employer is not", () => {
    const hit = scoutedOverlap(DRAFT, null, [row({ source_url: "https://weworkremotely.com/remote-jobs/abc" })]);
    expect(hit).toMatchObject({ count: 1 });
    expect(hit?.reasons[0]).toBe("same title and publisher");
    expect(scoutedOverlap(DRAFT, null, [row({ company: "Another Studio Ltd", source_url: "https://example.com/1" })])).toBeNull();
    expect(scoutedOverlap(DRAFT, null, [row({ title: "Senior Backend Engineer", source_url: "https://example.com/2" })])).toBeNull();
  });

  it("counts members, not rows: two copies for one member are one member", () => {
    const hit = scoutedOverlap(DRAFT, CANONICAL, [row(), row({ source_url: `${CANONICAL}?ref=x` }), row({ target_user_id: "member-2" })]);
    expect(hit?.count).toBe(2);
    expect(hit?.reasons).toContain("shown to 2 members");
    expect(scoutedOverlap(DRAFT, CANONICAL, [row()])?.reasons).toContain("shown to 1 member");
  });

  it("a different posting of the same provider is not it, and nothing found is null", () => {
    expect(scoutedOverlap(DRAFT, CANONICAL, [row({ title: "Other role", company: "Other", source_url: "https://remoteok.com/remote-jobs/x-1999999" })])).toBeNull();
    expect(scoutedOverlap(DRAFT, CANONICAL, [])).toBeNull();
  });

  it("the advice never carries a member id or a Scouted row", () => {
    const hit = scoutedOverlap(DRAFT, CANONICAL, [row({ target_user_id: "member-secret-uuid" })]);
    expect(JSON.stringify(hit)).not.toContain("member-secret-uuid");
    expect(Object.keys(hit!).sort()).toEqual(["count", "id", "lane", "reasons", "score"]);
  });
});
