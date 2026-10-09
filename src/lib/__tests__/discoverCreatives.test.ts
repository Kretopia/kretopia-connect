import { describe, expect, it } from "vitest";
import { getInitials } from "../initials";
import { profileHref, spreadAcrossRoles, standingLabel, summarizeCredits, type CreativeRow } from "../discoverCreatives";

const row = (i: number, role: string | null, over: Partial<CreativeRow> = {}): CreativeRow => ({
  user_id: `u${i}`, username: `user${i}`, full_name: `User ${i}`, role, avatar_url: null, cover_image_url: null, location: null, verification_tier: null, ...over,
});

describe("getInitials", () => {
  it("is deterministic, two letters at most, and never a mascot", () => {
    expect(getInitials("Maya Laurent")).toBe("ML");
    expect(getInitials("maya")).toBe("M");
    expect(getInitials("Jean-Luc Picard de la Tour")).toBe("JT");
    expect(getInitials("@studio.nord")).toBe("SN");
    expect(getInitials("Élodie Ångström")).toBe("ÉÅ");
    expect(getInitials("")).toBe("?");
    expect(getInitials(null)).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });
});

describe("spreadAcrossRoles", () => {
  it("takes one person per role when there are enough roles", () => {
    const roles = ["Colorist", "Editor", "Composer", "Director", "Gaffer", "Foley", "Colorist", "Editor"];
    const out = spreadAcrossRoles(roles.map((r, i) => row(i, r)));
    expect(out.map((r) => r.role)).toEqual(["Colorist", "Editor", "Composer", "Director", "Gaffer", "Foley"]);
  });

  it("falls back to the plain top when there are too few distinct roles, and caps the list", () => {
    const same = Array.from({ length: 30 }, (_, i) => row(i, "Editor"));
    expect(spreadAcrossRoles(same)).toHaveLength(12);
    expect(spreadAcrossRoles(same)[0].user_id).toBe("u0");
  });

  it("never returns a row without an id", () => {
    const out = spreadAcrossRoles([row(1, "A", { user_id: null }), row(2, "B")]);
    expect(out.every((r) => !!r.user_id)).toBe(true);
  });
});

describe("links and labels", () => {
  it("links by handle when there is one, by id otherwise", () => {
    expect(profileHref({ user_id: "u1", username: "maya" })).toBe("/@maya");
    expect(profileHref({ user_id: "u1", username: "@maya" })).toBe("/@maya");
    expect(profileHref({ user_id: "u1", username: null })).toBe("/profile/u1");
  });

  it("only names a standing the data has", () => {
    expect(standingLabel("elite")).toBe("Elite Verified");
    expect(standingLabel("VERIFIED")).toBe("Verified");
    expect(standingLabel("gold")).toBeNull();
    expect(standingLabel(null)).toBeNull();
  });
});

describe("summarizeCredits", () => {
  const claimed = { verification_status: null };
  const coSigned = { verification_status: null, endorsement_count: 2 };
  const org = { verification_status: "verified", verified_by_name: "Nord Films" };
  const pending = { verification_status: "pending" };

  it("says nothing when there is nothing to say", () => {
    expect(summarizeCredits([])).toBeNull();
    expect(summarizeCredits([pending])).toBeNull();
  });

  it("labels self-reported credits as such, and confirmed ones as confirmed", () => {
    expect(summarizeCredits([claimed])).toBe("1 credit · self-reported");
    expect(summarizeCredits([claimed, claimed])).toBe("2 credits · self-reported");
    expect(summarizeCredits([coSigned, org])).toBe("2 confirmed credits");
    expect(summarizeCredits([claimed, org, coSigned])).toBe("3 credits · 2 confirmed");
  });

  it("does not count a credit that is still waiting on review", () => {
    expect(summarizeCredits([org, pending])).toBe("1 confirmed credit");
  });

  it("does not call linked-but-unconfirmed evidence self-reported", () => {
    expect(summarizeCredits([{ verification_status: null, verification_url: "https://example.com/credit" }])).toBe("1 credit");
  });
});
