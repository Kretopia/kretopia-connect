// Kreto's tool governance: every registry tool's risk, the least approval it needs, and the words people see for it.
// Pure (no I/O), shared by agent-orchestrator and the plan executor's checks, and covered by a test that fails when a
// registry tool has no policy.
//
// Rule: the governed tier is the STRICTER of the registry row and this floor. The policy can only add approval or lock a
// tool; it never makes a tool run without asking. An unknown tool needs approval. (KRETO_SAFETY_GOVERNANCE.md §2, the
// approval matrix: sending, publishing, inviting, changing shared state or starting a payment ask first; deleting data,
// charging and tools with a known safety bug are locked for agents; web research asks each time until a consent setting
// exists.)

export type RegistryTier = "safe_auto" | "requires_approval" | "locked";

export type ToolRisk =
  | "read" // looks things up, changes nothing
  | "draft" // prepares something private; sending is a separate tool
  | "own_record" // changes only the person's own records
  | "shared" // changes something other people see or work from
  | "external" // reaches outside Kretopia (web research, third-party lookups)
  | "send" // sends to another person
  | "publish" // makes something public
  | "money" // invoices, quotes, payment links, charges
  | "permission" // changes who can access what
  | "destructive"; // deletes or forgets

export interface ToolPolicy {
  risk: ToolRisk;
  /** The least approval this tool needs, whatever its registry row says. */
  floor: RegistryTier;
  /** What people see for it on cards and in history: Kretopia's words, never internal names. */
  label: string;
  /** Why the floor is stricter than "runs on its own", when it is. Shown on blocked actions. */
  reason?: string;
}

const RANK: Record<RegistryTier, number> = { safe_auto: 0, requires_approval: 1, locked: 2 };
const auto = (risk: ToolRisk, label: string): ToolPolicy => ({ risk, floor: "safe_auto", label });
const ask = (risk: ToolRisk, label: string, reason: string): ToolPolicy => ({ risk, floor: "requires_approval", label, reason });
const lock = (risk: ToolRisk, label: string, reason: string): ToolPolicy => ({ risk, floor: "locked", label, reason });

const SENDS = "It reaches another person, so it waits for you.";
const PUBLISHES = "It changes something people can see, so it waits for you.";
const SHARED = "It changes what other people work from, so it waits for you.";
const WEB = "It looks outside Kretopia, so I ask each time.";
const MONEY = "It involves money, so it waits for you.";
const ACCESS = "It changes who can access your work, so it waits for you.";

export const TOOL_POLICY: Readonly<Record<string, ToolPolicy>> = {
  // Reads
  ask_clarification: auto("read", "Ask you a question"),
  find_user: auto("read", "Find a person"),
  get_project_summary: auto("read", "Summarise a project"),
  list_my_projects: auto("read", "List your projects"),
  rank_creators: auto("read", "Rank creators"),
  recall_memory: auto("read", "Recall what you told me"),
  score_applicants: auto("read", "Score applicants"),
  search_creators: auto("read", "Search creators"),
  summarize_opportunities: auto("read", "Summarise opportunities"),
  triage_message: auto("read", "Sort a message"),
  weekly_money_summary: auto("read", "Summarise your week's money"),

  // Private drafts (sending is always a separate tool)
  chase_followups: auto("draft", "Find follow-ups and draft them"),
  draft_credit: auto("draft", "Draft a Credit"),
  draft_gig_application: auto("draft", "Draft a gig application"),
  draft_milestone_invoice: auto("draft", "Draft a milestone invoice"),
  draft_outreach: auto("draft", "Draft outreach"),
  draft_outreach_email: auto("draft", "Draft an outreach email"),
  generate_event_cover: auto("draft", "Make an event cover"),
  negotiate_rate: auto("draft", "Draft a rate reply"),
  recycle_pitch: auto("draft", "Rework a pitch"),
  suggest_missing_credits: auto("draft", "Suggest missing Credits"),
  // External, but the person supplied the link in the request: reading it is what they asked for.
  analyze_profile_url: auto("external", "Read a link you shared"),

  // The person's own records
  add_credit: auto("own_record", "Add a Credit to your Passport"),
  create_task: auto("own_record", "Create a task"),
  mark_lead: auto("own_record", "Mark a lead"),
  mark_task_done: auto("own_record", "Mark a task done"),
  remember: auto("own_record", "Remember this"),
  scan_receipt: auto("own_record", "Read a receipt"),
  schedule_reminder: auto("own_record", "Set a reminder"),

  // Shared state
  archive_project: ask("shared", "Archive a project", SHARED),
  assign_task: ask("shared", "Assign a task", "It changes someone else's work, so it waits for you."),
  create_event: ask("shared", "Create an event", SHARED),
  create_project: ask("shared", "Create a project", SHARED),
  generate_milestones: ask("shared", "Plan project milestones", SHARED),
  match_event_guests: ask("shared", "Match guests to an event", SHARED),
  rsvp_to_event: ask("shared", "RSVP to an event", SHARED),
  spin_up_project: ask("shared", "Start a project with someone", "It creates a project, invites someone and messages them, so it waits for you."),

  // Outside Kretopia: asked each time until a web research setting exists
  enrich_profile: ask("external", "Look up your public profiles", WEB),
  find_sponsors: ask("external", "Research sponsors", WEB),
  research_web: ask("external", "Research the web", WEB),
  search_scouted_gigs: ask("external", "Search gigs outside Kretopia", WEB),
  refresh_profile: lock("external", "Refresh profile suggestions", "It can write suggestions onto other people's Passports, so I can't run it until that is fixed."),

  // Sends to another person
  apply_to_gig: ask("send", "Apply to a gig", SENDS),
  request_vouch: ask("send", "Ask for a vouch", SENDS),
  send_chase_email: ask("send", "Send a payment reminder", SENDS),
  send_dm: ask("send", "Send a message", SENDS),
  send_event_invite: ask("send", "Send an event invite", SENDS),
  send_message: ask("send", "Send a message", SENDS),
  send_message_to_collaborator: ask("send", "Message your team", SENDS),
  send_outreach_email: ask("send", "Send an outreach email", SENDS),
  send_reminder: ask("send", "Send a reminder", SENDS),
  send_triage_reply: ask("send", "Send a reply", SENDS),
  start_video_call: ask("send", "Start a call", "It posts a call link for your team, so it waits for you."),

  // Public
  create_gig: ask("publish", "Post a gig", PUBLISHES),
  publish_credit: ask("publish", "Publish a Credit", PUBLISHES),
  refresh_epk: ask("publish", "Update your public site", PUBLISHES),
  vouch_credit: ask("publish", "Vouch for a Credit", PUBLISHES),

  // Money
  draft_invoice: ask("money", "Draft an invoice", MONEY),
  draft_quote: ask("money", "Draft a quote", MONEY),
  send_payment_link: ask("money", "Send a payment link", MONEY),
  charge_card: lock("money", "Charge a card", "Charging a card is never done by Kreto."),

  // Access
  add_collaborator: ask("permission", "Add someone to a project", ACCESS),
  remove_collaborator: ask("permission", "Remove someone from a project", ACCESS),

  // Deleting
  forget_memory: ask("destructive", "Forget something", "It deletes what I know, so it waits for you."),
  delete_project: lock("destructive", "Delete a project", "Deleting a project is yours to do in the project's settings; I can't do it for you."),
};

const UNKNOWN: ToolPolicy = { risk: "shared", floor: "requires_approval", label: "Run an action", reason: "I don't know this action well enough to run it on my own." };

export const toolPolicy = (toolName: string): ToolPolicy => TOOL_POLICY[toolName] ?? UNKNOWN;

/** The stricter of two tiers. */
export const stricterTier = (a: RegistryTier, b: RegistryTier): RegistryTier => (RANK[a] >= RANK[b] ? a : b);

const isTier = (v: unknown): v is RegistryTier => v === "safe_auto" || v === "requires_approval" || v === "locked";

/** The tier Kreto acts on: never looser than the registry, never looser than the policy. A malformed tier needs approval. */
export function governedTier(toolName: string, registryTier: unknown): RegistryTier {
  return stricterTier(isTier(registryTier) ? registryTier : "requires_approval", toolPolicy(toolName).floor);
}

/** Registry descriptions still carry old internal names and one untrue word; the model and the cards get Kretopia's. */
export function cleanToolDescription(description: string | null | undefined): string {
  return String(description ?? "")
    .replace(/Thrive\s?Desk/g, "Studio")
    .replace(/Thrive\s?Pay/g, "KrePay")
    .replace(/Thrive\s?Credits?/g, "Credit")
    .replace(/Thrive\s?IN\b/g, "Kretopia")
    .replace(/\bThrive\b/g, "Kreto")
    .replace(/Firecrawl\s*\+\s*AI|Firecrawl/gi, "web research")
    .replace(/\bverified (credit|Credit)s?\b/g, "Credit")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A registry row as Kreto acts on it: the governed tier and a clean description. */
export function governTool<T extends { tool_name: string; risk_level: unknown; description?: string | null }>(row: T): T & { risk_level: RegistryTier; registry_risk_level: unknown } {
  return { ...row, registry_risk_level: row.risk_level, risk_level: governedTier(row.tool_name, row.risk_level), description: cleanToolDescription(row.description) };
}

export type ToolOutcome = "failed" | "unknown";

/**
 * What a failed run means, truthfully. A refusal before the tool acted (a 4xx) did not go through. A lost connection, a
 * timeout or a server error after the request left (5xx) may have acted: say so, so nobody retries a send twice.
 */
export function classifyToolFailure(input: { status?: number | null; thrown?: boolean }): { outcome: ToolOutcome; message: string } {
  const status = typeof input.status === "number" ? input.status : null;
  if (input.thrown || status === null || status === 408 || status >= 500) {
    return { outcome: "unknown", message: "I couldn't confirm whether this went through. Check before trying again, so nothing happens twice." };
  }
  return { outcome: "failed", message: "This didn't go through. Nothing was done." };
}
