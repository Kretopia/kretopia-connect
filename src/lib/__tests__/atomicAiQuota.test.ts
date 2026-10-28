import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf8");
const migration = read("supabase/migrations/20261028120000_atomic_ai_quota_consume.sql");

// The behaviour itself (40 parallel calls at a cap of 5 let exactly 5 through, where the old read-then-increment
// functions let 17, 7 and 40 through) was run on a throwaway Postgres, see the PR. These guards keep the shape.
const FUNCTIONS = [
  { name: "consume_copilot_message", table: "desk_ai_usage", column: "message_count" },
  { name: "consume_studio_ai_generation", table: "studio_ai_usage", column: "generation_count" },
  { name: "consume_ai_feature_call", table: "ai_feature_usage", column: "call_count" },
];

const body = (name: string) => {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  const end = migration.indexOf("$$;", migration.indexOf("AS $$", start));
  return migration.slice(start, end);
};

describe("the daily AI quota is one atomic statement", () => {
  for (const { name, table, column } of FUNCTIONS) {
    describe(name, () => {
      const sql = body(name);

      it("increments only while the count is under the cap, in the same upsert", () => {
        expect(sql).toContain(`WHERE ${table}.${column} < _daily_cap`);
        expect(sql).toMatch(/DO UPDATE SET[\s\S]{0,140}WHERE[\s\S]{0,80}RETURNING/);
      });

      it("has no read-then-check left: the old `count >= cap` test is gone", () => {
        expect(sql).not.toMatch(/>=\s*_daily_cap/);
      });

      it("keeps the unlimited path, the identity check and a cap of zero or less denying", () => {
        expect(sql).toContain("_daily_cap = -1");
        expect(sql).toContain("auth.uid() <> _user_id");
        expect(sql).toContain("_daily_cap IS NULL OR _daily_cap <= 0");
        expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
      });
    });
  }

  it("changes no grants: the counters stay service_role only", () => {
    expect(migration).not.toMatch(/^\s*(GRANT|REVOKE)\b/im);
    expect(read("supabase/migrations/20261006120000_restrict_ai_usage_counter_rpcs.sql")).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
  });
});
