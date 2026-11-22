import { describe, expect, it } from "vitest";
import { classifyImportFailure, describeKretoNetworkFailure, IMPORT_FAILURE_MESSAGES, isNetworkFailure } from "@/lib/importFailure";

/** Website import (and Kreto chat) failures read as what happened, never as Safari's raw "Load failed". */
const httpError = (status: number, body?: unknown) => ({
  name: "FunctionsHttpError",
  message: "Edge Function returned a non-2xx status code",
  context: new Response(body === undefined ? "oops" : JSON.stringify(body), { status }),
});

describe("classifyImportFailure", () => {
  it("a request that never got an answer is a dropped connection, in every browser's wording", async () => {
    for (const message of ["Load failed", "Failed to fetch", "NetworkError when attempting to fetch resource."]) {
      expect((await classifyImportFailure({ error: new TypeError(message) })).code).toBe("network");
    }
    expect((await classifyImportFailure({ error: { name: "FunctionsFetchError", message: "x" } })).code).toBe("network");
  });

  it("the function's own category wins, whether in a 200 body or a non-2xx body", async () => {
    expect(await classifyImportFailure({ data: { success: false, code: "timeout", error: "x" } })).toEqual({ code: "timeout", message: IMPORT_FAILURE_MESSAGES.timeout });
    expect((await classifyImportFailure({ data: { success: false, code: "unreachable" } })).code).toBe("unreachable");
    expect((await classifyImportFailure({ error: httpError(500, { code: "rate_limited" }) })).code).toBe("rate_limited");
  });

  it("without a category, the HTTP status says what kind of failure it was", async () => {
    const cases: Array<[number, string]> = [[400, "invalid_url"], [401, "auth"], [402, "quota"], [429, "rate_limited"], [504, "timeout"], [500, "upstream"]];
    for (const [status, code] of cases) expect((await classifyImportFailure({ error: httpError(status) })).code).toBe(code);
  });

  it("LinkedIn's block is 'not supported', with the manual path", async () => {
    const f = await classifyImportFailure({ data: { isLinkedInBlock: true, error: "LinkedIn blocks…" } });
    expect(f.code).toBe("unsupported");
    expect(f.message).toMatch(/add your work manually/);
  });

  it("an unknown answer never claims success and names the manual path", async () => {
    const f = await classifyImportFailure({ data: { success: false } });
    expect(f).toEqual({ code: "unknown", message: IMPORT_FAILURE_MESSAGES.unknown });
    expect(Object.values(IMPORT_FAILURE_MESSAGES).join(" ")).not.toMatch(/load failed|success|imported/i);
  });
});

describe("Kreto chat network wording", () => {
  it("replaces 'Load failed' and keeps other messages", () => {
    expect(isNetworkFailure(new TypeError("Load failed"))).toBe(true);
    expect(describeKretoNetworkFailure(new TypeError("Load failed"))).toMatch(/dropped before a reply arrived\. Your message is kept/);
    expect(describeKretoNetworkFailure(new Error("Please sign in"))).toBe("Please sign in");
  });
});
