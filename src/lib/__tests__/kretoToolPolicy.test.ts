// The tool audit, kept true: every tool any migration registers has a governance entry, the policy only ever tightens,
// the agreed approval matrix holds, and nothing people see names an internal system.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TOOL_POLICY,
  classifyToolFailure,
  cleanToolDescription,
  governTool,
  governedTier,
  toolPolicy,
  type RegistryTier,
} from "../../../supabase/functions/_shared/kretoToolPolicy";

const MIGRATIONS = path.resolve(__dirname, "../../../supabase/migrations");

/** Tool names and descriptions every migration inserts into orch_tool_registry (later rows win). */
function registryFromMigrations(): Map<string, { description: string; tier: string }> {
  const out = new Map<string, { description: string; tier: string }>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
    if (!sql.includes("orch_tool_registry")) continue;
    for (const insert of sql.matchAll(/INSERT INTO (?:public\.)?orch_tool_registry\s*\(([^)]*)\)\s*VALUES(.*?);/gis)) {
      const cols = insert[1].split(",").map((c) => c.trim());
      const di = cols.indexOf("description");
      const ri = cols.indexOf("risk_level");
      for (const row of insert[2].matchAll(/\(\s*'([a-z_]+)'\s*,((?:\s*'(?:[^']|'')*'\s*,?|\s*[^,()]+,?){0,4})/g)) {
        const values = [...`'${row[1]}',${row[2]}`.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
        out.set(row[1], { description: di >= 0 ? values[di] ?? "" : "", tier: ri >= 0 ? values[ri] ?? "" : "" });
      }
    }
  }
  return out;
}

const REGISTRY = registryFromMigrations();
const TIERS: RegistryTier[] = ["safe_auto", "requires_approval", "locked"];
const RANK = { safe_auto: 0, requires_approval: 1, locked: 2 } as const;
const INTERNAL = /thrive|firecrawl|lovable|gemini|openai|supabase|\bAI\b|assistant|chatbot|copilot/i;

describe("the audit covers every tool", () => {
  it("every tool a migration registers has a policy, and the policy names no tool that does not exist", () => {
    expect(REGISTRY.size).toBeGreaterThanOrEqual(65);
    const missing = [...REGISTRY.keys()].filter((t) => !(t in TOOL_POLICY));
    expect(missing).toEqual([]);
    const stale = Object.keys(TOOL_POLICY).filter((t) => !REGISTRY.has(t));
    expect(stale).toEqual([]);
  });
});

describe("the policy only tightens", () => {
  it("the governed tier is never looser than the registry row, for every tool and every tier", () => {
    for (const tool of [...Object.keys(TOOL_POLICY), "made_up_tool"]) {
      for (const tier of TIERS) expect(RANK[governedTier(tool, tier)]).toBeGreaterThanOrEqual(RANK[tier]);
    }
  });

  it("an unknown tool or a malformed tier needs approval", () => {
    expect(governedTier("made_up_tool", "safe_auto")).toBe("requires_approval");
    expect(governedTier("create_task", "SAFE")).toBe("requires_approval");
    expect(governedTier("create_task", null)).toBe("requires_approval");
    expect(toolPolicy("made_up_tool").floor).toBe("requires_approval");
  });
});

describe("the agreed approval matrix", () => {
  const floor = (t: string) => toolPolicy(t).floor;

  it("sending, publishing, money, access, shared state and deleting never run on their own", () => {
    for (const [tool, p] of Object.entries(TOOL_POLICY)) {
      if (["send", "publish", "money", "permission", "shared", "destructive"].includes(p.risk)) expect([tool, floor(tool)]).not.toEqual([tool, "safe_auto"]);
    }
  });

  it("the tools that used to run on their own now ask: assigning work, milestones, the public site, guest matching, web research", () => {
    for (const t of ["assign_task", "generate_milestones", "refresh_epk", "match_event_guests", "research_web", "find_sponsors", "search_scouted_gigs", "enrich_profile"]) {
      expect(REGISTRY.get(t)?.tier).toBe("safe_auto");
      expect(floor(t)).toBe("requires_approval");
    }
  });

  it("locked for agents: charging a card, deleting a project, and the profile refresh that writes onto other Passports", () => {
    expect(Object.entries(TOOL_POLICY).filter(([, p]) => p.floor === "locked").map(([t]) => t).sort()).toEqual(["charge_card", "delete_project", "refresh_profile"]);
  });

  it("only the person-supplied link reader reaches outside without asking", () => {
    expect(Object.entries(TOOL_POLICY).filter(([, p]) => p.risk === "external" && p.floor === "safe_auto").map(([t]) => t)).toEqual(["analyze_profile_url"]);
  });

  it("a stricter tier always comes with a reason people can read", () => {
    for (const [tool, p] of Object.entries(TOOL_POLICY)) if (p.floor !== "safe_auto") expect([tool, p.reason?.length ?? 0]).not.toEqual([tool, 0]);
  });
});

describe("people see Kretopia's words", () => {
  it("labels and reasons name no internal system and claim nothing unproven", () => {
    for (const [tool, p] of Object.entries(TOOL_POLICY)) {
      expect([tool, `${p.label} ${p.reason ?? ""}`]).not.toEqual([tool, expect.stringMatching(INTERNAL)]);
      expect(p.label).not.toMatch(/verified/i);
    }
  });

  it("every registry description, cleaned, is free of internal names and the untrue 'verified credit'", () => {
    // The raw rows really carry them (so this is not passing on empty descriptions).
    expect(REGISTRY.get("search_creators")?.description).toMatch(/ThriveIN/);
    expect(REGISTRY.get("draft_credit")?.description).toMatch(/verified credit/);
    expect(cleanToolDescription(REGISTRY.get("search_creators")?.description)).toBe("Search Kretopia profiles by role/location/budget/availability");
    expect(cleanToolDescription(REGISTRY.get("draft_credit")?.description)).toBe("Draft a Credit after project completion");
    for (const [tool, row] of REGISTRY) {
      const clean = cleanToolDescription(row.description);
      expect([tool, clean]).not.toEqual([tool, expect.stringMatching(/thrive|firecrawl|verified credit/i)]);
    }
    expect(cleanToolDescription("Log a ThriveCredit in ThriveDesk via Firecrawl + AI")).toBe("Log a Credit in Studio via web research");
  });

  it("a governed row keeps its registry tier for the audit log", () => {
    expect(governTool({ tool_name: "assign_task", risk_level: "safe_auto", description: "Assign in ThriveDesk" })).toMatchObject({
      risk_level: "requires_approval",
      registry_risk_level: "safe_auto",
      description: "Assign in Studio",
    });
  });
});

describe("failures say what they mean", () => {
  it("a refusal before acting did not go through; a lost connection, timeout or server error may have acted", () => {
    expect(classifyToolFailure({ status: 400 }).outcome).toBe("failed");
    expect(classifyToolFailure({ status: 403 }).outcome).toBe("failed");
    for (const status of [408, 500, 502, 503, 504]) expect(classifyToolFailure({ status }).outcome).toBe("unknown");
    expect(classifyToolFailure({ thrown: true }).outcome).toBe("unknown");
    expect(classifyToolFailure({}).outcome).toBe("unknown");
    expect(classifyToolFailure({ status: 400 }).message).toBe("This didn't go through. Nothing was done.");
    expect(classifyToolFailure({ thrown: true }).message).toMatch(/couldn't confirm whether this went through/);
  });
});
