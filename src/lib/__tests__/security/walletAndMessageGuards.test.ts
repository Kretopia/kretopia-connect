import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Two client write paths the row-level policies left open (see docs/security-compliance/p0-fixes-2026-11-13.md):
//   * wallets INSERT checked only user_id, so a member without a row could create one with any balance;
//   * messages UPDATE checked only receiver_id, so the receiver could rewrite what someone else wrote.
// Both migrations were run on a local PostgreSQL 16 with Supabase-shaped roles before review. These tests keep
// their shape, and keep the app's own writes inside what the guards allow.

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const migrations = join(root, "supabase/migrations");
const WALLETS = "supabase/migrations/20261113100000_wallets_client_insert_starts_empty.sql";
const MESSAGES = "supabase/migrations/20261113101000_messages_receiver_updates_read_state_only.sql";

/** SQL without `--` comments, so a statement quoted in a comment is not taken for code. */
const code = (sql: string) => sql.replace(/--[^\n]*/g, "");

function srcFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" || e.name === "integrations" ? [] : srcFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe("wallets: a wallet created through the API starts empty", () => {
  const sql = code(read(WALLETS));

  it("runs before insert on public.wallets for the API roles only", () => {
    expect(sql).toMatch(/CREATE TRIGGER trg_wallets_client_insert_starts_empty\s+BEFORE INSERT ON public\.wallets\s+FOR EACH ROW/);
    // current_user, not auth.role(): SECURITY DEFINER functions (signup grant, wallet_credit) run as their owner.
    expect(sql).toContain("IF current_user IN ('anon', 'authenticated') THEN");
    expect(sql).not.toMatch(/auth\.role\(\)/);
  });

  it("sets the money fields itself and refuses nothing", () => {
    expect(sql).toContain("NEW.balance := 0;");
    expect(sql).toContain("NEW.credits := LEAST(GREATEST(COALESCE(NEW.credits, 0), 0), 10);");
    expect(sql).toContain("NEW.currency := 'USD';");
    expect(sql).not.toMatch(/RAISE EXCEPTION/);
  });

  it("the cap is the signup welcome grant, and WalletCard's fallback insert stays within it", () => {
    const grants = readdirSync(migrations)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(join(migrations, f), "utf8"))
      .flatMap((s) => [...s.matchAll(/INSERT INTO public\.wallets \(user_id, credits\)\s+VALUES \(NEW\.user_id, (\d+)\)/g)].map((m) => Number(m[1])));
    expect(grants.length).toBeGreaterThan(0);
    expect(grants[grants.length - 1]).toBe(10);

    const card = read("src/components/WalletCard.tsx");
    const inserted = card.match(/\.from\('wallets'\)\s*\.insert\(\{ user_id: user\.id, credits: (\d+) \}\)/);
    expect(inserted).not.toBeNull();
    expect(Number(inserted![1])).toBeLessThanOrEqual(10);
  });
});

describe("messages: the receiver may change the read state only", () => {
  const sql = code(read(MESSAGES));

  it("narrows the API roles' UPDATE privilege to the read column", () => {
    const revoke = sql.indexOf("REVOKE UPDATE ON public.messages FROM anon, authenticated;");
    const grant = sql.indexOf("GRANT UPDATE (read) ON public.messages TO authenticated;");
    expect(revoke).toBeGreaterThan(-1);
    // A table-level REVOKE also drops column grants, so the column grant must come after it.
    expect(grant).toBeGreaterThan(revoke);
    expect(sql.match(/GRANT UPDATE/g)).toHaveLength(1);
  });

  it("refuses any other change for the API roles even if the grants drift", () => {
    expect(sql).toMatch(/CREATE TRIGGER trg_messages_receiver_updates_read_state_only\s+BEFORE UPDATE ON public\.messages\s+FOR EACH ROW/);
    expect(sql).toContain("current_user IN ('anon', 'authenticated')");
    expect(sql).toContain("(to_jsonb(NEW) - 'read' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'read' - 'updated_at')");
    expect(sql).toMatch(/RAISE EXCEPTION 'Only the read state of a message can be changed'/);
  });

  it("every update of messages the app makes sets read and nothing else", () => {
    const updates: string[] = [];
    for (const file of srcFiles(join(root, "src"))) {
      const s = readFileSync(file, "utf8");
      for (const m of s.matchAll(/\.from\(["']messages["']\)\s*\.(update|upsert)\(([^)]*)\)/g)) updates.push(`${m[1]}:${m[2].replace(/\s+/g, " ").trim()}`);
    }
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) expect(u).toBe("update:{ read: true }");
  });
});
