import { describe, expect, it } from "vitest";
import {
  decideCompanyProjectAccess,
  decideOrgAccess,
  type Membership,
  type OrgAction,
} from "../../../supabase/functions/_shared/orgAccess";

const ORG = "org-1";
const OTHER_ORG = "org-2";
const member = (userId: string, role: string | null, orgId = ORG): Membership => ({ org_id: orgId, user_id: userId, role });
const ACTIONS: OrgAction[] = ["view_company", "manage_members", "manage_settings", "create_company_project", "delete_company", "transfer_ownership"];

const ask = (userId: string | null, membership: Membership | null, action: string) =>
  decideOrgAccess({ userId, orgId: ORG, membership, action });

describe("company actions: the owner", () => {
  it("can do everything", () => {
    for (const action of ACTIONS) expect(ask("u-owner", member("u-owner", "owner"), action)).toEqual({ allowed: true, role: "owner" });
  });
});

describe("company actions: an admin", () => {
  it("can view, manage members and settings, create company projects", () => {
    for (const action of ["view_company", "manage_members", "manage_settings", "create_company_project"]) {
      expect(ask("u-admin", member("u-admin", "admin"), action)).toEqual({ allowed: true, role: "admin" });
    }
  });
  it("cannot delete the company or transfer ownership: 403", () => {
    for (const action of ["delete_company", "transfer_ownership"]) {
      expect(ask("u-admin", member("u-admin", "admin"), action)).toEqual({ allowed: false, status: 403, reason: "role_not_allowed" });
    }
  });
});

describe("company actions: a member", () => {
  it("can only view the company", () => {
    expect(ask("u-m", member("u-m", "member"), "view_company")).toEqual({ allowed: true, role: "member" });
    for (const action of ["manage_members", "manage_settings", "create_company_project", "delete_company", "transfer_ownership"]) {
      expect(ask("u-m", member("u-m", "member"), action)).toMatchObject({ allowed: false, status: 403, reason: "role_not_allowed" });
    }
  });
});

describe("company actions: the people outside it (denied)", () => {
  it("a removed member has no membership row: not found, for every action", () => {
    for (const action of ACTIONS) {
      expect(ask("u-removed", null, action)).toEqual({ allowed: false, status: 404, reason: "not_a_member" });
    }
  });
  it("an unrelated user is told the company does not exist, not that it is forbidden", () => {
    expect(ask("u-x", null, "view_company")).toMatchObject({ status: 404, reason: "not_a_member" });
  });
  it("a membership of ANOTHER company is no membership here", () => {
    expect(ask("u-x", member("u-x", "owner", OTHER_ORG), "delete_company")).toMatchObject({ allowed: false, status: 404 });
  });
  it("another user's membership row is not the caller's", () => {
    expect(ask("u-x", member("u-owner", "owner"), "delete_company")).toMatchObject({ allowed: false, status: 404 });
  });
  it("a role that is not one of the three is no role (never promoted)", () => {
    for (const role of ["superuser", "OWNERISH", "", null, undefined, "guest", "client"]) {
      expect(ask("u-x", member("u-x", role as string), "view_company")).toMatchObject({ allowed: false, status: 404 });
    }
  });
  it("an unauthenticated caller is 401", () => {
    expect(ask(null, member("u-owner", "owner"), "view_company")).toEqual({ allowed: false, status: 401, reason: "unauthenticated" });
    expect(ask(undefined, null, "view_company")).toMatchObject({ status: 401 });
    expect(ask("", member("u-owner", "owner"), "view_company")).toMatchObject({ status: 401 });
  });
  it("an action this module does not know is denied, even for the owner", () => {
    for (const action of ["", "drop_everything", "VIEW_COMPANY", "view_company ", "__proto__", "toString"]) {
      expect(ask("u-owner", member("u-owner", "owner"), action)).toMatchObject({ allowed: false, reason: "unknown_action" });
    }
  });
  it("a role string is matched case-insensitively and trimmed, nothing else", () => {
    expect(ask("u-a", member("u-a", " Admin "), "manage_members")).toEqual({ allowed: true, role: "admin" });
  });
});

describe("company projects", () => {
  const base = { orgId: ORG, projectOrgId: ORG };
  const decide = (over: Partial<Parameters<typeof decideCompanyProjectAccess>[0]>) =>
    decideCompanyProjectAccess({ userId: "u", membership: null, isAcceptedCollaborator: false, action: "view_project", ...base, ...over });

  it("the owner and an admin reach every project of their company", () => {
    expect(decide({ userId: "u-o", membership: member("u-o", "owner") })).toEqual({ allowed: true, via: "company_owner" });
    expect(decide({ userId: "u-a", membership: member("u-a", "admin"), action: "manage_project" })).toEqual({ allowed: true, via: "company_admin" });
  });

  it("a member reaches a company project only as its accepted collaborator", () => {
    expect(decide({ userId: "u-m", membership: member("u-m", "member"), isAcceptedCollaborator: true })).toEqual({ allowed: true, via: "project_collaborator" });
    expect(decide({ userId: "u-m", membership: member("u-m", "member"), isAcceptedCollaborator: false })).toEqual({
      allowed: false,
      status: 403,
      reason: "role_not_allowed",
    });
  });

  it("a client, a guest or a freelancer (not a member) gets the project they collaborate on, never more", () => {
    expect(decide({ userId: "u-c", membership: null, isAcceptedCollaborator: true })).toEqual({ allowed: true, via: "project_collaborator" });
    // ... and learns nothing about a project they are not on.
    expect(decide({ userId: "u-c", membership: null, isAcceptedCollaborator: false })).toEqual({ allowed: false, status: 404, reason: "not_found" });
  });

  it("a revoked member keeps nothing through the company, and a revoked collaborator nothing through the project", () => {
    expect(decide({ userId: "u-r", membership: null, isAcceptedCollaborator: false })).toMatchObject({ allowed: false, status: 404 });
  });

  it("an unrelated user is not found", () => {
    expect(decide({ userId: "u-x" })).toMatchObject({ allowed: false, status: 404, reason: "not_found" });
  });

  it("a personal project (no org_id) is never reachable through a company role, whatever the role", () => {
    for (const role of ["owner", "admin", "member"]) {
      expect(decide({ userId: "u", membership: member("u", role), projectOrgId: null })).toEqual({
        allowed: false,
        status: 404,
        reason: "personal_project",
      });
    }
    expect(decide({ userId: "u", membership: member("u", "owner"), projectOrgId: undefined })).toMatchObject({ reason: "personal_project" });
  });

  it("a project of another company is not this company's, even for its owner", () => {
    expect(decide({ userId: "u-o", membership: member("u-o", "owner"), projectOrgId: OTHER_ORG })).toEqual({
      allowed: false,
      status: 404,
      reason: "not_found",
    });
  });

  it("a membership of another company gives no company role here", () => {
    expect(decide({ userId: "u", membership: member("u", "owner", OTHER_ORG) })).toMatchObject({ allowed: false, status: 404 });
  });

  it("unauthenticated is 401 and an unknown project action is denied", () => {
    expect(decide({ userId: null, membership: member("u-o", "owner") })).toMatchObject({ status: 401 });
    expect(decide({ userId: "u-o", membership: member("u-o", "owner"), action: "delete_project" })).toMatchObject({
      allowed: false,
      reason: "unknown_action",
    });
  });
});
