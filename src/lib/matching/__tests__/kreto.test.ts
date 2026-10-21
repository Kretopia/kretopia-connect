import { describe, expect, it, vi } from "vitest";
import { BRIEF_MAX, KRETO_ERROR_COPY, KretoNeedError, requestNeedFromBrief, type InvokeClient } from "../kreto";

const BRIEF = "We need TikTok creators in Los Angeles for a swimwear drop.";
const client = (result: { data?: unknown; error?: unknown } | (() => Promise<never>)) => {
  const invoke = vi.fn(typeof result === "function" ? result : async () => ({ data: result.data ?? null, error: result.error ?? null }));
  return { client: { functions: { invoke } } as unknown as InvokeClient, invoke };
};
const httpError = (body: unknown, status = 400) => ({ context: new Response(typeof body === "string" ? body : JSON.stringify(body), { status }) });
const fails = async (c: InvokeClient, brief = BRIEF) => { try { await requestNeedFromBrief(c, brief); } catch (e) { return e as KretoNeedError; } throw new Error("did not fail"); };

describe("requestNeedFromBrief", () => {
  const need = { craft: { category: "creator", importance: "required" }, skills: [], themes: [{ term: "swimwear", importance: "preferred" }], platforms: [{ platform: "tiktok", importance: "required" }] };

  it("returns the criteria and the left-out parts, after checking them with the search's own schema", async () => {
    const { client: c, invoke } = client({ data: { need, ignored: [" Budget $500 ", "", "x", 4] } });
    const out = await requestNeedFromBrief(c, `  ${BRIEF}  `);
    expect(invoke).toHaveBeenCalledWith("kreto-structure-need", { body: { brief: BRIEF } });
    expect(out.need.craft).toEqual({ category: "creator", importance: "required" });
    expect(out.ignored).toEqual(["Budget $500"]);
  });

  it("refuses a brief that is too short or too long without calling Kreto", async () => {
    const { client: c, invoke } = client({ data: { need } });
    expect((await fails(c, "short")).kind).toBe("brief_invalid");
    expect((await fails(c, "x".repeat(BRIEF_MAX + 1))).kind).toBe("brief_invalid");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not trust an answer the schema rejects, even though the function already cleaned it", async () => {
    for (const bad of [{ need: { craft: { category: "wizard", importance: "required" } } }, { need: { skills: [{ term: "x", importance: "required" }] } }, { need: "text" }, {}, null]) {
      expect((await fails(client({ data: bad }).client)).kind).toBe("invalid_output");
    }
  });

  it("says there is nothing to search by when the answer is empty", async () => {
    const e = await fails(client({ data: { need: { skills: [], themes: [], platforms: [] }, ignored: ["Budget $500"] } }).client);
    expect(e.kind).toBe("no_criteria");
    expect(e.ignored).toEqual(["Budget $500"]);
  });

  it("turns each failure of the function into a kind, keeping what it left out", async () => {
    const kind = async (body: unknown, status: number) => (await fails(client({ error: httpError(body, status) }).client)).kind;
    expect(await kind({ error: "rate_limited" }, 429)).toBe("rate_limited");
    expect(await kind({ error: "ai_credits" }, 402)).toBe("ai_credits");
    expect(await kind({ error: "timeout" }, 504)).toBe("timeout");
    expect(await kind({ error: "invalid_output" }, 502)).toBe("invalid_output");
    expect(await kind({ error: "brief_invalid" }, 400)).toBe("brief_invalid");
    const none = await fails(client({ error: httpError({ error: "no_criteria", ignored: ["Budget $500"] }, 422) }).client);
    expect([none.kind, none.ignored]).toEqual(["no_criteria", ["Budget $500"]]);
  });

  it("treats anything it cannot read as 'unavailable', so the form still works", async () => {
    expect((await fails(client({ error: httpError("<html>502</html>", 502) }).client)).kind).toBe("unavailable");
    expect((await fails(client({ error: httpError({ error: "something_new" }, 500) }).client)).kind).toBe("unavailable");
    expect((await fails(client({ error: new Error("network") }).client)).kind).toBe("unavailable");
    expect((await fails(client(async () => { throw new Error("offline"); }).client)).kind).toBe("unavailable");
  });

  it("gives every failure words that point to setting the criteria by hand", () => {
    for (const [kind, copy] of Object.entries(KRETO_ERROR_COPY)) {
      if (kind === "brief_invalid") continue;
      expect(copy).toMatch(/criteria/);
    }
  });
});
