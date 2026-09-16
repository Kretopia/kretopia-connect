import { describe, it, expect } from "vitest";
import { getRoleStampCategory } from "../roleStamp";

describe("getRoleStampCategory", () => {
  it("falls back to creator when role and sub_roles are both empty", () => {
    expect(getRoleStampCategory({ role: null, sub_roles: null })).toBe("creator");
    expect(getRoleStampCategory({ role: "", sub_roles: [] })).toBe("creator");
  });

  it("maps the app's real role taxonomy to the right craft", () => {
    expect(getRoleStampCategory({ role: "Web Developer" })).toBe("software");
    expect(getRoleStampCategory({ role: "Fashion Designer" })).toBe("fashion");
    expect(getRoleStampCategory({ role: "Musician" })).toBe("music");
    expect(getRoleStampCategory({ role: "Photographer" })).toBe("photo_video");
    expect(getRoleStampCategory({ role: "Videographer" })).toBe("photo_video");
    expect(getRoleStampCategory({ role: "Graphic Designer" })).toBe("design");
    expect(getRoleStampCategory({ role: "Journalist" })).toBe("writing");
    expect(getRoleStampCategory({ role: "Dancer" })).toBe("dance");
    expect(getRoleStampCategory({ role: "Gaffer" })).toBe("crew");
    expect(getRoleStampCategory({ role: "Model" })).toBe("model");
    expect(getRoleStampCategory({ role: "Content Creator" })).toBe("creator");
  });

  it("resolves plausible cross-category collisions the way the product means them", () => {
    // A music producer is Music, not the generic Crew/production bucket.
    expect(getRoleStampCategory({ role: "Music Producer" })).toBe("music");
    // An event/executive producer is production support, not Music.
    expect(getRoleStampCategory({ role: "Event Producer" })).toBe("crew");
    // A screenwriter's craft is writing, even though it's film-adjacent.
    expect(getRoleStampCategory({ role: "Screenwriter" })).toBe("writing");
    // "Talent Manager" must not false-match Model on the word "talent".
    expect(getRoleStampCategory({ role: "Talent Manager" })).toBe("crew");
    // A UI/UX or product designer reads as Software, not visual Design.
    expect(getRoleStampCategory({ role: "UI/UX Designer" })).toBe("software");
  });

  it("checks sub_roles when the primary role alone doesn't match", () => {
    expect(getRoleStampCategory({ role: "Freelancer", sub_roles: ["Choreographer"] })).toBe("dance");
  });

  it("is case-insensitive", () => {
    expect(getRoleStampCategory({ role: "PHOTOGRAPHER" })).toBe("photo_video");
  });
});
