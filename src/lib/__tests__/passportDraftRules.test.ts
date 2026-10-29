import { describe, expect, it } from "vitest";
import {
  buildPhotoCandidates,
  buildWorkCandidates,
  checkBio,
  factsCorpus,
  hasBioFacts,
  missingFields,
  needsModel,
  parseModelJson,
  resolveDraft,
  skillList,
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

describe("skillList reads every shape professional_skills is stored in", () => {
  it("strings, {skill, category, level} objects, a keyed object, mixed arrays and nothing", () => {
    expect(skillList(["Storyboarding", " Character design "])).toEqual(["Storyboarding", "Character design"]);
    expect(skillList([{ skill: "Colour grading", category: "Post", level: "expert" }, { name: "Foley" }, { label: "ADR" }])).toEqual(["Colour grading", "Foley", "ADR"]);
    expect(skillList({ Animation: true, Rigging: 3 })).toEqual(["Animation", "Rigging"]);
    expect(skillList(["A", { skill: "A" }, "", null, 5, {}, { skill: 7 }])).toEqual(["A"]);
    for (const none of [null, undefined, "Animation", 7, [], {}]) expect(skillList(none), String(none)).toEqual([]);
  });
  it("never lets an object reach the facts as '[object Object]', and the names count as facts the bio may use", () => {
    const profile = { skills: [{ skill: "Character design" }] };
    expect(factsCorpus({ professional_skills: profile.skills }, [])).toContain("character design");
    expect(factsCorpus({ professional_skills: profile.skills }, [])).not.toContain("object");
  });
  it("bounds a very long list and very long names", () => {
    const many = skillList(Array.from({ length: 100 }, (_, i) => `skill ${i}`));
    expect(many).toHaveLength(20);
    expect(skillList(["x".repeat(500)])[0]).toHaveLength(80);
  });
});

describe("when the model is worth calling", () => {
  const none = { bio: false, photo: false, work_item: false };
  const photo = [{ id: "p1", url: "https://lh3.test/me", source: "auth_provider" as const }];
  const work = [{ id: "w1", url: "https://x.test", project_name: "Portfolio · x.test", source_label: "Link already on your profile" }];

  it("hasBioFacts: a role, a skill or a named credit; a name and a place alone are not facts to write a bio from", () => {
    expect(hasBioFacts({ role: "Illustrator" }, [])).toBe(true);
    expect(hasBioFacts({ professional_skills: [{ skill: "Foley" }] }, [])).toBe(true);
    expect(hasBioFacts({}, [{ project_name: "Monsoon Short" }])).toBe(true);
    expect(hasBioFacts({ full_name: "Amara Vega", location: "Jakarta" }, [])).toBe(false);
    expect(hasBioFacts({ role: "  ", professional_skills: [] }, [{ project_name: " " }])).toBe(false);
  });

  it("is not called when the bio is fine and there is no image or link to choose from", () => {
    expect(needsModel({ missing: { ...none, work_item: true }, hasBioFacts: true, photos: [], works: [] })).toBe(false);
  });
  it("is not called for a missing bio with nothing to rest on and nothing else to choose", () => {
    expect(needsModel({ missing: { ...none, bio: true }, hasBioFacts: false, photos: [], works: [] })).toBe(false);
  });
  it("is called to write a bio that has facts, or to choose among images or links", () => {
    expect(needsModel({ missing: { ...none, bio: true }, hasBioFacts: true, photos: [], works: [] })).toBe(true);
    expect(needsModel({ missing: { ...none, photo: true }, hasBioFacts: false, photos: photo, works: [] })).toBe(true);
    expect(needsModel({ missing: { ...none, work_item: true }, hasBioFacts: false, photos: [], works: work })).toBe(true);
  });
  it("the no-model answer carries the same reasons a model call would have ended with", () => {
    const r = resolveDraft({ pick: {}, missing: { bio: true, photo: true, work_item: true }, profile: {}, corpus: "", photos: [], works: [] });
    expect(r.draft).toEqual({ bio: null, photo: null, work_item: null });
    expect(r.unavailable).toEqual({ bio: "not_enough_facts", photo: "no_candidates", work_item: "no_candidates" });
  });
});
