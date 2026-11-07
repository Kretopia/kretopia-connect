import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  IDENTITY_VERIFICATION_APPROVALS,
  IDENTITY_VERIFICATION_POLICY,
  identityStatusFromServer,
  nextIdentityAction,
  onboardingGate,
  type IdentityStatus,
} from "../identityVerification";

const ALL: IdentityStatus[] = ["not_started", "pending", "verified", "failed", "cancelled", "expired"];
const ON = { collection: true, requiredForOnboarding: true };

describe("the policy", () => {
  it("is OFF: nothing is collected and no member is required to verify", () => {
    expect(IDENTITY_VERIFICATION_POLICY).toEqual({ collection: false, requiredForOnboarding: false });
    expect(Object.isFrozen(IDENTITY_VERIFICATION_POLICY)).toBe(true);
  });

  it("names what a person must confirm before either switch is turned on", () => {
    expect(IDENTITY_VERIFICATION_APPROVALS.map((a) => a.id)).toEqual(["provider", "consent", "retention", "exception"]);
  });
});

describe("identityStatusFromServer", () => {
  it("knows nothing about a member the server has no record for", () => {
    expect(identityStatusFromServer(null)).toBe("not_started");
    expect(identityStatusFromServer(undefined)).toBe("not_started");
    expect(identityStatusFromServer({})).toBe("not_started");
    expect(identityStatusFromServer({ id_verified: false, session: null })).toBe("not_started");
  });

  it("is verified only when the server's own column says so", () => {
    expect(identityStatusFromServer({ id_verified: true })).toBe("verified");
    // not from a truthy look-alike, and not from a session that merely says it was approved
    expect(identityStatusFromServer({ id_verified: "true" as unknown as boolean })).toBe("not_started");
    expect(identityStatusFromServer({ id_verified: 1 as unknown as boolean })).toBe("not_started");
    expect(identityStatusFromServer({ id_verified: false, session: { status: "approved" } })).toBe("pending");
  });

  it("reads the session states a provider will report: pending, failed, cancelled, expired", () => {
    const now = Date.parse("2026-11-07T12:00:00Z");
    expect(identityStatusFromServer({ session: { status: "pending", expires_at: "2026-11-07T13:00:00Z" } }, now)).toBe("pending");
    expect(identityStatusFromServer({ session: { status: "pending", expires_at: "2026-11-07T11:00:00Z" } }, now)).toBe("expired");
    expect(identityStatusFromServer({ session: { status: "pending" } }, now)).toBe("pending");
    expect(identityStatusFromServer({ session: { status: "failed", reason: "no_match" } }, now)).toBe("failed");
    expect(identityStatusFromServer({ session: { status: "cancelled" } }, now)).toBe("cancelled");
    expect(identityStatusFromServer({ session: { status: "expired" } }, now)).toBe("expired");
    expect(identityStatusFromServer({ session: { status: "something-new" as never } }, now)).toBe("not_started");
  });

  it("lets a verified member stay verified whatever an old session says", () => {
    expect(identityStatusFromServer({ id_verified: true, session: { status: "failed" } })).toBe("verified");
  });
});

describe("nextIdentityAction", () => {
  it("offers nothing to start while collection is off, and says so", () => {
    for (const status of ["not_started", "failed", "cancelled", "expired"] as const) expect(nextIdentityAction(status)).toBe("unavailable");
    expect(nextIdentityAction("pending")).toBe("wait");
    expect(nextIdentityAction("verified")).toBe("none");
  });

  it("maps each state to its next step once collection is open", () => {
    const open = { collection: true, requiredForOnboarding: false };
    expect(nextIdentityAction("not_started", open)).toBe("start");
    expect(nextIdentityAction("expired", open)).toBe("start");
    expect(nextIdentityAction("cancelled", open)).toBe("resume");
    expect(nextIdentityAction("failed", open)).toBe("retry");
    expect(nextIdentityAction("pending", open)).toBe("wait");
    expect(nextIdentityAction("verified", open)).toBe("none");
  });
});

describe("onboardingGate: who may be made to wait for verification", () => {
  it("blocks nobody while the requirement is off, which is today", () => {
    for (const status of ALL) {
      for (const existingMember of [false, true]) expect(onboardingGate({ status, existingMember })).toEqual({ blocked: false, reason: "not_required" });
    }
  });

  it("never blocks on a step that cannot be completed: required but collection off lets everyone through", () => {
    expect(onboardingGate({ status: "not_started", existingMember: false, policy: { collection: false, requiredForOnboarding: true } })).toEqual({ blocked: false, reason: "collection_off" });
  });

  it("never gates an existing member, and always lets through a member with a manual exception", () => {
    expect(onboardingGate({ status: "not_started", existingMember: true, policy: ON })).toEqual({ blocked: false, reason: "existing_member" });
    expect(onboardingGate({ status: "failed", existingMember: false, manualException: true, policy: ON })).toEqual({ blocked: false, reason: "manual_exception" });
  });

  it("waits for a verified identity only for a new member, once requirement and collection are both on", () => {
    expect(onboardingGate({ status: "verified", existingMember: false, policy: ON })).toEqual({ blocked: false, reason: "verified" });
    for (const status of ["not_started", "pending", "failed", "cancelled", "expired"] as const) {
      expect(onboardingGate({ status, existingMember: false, policy: ON })).toEqual({ blocked: true, reason: "identity_verification_required" });
    }
  });
});

describe("nothing here can collect or send anything", () => {
  const root = process.cwd();
  const read = (file: string) => readFileSync(join(root, file), "utf8");

  it("the state module and the step are pure: no camera, no capture, no network, no backend client", () => {
    for (const file of ["src/lib/identity/identityVerification.ts", "src/components/onboarding/identity/IdentityVerificationStep.tsx"]) {
      const source = read(file);
      for (const forbidden of ["getUserMedia", "mediaDevices", "toDataURL", "FileReader", "fetch(", "supabase", "functions.invoke", "XMLHttpRequest"]) {
        expect(source, `${file} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("the only backend read is the member's own id_verified, through the hook", () => {
    const hook = read("src/hooks/useIdentityVerificationStatus.ts");
    expect(hook).toContain('.select("id_verified")');
    expect(hook).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(|functions\.invoke/);
  });

  // The one existing face check reaches a general-purpose model with a selfie. It is not mounted anywhere; this fails the day something
  // mounts it, so that happens on purpose, with the approvals in hand, and not by accident.
  it("the existing selfie-matching step is still not reachable from any page", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
      });
    const files = walk(join(root, "src")).filter((f) => !/__tests__|\.test\./.test(f));
    const importers = (name: string) => files.filter((f) => new RegExp(`import[^;]*${name}[^;]*from`).test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
    expect(importers("OptionalFaceVerifyStep")).toEqual(["src/components/onboarding/claim-flow/UniversalClaimFlow.tsx"]);
    expect(importers("UniversalClaimFlow")).toEqual([]);
  });
});
