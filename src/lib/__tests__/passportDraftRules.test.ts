import { describe, expect, it } from "vitest";
import {
  buildPhotoCandidates,
  buildWorkCandidates,
  checkBio,
  factsCorpus,
  missingFields,
  parseModelJson,
  resolveDraft,
  type ProfileFacts,
} from "../../../supabase/functions/_shared/passportDraft";

const profile: ProfileFacts = {
  full_name: "Amara Vega",
  role: "Illustrator",
  location: "Jakarta, Indonesia",
  bio: null,
  avatar_url: null,
  professional_skills: ["Character design", "Storyboarding"],
  website: "https://www.amaravega.com/work",
  imdb_url: null,
};
const corpus = factsCorpus(profile, [{ project_name: "Monsoon Short", role: "Lead illustrator" }]);

describe("missingFields mirrors the discovery requirements", () => {
  it("flags a short bio, no photo and no credit", () => {
    expect(missingFields({ bio: "too short", avatar_url: null }, 0)).toEqual({ bio: true, photo: true, work_item: true });
  });
  it("flags nothing for a complete profile", () => {
    expect(missingFields({ bio: "x".repeat(20), avatar_url: "https://x.test/a.png" }, 1)).toEqual({ bio: false, photo: false, work_item: false });
  });
});

describe("photo and work candidates come only from what the person already has", () => {
  it("keeps https images, dedupes and caps at four; ignores non-images and credentials in the URL", () => {
    const credits = [
      { primary_media_url: "https://cdn.test/a.jpg", media_type: "image" },
      { primary_media_url: "https://cdn.test/a.jpg", thumbnail_url: "https://cdn.test/b.png" },
      { primary_media_url: "https://cdn.test/video.mp4", media_type: "video" },
      { thumbnail_url: "http://insecure.test/c.png" },
      { thumbnail_url: "https://user:pw@cdn.test/d.png" },
      { thumbnail_url: "https://cdn.test/e.webp" },
      { thumbnail_url: "https://cdn.test/f.webp" },
    ];
    const out = buildPhotoCandidates("https://lh3.test/me", credits);
    expect(out.map((c) => c.url)).toEqual(["https://lh3.test/me", "https://cdn.test/a.jpg", "https://cdn.test/b.png", "https://cdn.test/e.webp"]);
    expect(out[0].source).toBe("auth_provider");
    expect(out[1].source).toBe("credit_media");
  });

  it("offers the links already on the profile as unverified portfolio items, never a guess", () => {
    expect(buildWorkCandidates(profile)).toEqual([
      { id: "w1", url: "https://www.amaravega.com/work", project_name: "Portfolio · amaravega.com", source_label: "Link already on your profile" },
    ]);
    expect(buildWorkCandidates({ website: "not a url", imdb_url: "javascript:alert(1)" })).toEqual([]);
  });
});

describe("checkBio rejects anything the facts do not support", () => {
  it("accepts a short first-person bio built from the facts", () => {
    const r = checkBio("I'm an illustrator in Jakarta focused on character design and storyboarding.", corpus);
    expect(r.ok).toBe(true);
  });
  it("rejects an invented employer, place or number", () => {
    expect(checkBio("I'm an illustrator who worked at Pixar for ten years.", corpus)).toEqual({ ok: false, reason: "unsupported_claims" });
    expect(checkBio("I'm an illustrator with 12 years of experience in Jakarta.", corpus)).toEqual({ ok: false, reason: "unsupported_claims" });
    expect(checkBio("I'm an illustrator based in Paris, working on character design.", corpus)).toEqual({ ok: false, reason: "unsupported_claims" });
  });
  it("rejects links, handles and hashtags, and text that is too short or too long", () => {
    expect(checkBio("Illustrator in Jakarta, see https://amaravega.com for character design.", corpus)).toEqual({ ok: false, reason: "unsupported_claims" });
    expect(checkBio("Illustrator", corpus)).toEqual({ ok: false, reason: "not_enough_facts" });
    expect(checkBio(null, corpus)).toEqual({ ok: false, reason: "not_enough_facts" });
    expect(checkBio("I draw character design " + "storyboarding ".repeat(30), corpus)).toEqual({ ok: false, reason: "unsupported_claims" });
  });
});

describe("parseModelJson", () => {
  it("reads fenced or surrounded JSON and refuses anything else", () => {
    expect(parseModelJson('```json\n{"bio":"x","photo_id":null}\n```')).toEqual({ bio: "x", photo_id: null });
    expect(parseModelJson("no object here")).toBeNull();
    expect(parseModelJson("{broken")).toBeNull();
    expect(parseModelJson("[1,2]")).toBeNull();
    expect(parseModelJson(undefined)).toBeNull();
  });
});

describe("resolveDraft copies every concrete value from a candidate, never from the model", () => {
  const photos = [{ id: "p1", url: "https://lh3.test/me", source: "auth_provider" as const }];
  const works = buildWorkCandidates(profile);
  const missing = { bio: true, photo: true, work_item: true };

  it("builds a full draft from valid picks", () => {
    const { draft, unavailable } = resolveDraft({
      pick: { bio: "I'm an illustrator in Jakarta focused on storyboarding.", photo_id: "p1", work_id: "w1" },
      missing, profile, corpus, photos, works,
    });
    expect(draft.bio?.text).toContain("illustrator");
    expect(draft.photo).toEqual({ url: "https://lh3.test/me", source: "auth_provider" });
    expect(draft.work_item).toEqual({ project_name: "Portfolio · amaravega.com", role: "Illustrator", url: "https://www.amaravega.com/work", source_label: "Link already on your profile" });
    expect(unavailable).toEqual({});
  });

  it("ignores ids the model made up and URLs it tries to smuggle in", () => {
    const { draft, unavailable } = resolveDraft({
      pick: { bio: null, photo_id: "https://evil.test/me.png", work_id: "w9" },
      missing, profile, corpus, photos, works,
    });
    expect(draft).toEqual({ bio: null, photo: null, work_item: null });
    expect(unavailable).toEqual({ bio: "not_enough_facts", photo: "nothing_suitable", work_item: "nothing_suitable" });
  });

  it("says why a field has nothing to draft from, and leaves complete fields alone", () => {
    const { draft, unavailable } = resolveDraft({
      pick: { bio: "I'm an illustrator in Jakarta focused on storyboarding.", photo_id: "p1", work_id: "w1" },
      missing: { bio: false, photo: true, work_item: true }, profile, corpus, photos: [], works: [],
    });
    expect(draft).toEqual({ bio: null, photo: null, work_item: null });
    expect(unavailable).toEqual({ bio: "already_complete", photo: "no_candidates", work_item: "no_candidates" });
  });

  it("falls back to a generic role label only when the profile has no role", () => {
    const { draft } = resolveDraft({ pick: { work_id: "w1" }, missing: { bio: false, photo: false, work_item: true }, profile: { ...profile, role: null }, corpus, photos: [], works });
    expect(draft.work_item?.role).toBe("Creator");
  });
});
