import { describe, expect, it } from "vitest";
import {
  decidePayee,
  resolveMilestonePayee,
  unattributedPaymentNotice,
} from "../../../supabase/functions/_shared/resolveMilestonePayee";

const BRAND = "brand";
const CREATIVE = "creative";
const OTHER = "other-creative";
const collab = (user_id: string, role = "editor") => ({ user_id, role });

describe("decidePayee: who gets credited for a milestone", () => {
  it("never credits the paying Brand for a milestone the Brand created itself (the original bug)", () => {
    const r = decidePayee({
      milestone: { created_by: BRAND },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [collab(CREATIVE)],
      payerUserId: BRAND,
    });
    expect(r.payeeUserId).toBe(CREATIVE);
    expect(r.source).toBe("sole_collaborator");
    expect(r.ambiguous).toBe(false);
  });

  it("credits the creative who inserted their own row (payment request)", () => {
    const r = decidePayee({
      milestone: { created_by: CREATIVE, requested_by: CREATIVE },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [collab(CREATIVE), collab(OTHER)],
      payerUserId: BRAND,
    });
    expect(r).toMatchObject({ payeeUserId: CREATIVE, source: "requested_by" });
  });

  it("uses created_by when a creative made the row and nobody asked for payment", () => {
    const r = decidePayee({
      milestone: { created_by: CREATIVE },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [collab(CREATIVE), collab(OTHER)],
      payerUserId: BRAND,
    });
    expect(r).toMatchObject({ payeeUserId: CREATIVE, source: "created_by" });
  });

  it("a creative-run Studio paid by its client credits the owner, even with helpers on the project", () => {
    const r = decidePayee({
      milestone: { created_by: CREATIVE },
      project: { created_by: CREATIVE, client_user_id: BRAND },
      collaborators: [collab("helper-1"), collab("helper-2")],
      payerUserId: BRAND,
    });
    expect(r).toMatchObject({ payeeUserId: CREATIVE, source: "owner_paid_by_client", ambiguous: false });
  });

  it("returns null, not the Brand, when several creatives could be the payee", () => {
    const r = decidePayee({
      milestone: { created_by: BRAND },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [collab(CREATIVE), collab(OTHER)],
      payerUserId: BRAND,
    });
    expect(r.payeeUserId).toBeNull();
    expect(r.ambiguous).toBe(true);
    expect(r.candidateUserIds.sort()).toEqual([CREATIVE, OTHER]);
  });

  it("returns null, not the Brand, when no creative is on the project yet", () => {
    const r = decidePayee({
      milestone: { created_by: BRAND },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [collab(BRAND, "owner")],
      payerUserId: BRAND,
    });
    expect(r).toMatchObject({ payeeUserId: null, ambiguous: true, candidateCount: 0, source: "unresolved" });
  });

  it("ignores clients and guests as candidates", () => {
    const r = decidePayee({
      milestone: { created_by: BRAND },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [collab("viewer", "client"), collab("visitor", "guest"), collab(CREATIVE)],
      payerUserId: BRAND,
    });
    expect(r.payeeUserId).toBe(CREATIVE);
  });

  it("honours the payer's explicit pick only among real candidates at checkout", () => {
    const base = {
      milestone: { created_by: BRAND },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [collab(CREATIVE), collab(OTHER)],
      payerUserId: BRAND,
    };
    expect(decidePayee({ ...base, chosenUserId: OTHER })).toMatchObject({ payeeUserId: OTHER, source: "chosen" });
    // A forged id that is not on the project is not accepted, so the question is still open.
    expect(decidePayee({ ...base, chosenUserId: "stranger" }).payeeUserId).toBeNull();
    // The payer cannot pick themselves.
    expect(decidePayee({ ...base, chosenUserId: BRAND }).payeeUserId).toBeNull();
  });

  it("trusts the choice recorded in signed checkout metadata at settlement, but still never the payer", () => {
    const base = {
      milestone: { created_by: BRAND },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [],
      payerUserId: BRAND,
      trustChosen: true,
    };
    expect(decidePayee({ ...base, chosenUserId: CREATIVE }).payeeUserId).toBe(CREATIVE);
    expect(decidePayee({ ...base, chosenUserId: BRAND }).payeeUserId).toBeNull();
  });

  it("de-duplicates a creative listed twice", () => {
    const r = decidePayee({
      milestone: { created_by: BRAND },
      project: { created_by: BRAND },
      collaborators: [collab(CREATIVE), collab(CREATIVE, "designer")],
      payerUserId: BRAND,
    });
    expect(r).toMatchObject({ payeeUserId: CREATIVE, candidateCount: 1 });
  });

  it("without a known payer, an owner-created milestone is never guessed", () => {
    const r = decidePayee({
      milestone: { created_by: BRAND },
      project: { created_by: BRAND, client_user_id: null },
      collaborators: [],
    });
    expect(r.payeeUserId).toBeNull();
  });
});

describe("resolveMilestonePayee (loads the project, then decides)", () => {
  const admin = (project: unknown, collaborators: unknown[]) => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: project }),
        then: (ok: any) => Promise.resolve({ data: collaborators }).then(ok),
      };
      return table === "projects" || table === "project_collaborators" ? chain : (() => { throw new Error(table); })();
    },
  });

  it("reads the project and its accepted collaborators", async () => {
    const r = await resolveMilestonePayee(
      admin({ created_by: BRAND, client_user_id: null }, [collab(CREATIVE)]) as any,
      { created_by: BRAND, project_id: "p1" },
      { payerUserId: BRAND },
    );
    expect(r.payeeUserId).toBe(CREATIVE);
  });

  it("is unresolved, not the Brand, when the project cannot be read", async () => {
    const r = await resolveMilestonePayee(admin(null, []) as any, { created_by: BRAND, project_id: "p1" }, { payerUserId: BRAND });
    expect(r.payeeUserId).toBeNull();
  });
});

describe("unattributedPaymentNotice", () => {
  it("goes to the payer, asks for review, and claims no payee", () => {
    const n = unattributedPaymentNotice({ payerUserId: BRAND, milestoneTitle: "Logo", projectId: "p1", amount: 250 });
    expect(n.user_id).toBe(BRAND);
    expect(n.message).toContain("$250.00");
    expect(n.message).toContain("no one has been credited");
    expect(n.link).toBe("/desk/p1?tab=finance");
  });

  it("omits the amount when it is not a finite number", () => {
    const n = unattributedPaymentNotice({ payerUserId: BRAND, milestoneTitle: "Logo", projectId: "p1", amount: NaN });
    expect(n.message).not.toContain("$");
  });
});
