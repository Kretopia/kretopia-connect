// A response helper declared at module level cannot see `const corsHeaders = corsFor(req)` declared inside the request
// handler: its first call throws "corsHeaders is not defined", so the function answers every request, errors included, with
// a platform 500. Sixteen functions shipped like this after the CORS allow-list was moved into the handler. This reads every
// edge function and fails on any module-level function whose body reads a `corsHeaders` that is neither a parameter, nor
// declared inside it, nor declared at module level.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FUNCTIONS = resolve(__dirname, "../../../supabase/functions");

export function outOfScopeCorsHelpers(source: string): string[] {
  if (!source.includes("corsHeaders")) return [];
  const declaredAtModuleLevel =
    /^(?:export\s+)?(?:const|let|var)\s+corsHeaders\b/m.test(source) || /import\s*\{[^}]*\bcorsHeaders\b[^}]*\}/.test(source);
  if (declaredAtModuleLevel) return [];
  const bad: string[] = [];
  for (const m of source.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)[^{]*\{([\s\S]*?)^\}/gm)) {
    const [, name, params, body] = m;
    if (params.includes("corsHeaders")) continue; // passed in: fine
    if (/(?:const|let|var)\s+corsHeaders\b/.test(body)) continue; // declared inside the helper: fine
    if (body.includes("corsHeaders")) bad.push(name);
  }
  return bad;
}

describe("edge functions: response helpers can see the request's CORS headers", () => {
  it("detects the failure it exists for (positive control)", () => {
    const broken = `serve(async (req) => {\n  const corsHeaders = corsFor(req);\n  return json({});\n});\nfunction json(b: unknown) {\n  return new Response("x", { headers: { ...corsHeaders } });\n}\n`;
    expect(outOfScopeCorsHelpers(broken)).toEqual(["json"]);
    const passedIn = `function json(corsHeaders: Record<string, string>, b: unknown) {\n  return new Response("x", { headers: { ...corsHeaders } });\n}\n`;
    expect(outOfScopeCorsHelpers(passedIn)).toEqual([]);
    const moved = `serve(async (req) => {\n  const corsHeaders = corsFor(req);\n  function json(b: unknown) {\n    return new Response("x", { headers: { ...corsHeaders } });\n  }\n  return json({});\n});\n`;
    expect(outOfScopeCorsHelpers(moved)).toEqual([]);
    const moduleLevel = `const corsHeaders = { a: "b" };\nfunction json(b: unknown) {\n  return new Response("x", { headers: { ...corsHeaders } });\n}\n`;
    expect(outOfScopeCorsHelpers(moduleLevel)).toEqual([]);
  });

  it("finds no such helper in any function", () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const dir of readdirSync(FUNCTIONS, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name.startsWith("_")) continue;
      const file = resolve(FUNCTIONS, dir.name, "index.ts");
      if (!existsSync(file)) continue;
      scanned += 1;
      const bad = outOfScopeCorsHelpers(readFileSync(file, "utf8"));
      if (bad.length) offenders.push(`${dir.name}: ${bad.join(", ")}`);
    }
    expect(scanned).toBeGreaterThan(300);
    expect(offenders).toEqual([]);
  });
});
