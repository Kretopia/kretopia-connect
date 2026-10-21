import { describe, expect, it } from "vitest";
import { getRoleStampCategory, matchRoleStampCategory } from "../passport/roleStamp";

describe("matchRoleStampCategory", () => {
  it("reads a craft from the role or the sub-roles", () => {
    expect(matchRoleStampCategory({ role: "Wedding Photographer" })).toBe("photo_video");
    expect(matchRoleStampCategory({ role: "Founder", sub_roles: ["Music Producer"] })).toBe("music");
    expect(matchRoleStampCategory({ role: "TikTok creator" })).toBe("creator");
  });

  it("is null, not 'creator', when the role names no craft or is empty", () => {
    expect(matchRoleStampCategory({ role: "Chef" })).toBeNull();
    expect(matchRoleStampCategory({ role: "" })).toBeNull();
    expect(matchRoleStampCategory({})).toBeNull();
  });

  it("leaves getRoleStampCategory as it was: it still falls back to 'creator'", () => {
    expect(getRoleStampCategory({ role: "Chef" })).toBe("creator");
    expect(getRoleStampCategory({})).toBe("creator");
    expect(getRoleStampCategory({ role: "Wedding Photographer" })).toBe("photo_video");
  });
});
