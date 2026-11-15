// What Kreto sees for one message: Auto sends what the message is about plus a summary of the rest, a chosen set shares
// nothing else (and Kreto is told so), callers without a choice keep everything; paid invoices say who vouches for them;
// what Kreto learns on its own never includes secrets, and money or contact details only on request.
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  KRETO_CONTEXT_SECTIONS as SERVER_SECTIONS,
  contextSourcesHeader,
  planKretoContext,
} from "../../../supabase/functions/_shared/kretoContext";
import { memoryWriteAllowed, messageHasSecret } from "../../../supabase/functions/_shared/memoryPolicy";
import { KRETO_CONTEXT_SECTIONS, contextChoiceLabel, readContextChoice, sourcesLabel, writeContextChoice } from "../kretoContext";
import { parseKretoSources } from "../thriveCopilot";

vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: vi.fn() }));
// copilotContext is a Deno file (an `npm:` import): load it at run time so the browser app's type check never resolves it.
const MODULE = "../../../supabase/functions/_shared/copilotContext";
type CopilotContext = Record<string, unknown>;
const { isProviderConfirmedPaid, renderContextPreamble } = (await import(/* @vite-ignore */ MODULE)) as {
  isProviderConfirmedPaid: (inv: { status?: string | null; stripe_payment_intent_id?: string | null }) => boolean;
  renderContextPreamble: (ctx: CopilotContext, surface?: string, surfaceContext?: Record<string, unknown>, plan?: ReturnType<typeof planKretoContext>) => string;
};

const ctx = (): CopilotContext => ({
  user_id: "u1",
  full_name: "Maya Laurent",
  first_name: "Maya",
  username: "maya",
  role: "Director",
  sub_roles: null,
  location: "Paris",
  account_type: null,
  bio: "Music video director.",
  skills: ["Directing", "Editing"],
  top_credits: [{ project_name: "Night Shoot", role: "Director", year: 2026, client: null, project_type: null, evidence: "claimed" }],
  active_projects: [{ id: "p1", title: "Night Shoot", status: "active", pinned_stage: "Edit", my_role: "owner", updated_at: "2026-11-10" }],
  unpaid_invoices_count: 2,
  unpaid_invoices_total: 4200,
  invoice_currency: "EUR",
  draft_invoices_count: 1,
  draft_invoices_total: 900,
  draft_invoices_currency: "EUR",
  upcoming_events: [{ id: "e1", title: "Wrap party", start_time: "2026-11-20T19:00:00Z", status: "published" }],
  recent_credits_count: 1,
  recent_activity: {
    tasks_completed: [{ title: "Colour pass", project_id: "p1", updated_at: new Date().toISOString() }],
    tasks_due_soon: [],
    credits_added: [],
    new_connections: 0,
    invoices_paid: [
      { invoice_number: "INV-7", total_amount: 1500, currency: "EUR", paid_at: new Date().toISOString(), provider_confirmed: true },
      { invoice_number: "INV-8", total_amount: 600, currency: "EUR", paid_at: new Date().toISOString(), provider_confirmed: false },
    ],
    invoices_sent: [],
    unread_notifications: 0,
    last_notification_titles: [],
  },
} as unknown as CopilotContext);

describe("planning what Kreto sees", () => {
  it("a caller with no choice keeps everything, exactly as before", () => {
    const plan = planKretoContext({ text: "hi" });
    expect(plan.mode).toBe("full");
    expect(renderContextPreamble(ctx(), "home", undefined, plan)).toBe(renderContextPreamble(ctx(), "home"));
  });

  it("Auto: the sections the message is about in detail, the rest as a summary", () => {
    const plan = planKretoContext({ include: "auto", text: "Which invoices are still unpaid?" });
    expect(plan.depth).toEqual({ passport: "summary", projects: "summary", money: "detail", events: "summary" });
    const text = renderContextPreamble(ctx(), "home", undefined, plan);
    expect(text).toMatch(/Invoices SENT and awaiting payment.*EUR 4200\.00/);
    expect(text).toMatch(/Active projects \(names only\): "Night Shoot" \[id: p1\]/);
    expect(text).not.toMatch(/stage: Edit|Bio \(written|Colour pass|on 11\/20/);
    expect(text).toMatch(/Upcoming events they're hosting: 1 \(next: "Wrap party"\)\./);
    expect(text).toMatch(/SUMMARY ONLY for this message: Passport, Projects, Events/);
  });

  it("Auto: an overview question, the page and an open project bring sections in", () => {
    expect(Object.values(planKretoContext({ include: "auto", text: "Catch me up" }).depth).every((d) => d === "detail")).toBe(true);
    expect(planKretoContext({ include: "auto", text: "hello", surface: "pay" }).depth.money).toBe("detail");
    expect(planKretoContext({ include: "auto", text: "hello", projectSelected: true }).depth.projects).toBe("detail");
  });

  it("chosen: only the ticked parts are shared; Kreto is told the rest was not, and never claims nothing happened", () => {
    const plan = planKretoContext({ include: ["projects"], text: "What do I owe my crew?" });
    expect(plan.depth).toEqual({ passport: "omitted", projects: "detail", money: "omitted", events: "omitted" });
    const text = renderContextPreamble(ctx(), "home", undefined, plan);
    expect(text).not.toMatch(/4200|INV-7|Invoices|Wrap party|Directing/);
    expect(text).toMatch(/NOT SHARED for this message \(the person chose not to include them\): Passport, Money, Events/);
    expect(text).not.toMatch(/NOTHING happened/);
    expect(text).toMatch(/Colour pass/);
  });

  it("unknown sections are ignored; memory can be switched off", () => {
    expect(planKretoContext({ include: ["money", "wallet"], text: "x" }).depth.money).toBe("detail");
    expect(planKretoContext({ include: "auto", memory: false, text: "x" }).memory).toBe(false);
    expect(planKretoContext({ text: "x" }).memory).toBe(true);
  });

  it("the sources header names what was used, never the content", () => {
    const plan = planKretoContext({ include: ["projects", "money"], text: "x" });
    expect(contextSourcesHeader(plan, { memories: 3, projectFacts: true })).toBe("projects,money,memory:3,project-facts");
    expect(contextSourcesHeader(planKretoContext({ include: [], text: "x" }), { memories: 0, projectFacts: false })).toBe("");
  });
});

describe("paid means proven", () => {
  it("only a payment provider's reference makes an invoice paid; the issuer's own mark is labelled as such", () => {
    expect(isProviderConfirmedPaid({ status: "paid", stripe_payment_intent_id: "pi_1" })).toBe(true);
    expect(isProviderConfirmedPaid({ status: "paid", stripe_payment_intent_id: " " })).toBe(false);
    expect(isProviderConfirmedPaid({ status: "paid" })).toBe(false); // before the provider column exists
    const text = renderContextPreamble(ctx(), "home");
    expect(text).toMatch(/INV-7: EUR 1500\.00 .* — confirmed by the payment provider/);
    expect(text).toMatch(/INV-8: EUR 600\.00 .* — marked paid by the user, no payment provider confirmation/);
    expect(text).toMatch(/Say an invoice was paid only when it is confirmed by the payment provider/);
  });

  it("speaks Kretopia's names for the page, never internal ones", () => {
    expect(renderContextPreamble(ctx(), "pay")).toMatch(/Currently on surface: KrePay/);
    expect(renderContextPreamble(ctx(), "desk")).toMatch(/Currently on surface: Studio/);
    expect(renderContextPreamble(ctx(), "pay")).not.toMatch(/Thrive/);
  });
});

describe("what Kreto may learn on its own", () => {
  it("never a secret, not even when asked", () => {
    expect(messageHasSecret("my password is hunter2")).toBe(true);
    expect(messageHasSecret("card 4242 4242 4242 4242")).toBe(true);
    expect(memoryWriteAllowed("Remember my IBAN FR76 3000 6000 0112 3456 7890 189", { kind: "fact", label: "Bank details" })).toEqual({ allowed: false, reason: "secret" });
  });

  it("money figures and other people's contact details only when the person says remember", () => {
    expect(memoryWriteAllowed("My day rate is $1,500 now", { kind: "rate", label: "Day rate: $1,500" })).toEqual({ allowed: false, reason: "money" });
    expect(memoryWriteAllowed("Remember that my day rate is $1,500", { kind: "rate", label: "Day rate: $1,500" })).toEqual({ allowed: true });
    expect(memoryWriteAllowed("Marcus is my DoP, marcus@lens.co", { kind: "contact", label: "DoP Marcus", body: "marcus@lens.co" })).toEqual({ allowed: false, reason: "contact" });
    expect(memoryWriteAllowed("Note that Marcus is on +44 20 7946 0958", { kind: "contact", label: "Marcus: +44 20 7946 0958" })).toEqual({ allowed: true });
  });

  it("everything else durable may be learned; a date is not a phone number", () => {
    expect(memoryWriteAllowed("Marcus is my go-to DoP for night shoots", { kind: "vendor", label: "Preferred DoP: Marcus" })).toEqual({ allowed: true });
    expect(memoryWriteAllowed("The edit locks on 2026-11-15", { kind: "deadline", label: "Edit lock 2026-11-15" })).toEqual({ allowed: true });
  });
});

describe("the composer's side", () => {
  beforeEach(() => localStorage.clear());

  it("same sections as the server", () => {
    expect([...KRETO_CONTEXT_SECTIONS]).toEqual([...SERVER_SECTIONS]);
  });

  it("remembers the choice on this device and falls back to Auto with memory on", () => {
    expect(readContextChoice()).toEqual({ context: "auto", memory: true });
    writeContextChoice({ context: ["money", "projects"], memory: false });
    expect(readContextChoice()).toEqual({ context: ["projects", "money"], memory: false });
    localStorage.setItem("kreto:context:v1", "{bad");
    expect(readContextChoice()).toEqual({ context: "auto", memory: true });
    expect(contextChoiceLabel({ context: [], memory: true })).toBe("Identity only");
    expect(contextChoiceLabel({ context: ["money"], memory: true })).toBe("Money");
  });

  it("a reply says what it drew on", () => {
    const sources = parseKretoSources("projects,money,memory:3,project-facts,unknown-thing");
    expect(sources).toEqual({ sections: ["projects", "money"], memories: 3, projectFacts: true });
    expect(sourcesLabel(sources)).toBe("Projects, Money, project facts, 3 memories");
    expect(sourcesLabel(parseKretoSources("memory:1"))).toBe("1 memory");
    expect(sourcesLabel(parseKretoSources(""))).toBeNull();
  });
});
