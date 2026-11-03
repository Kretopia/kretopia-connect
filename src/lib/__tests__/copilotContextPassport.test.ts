import { describe, expect, it, vi } from "vitest";

vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: vi.fn() }));

// The server module is a Deno file (an `npm:` import): load it at run time so the browser app's type check never has to resolve it.
const MODULE = "../../../supabase/functions/_shared/copilotContext";
const { creditEvidence, loadCopilotContext, renderContextPreamble } = (await import(/* @vite-ignore */ MODULE)) as {
  creditEvidence: (row: { verification_status?: string | null; endorsement_count?: number | null }) => string;
  loadCopilotContext: (admin: never, userId: string) => Promise<Record<string, unknown> & { skills: string[]; top_credits: unknown[]; bio: string | null }>;
  renderContextPreamble: (ctx: never, surface?: string) => string;
};

const PROFILE = {
  full_name: "Ada Okoye",
  username: "ada",
  role: "Cinematographer",
  sub_roles: ["Colourist"],
  location: "Lisbon",
  account_type: "creative",
  bio: "I shoot music videos and short films,\n mostly at night.",
  professional_skills: ["Handheld", "Night exteriors"],
  passion_skills: ["handheld", "Surf"],
};
const TOP_CREDITS = [
  { project_name: "Static Bloom", role: "DoP", year: 2025, client_brand: "Maya Rios", project_type: "Music video", verification_status: "verified", endorsement_count: 0 },
  { project_name: "Salt Road", role: "Camera operator", year: 2024, client_brand: null, project_type: "Short film", verification_status: null, endorsement_count: 2 },
  { project_name: "Night Shift", role: "DoP", year: 2023, client_brand: null, project_type: null, verification_status: "pending", endorsement_count: 0 },
  { project_name: "   ", role: "x", year: null, client_brand: null, project_type: null, verification_status: null, endorsement_count: 0 },
];

/** A stand-in for the service client: every query resolves to what the table holds, and says which query it was. */
function fakeAdmin(tables: Record<string, unknown>) {
  return {
    from(table: string) {
      let columns = "";
      let head = false;
      const b: Record<string, unknown> = {};
      for (const m of ["eq", "neq", "in", "or", "not", "gte", "lte", "order", "limit"]) b[m] = () => b;
      b.select = (cols: string, opts?: { head?: boolean }) => {
        columns = cols;
        head = Boolean(opts?.head);
        return b;
      };
      const result = () => {
        if (table === "profiles") return { data: PROFILE };
        if (table === "credits" && head) return { count: 0 };
        if (table === "credits" && columns.startsWith("project_name, role, year")) return { data: tables.topCredits };
        return { data: [], count: 0 };
      };
      b.maybeSingle = () => Promise.resolve(result());
      b.then = (resolve: (v: unknown) => unknown) => resolve(result());
      return b;
    },
  } as never;
}

describe("the context Kreto is given about the person", () => {
  it("ranks the evidence behind a credit", () => {
    expect(creditEvidence({ verification_status: "verified", endorsement_count: 5 })).toBe("verified");
    expect(creditEvidence({ verification_status: "pending", endorsement_count: 1 })).toBe("co-signed");
    expect(creditEvidence({ verification_status: null, endorsement_count: null })).toBe("claimed");
  });

  it("loads the skills (deduplicated) and the Passport's best credits, with their evidence", async () => {
    const ctx = await loadCopilotContext(fakeAdmin({ topCredits: TOP_CREDITS }), "u1");
    expect(ctx.skills).toEqual(["Handheld", "Night exteriors", "Surf"]);
    expect(ctx.top_credits).toEqual([
      { project_name: "Static Bloom", role: "DoP", year: 2025, client: "Maya Rios", project_type: "Music video", evidence: "verified" },
      { project_name: "Salt Road", role: "Camera operator", year: 2024, client: null, project_type: "Short film", evidence: "co-signed" },
      { project_name: "Night Shift", role: "DoP", year: 2023, client: null, project_type: null, evidence: "claimed" },
    ]);
    expect(ctx.bio).toContain("music videos");
  });

  it("degrades to an empty list when the credits cannot be read", async () => {
    const ctx = await loadCopilotContext(fakeAdmin({ topCredits: undefined }), "u1");
    expect(ctx.top_credits).toEqual([]);
    expect(ctx.skills).toEqual(["Handheld", "Night exteriors", "Surf"]);
  });

  it("puts the bio, the skills and the credits into the preamble, honest about what each is", async () => {
    const ctx = await loadCopilotContext(fakeAdmin({ topCredits: TOP_CREDITS }), "u1");
    const text = renderContextPreamble(ctx as never, "gigs");
    expect(text).toContain("Bio (written by the user, not verified): I shoot music videos and short films, mostly at night.");
    expect(text).toContain("Skills: Handheld, Night exteriors, Surf");
    expect(text).toContain("- Static Bloom, DoP (2025) for Maya Rios — Music video [verified]");
    expect(text).toContain("- Salt Road, Camera operator (2024) — Short film [co-signed]");
    expect(text).toContain("- Night Shift, DoP (2023) [claimed]");
    expect(text).toContain("never present a claimed credit as verified");
  });

  it("leaves those lines out for a Passport that has none, instead of printing empty headings", async () => {
    const ctx = await loadCopilotContext(fakeAdmin({ topCredits: [] }), "u1");
    const text = renderContextPreamble({ ...ctx, bio: null, skills: [], top_credits: [] } as never, "home");
    expect(text).not.toContain("Bio (written");
    expect(text).not.toContain("Skills:");
    expect(text).not.toContain("Credits on their Passport");
  });

  it("bounds the bio", () => {
    const text = renderContextPreamble({ user_id: "u", full_name: "A", first_name: "A", username: null, role: null, sub_roles: null, location: null, account_type: null, bio: "word ".repeat(400), skills: [], top_credits: [], active_projects: [], unpaid_invoices_count: 0, unpaid_invoices_total: 0, invoice_currency: null, draft_invoices_count: 0, draft_invoices_total: 0, draft_invoices_currency: null, upcoming_events: [], recent_credits_count: 0, recent_activity: { tasks_completed: [], tasks_due_soon: [], credits_added: [], new_connections: 0, invoices_paid: [], invoices_sent: [], unread_notifications: 0, last_notification_titles: [] } } as never, "home");
    const bioLine = text.split("\n").find((l) => l.startsWith("Bio (written"))!;
    expect(bioLine.length).toBeLessThan(560);
  });
});
