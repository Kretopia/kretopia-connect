import { describe, expect, it } from "vitest";
import {
  decideEnrichmentBatch,
  decideEnrichmentTarget,
  isProfileId,
  type EnrichmentCaller,
} from "../../../supabase/functions/_shared/enrichmentAccess";

const ME = "aaaaaaaa-1111-4111-8111-bbbbbbbbbbbb";
const OTHER = "22222222-2222-4222-8222-222222222222";
const member: EnrichmentCaller = { kind: "user", id: ME, isAdmin: false };
const admin: EnrichmentCaller = { kind: "user", id: "99999999-9999-4999-8999-999999999999", isAdmin: true };
const service: EnrichmentCaller = { kind: "service" };
const profileOf = (id: string) => ({ user_id: id });

describe("decideEnrichmentTarget: whose profile may be enriched", () => {
  it("lets a member enrich their own profile", () => {
    expect(decideEnrichmentTarget({ caller: member, targetUserId: ME, profile: profileOf(ME) })).toEqual({ ok: true, reason: "self" });
  });

  it("refuses a member another member's profile, with the answer a missing profile gets", () => {
    const stranger = decideEnrichmentTarget({ caller: member, targetUserId: OTHER, profile: profileOf(OTHER) });
    const missing = decideEnrichmentTarget({ caller: member, targetUserId: OTHER, profile: null });
    expect(stranger).toEqual({ ok: false, status: 404, error: "Profile not found" });
    expect(stranger).toEqual(missing);
  });

  it("refuses a member an unclaimed public profile too: nobody owns it, an admin or the platform enriches it", () => {
    expect(decideEnrichmentTarget({ caller: member, targetUserId: OTHER, profile: { user_id: OTHER } })).toMatchObject({ ok: false, status: 404 });
  });

  it("lets an admin enrich any existing profile", () => {
    expect(decideEnrichmentTarget({ caller: admin, targetUserId: OTHER, profile: profileOf(OTHER) })).toEqual({ ok: true, reason: "admin" });
    expect(decideEnrichmentTarget({ caller: admin, targetUserId: OTHER, profile: null })).toMatchObject({ ok: false, status: 404 });
  });

  it("lets the platform enrich any existing profile (batch and cron)", () => {
    expect(decideEnrichmentTarget({ caller: service, targetUserId: OTHER, profile: profileOf(OTHER) })).toEqual({ ok: true, reason: "service" });
    expect(decideEnrichmentTarget({ caller: service, targetUserId: OTHER, profile: null })).toMatchObject({ ok: false, status: 404 });
  });

  it("refuses a target that is not an id before looking at anything else", () => {
    for (const bad of [undefined, null, "", "abc", 5, ["x"], { id: ME }, `${ME}' or '1'='1`, ` ${ME}`]) {
      expect(decideEnrichmentTarget({ caller: admin, targetUserId: bad, profile: profileOf(ME) })).toMatchObject({ ok: false, status: 400 });
    }
  });

  it("does not treat a loosely matching id as the member's own", () => {
    expect(decideEnrichmentTarget({ caller: member, targetUserId: ME.toUpperCase(), profile: profileOf(ME) })).toMatchObject({ ok: false, status: 404 });
  });
});

describe("decideEnrichmentBatch: a run over every member", () => {
  it("is for admins and the platform, never for a member", () => {
    expect(decideEnrichmentBatch(service)).toEqual({ ok: true, reason: "service" });
    expect(decideEnrichmentBatch(admin)).toEqual({ ok: true, reason: "admin" });
    expect(decideEnrichmentBatch(member)).toMatchObject({ ok: false, status: 403 });
  });
});

describe("isProfileId", () => {
  it("accepts a uuid and nothing else", () => {
    expect(isProfileId(ME)).toBe(true);
    for (const bad of ["", "x", 1, null, undefined, `${ME}x`]) expect(isProfileId(bad)).toBe(false);
  });
});
