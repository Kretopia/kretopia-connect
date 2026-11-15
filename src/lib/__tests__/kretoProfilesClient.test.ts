// The browser side of Kreto models and effort: labels stay in step with the server's profiles and carry no provider or
// model names, the device-remembered choice falls back safely, and the chat client sends the choice, asks only when it
// can, and reads which Kreto model answered.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_KRETO_CHOICE,
  KRETO_EFFORTS,
  KRETO_MODELS,
  KRETO_PROFILE_IDS,
  kretoModelAvailable,
  previewShare,
  readKretoChoice,
  sharePctLabel,
  writeKretoChoice,
} from "../kretoProfiles";
import { KRETO_PROFILES, KRETO_PROFILE_IDS as SERVER_IDS, PRO_TIER_ENABLED } from "../../../supabase/functions/_shared/kretoProfiles";

const world = vi.hoisted(() => ({ session: { access_token: "test-session" } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: world.session } }) }, rpc: async () => ({}) },
}));
import { readKretoRoute, streamCopilot } from "../thriveCopilot";

const PROVIDER_WORDS = /gemini|google|openai|gpt|anthropic|claude|lovable|thrive|flash|\bAI\b|assistant|chatbot|copilot/i;

describe("labels in step with the server", () => {
  it("same profile ids, same paid flags, and a profile is offered only when the server would run it", () => {
    expect([...KRETO_PROFILE_IDS]).toEqual([...SERVER_IDS]);
    for (const id of KRETO_PROFILE_IDS) {
      const label = KRETO_MODELS.find((m) => m.id === id)!;
      const server = KRETO_PROFILES[id];
      expect(label.paid).toBe(server.paid);
      // Switched on for everyone, except a profile that only runs on the deepest tier (admins and Premium for now).
      const deepOnly = Object.values(server.tiers).every((t) => t === "pro");
      expect(label.available).toBe(true);
      expect(Boolean(label.deepTier)).toBe(deepOnly && !PRO_TIER_ENABLED);
      expect(kretoModelAvailable(label, false)).toBe(!deepOnly || PRO_TIER_ENABLED);
      expect(kretoModelAvailable(label, true)).toBe(true);
    }
    expect(KRETO_MODELS[0].id).toBe("auto");
  });

  it("names and descriptions are Kretopia's own: no provider, model or 'AI assistant' wording", () => {
    for (const m of KRETO_MODELS) {
      expect(`${m.name} ${m.description} ${m.unavailableReason ?? ""}`).not.toMatch(PROVIDER_WORDS);
      if (m.id !== "auto") expect(m.name).toMatch(/^Kreto [A-Z][a-z]+$/);
    }
    for (const e of KRETO_EFFORTS) expect(`${e.label} ${e.description}`).not.toMatch(PROVIDER_WORDS);
    // The module never carries a model id at all.
    const source = readFileSync(path.resolve(__dirname, "../kretoProfiles.ts"), "utf8");
    expect(source).not.toMatch(/gemini|gpt-|claude-|openai/i);
  });
});

describe("the remembered choice", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to Auto and Balanced, survives a round trip, and ignores junk or a profile that is switched off", () => {
    expect(readKretoChoice()).toEqual(DEFAULT_KRETO_CHOICE);
    writeKretoChoice({ profile: "forge", effort: 3 });
    expect(readKretoChoice()).toEqual({ profile: "forge", effort: 3 });
    localStorage.setItem("kreto:choice:v1", "{not json");
    expect(readKretoChoice()).toEqual(DEFAULT_KRETO_CHOICE);
    localStorage.setItem("kreto:choice:v1", JSON.stringify({ profile: "made-up", effort: 9 }));
    expect(readKretoChoice()).toEqual(DEFAULT_KRETO_CHOICE);
    // Kreto Oracle is kept: whether this account may run it is the server's call (it answers with Kreto Vision if not).
    localStorage.setItem("kreto:choice:v1", JSON.stringify({ profile: "oracle", effort: 4 }));
    expect(readKretoChoice()).toEqual({ profile: "oracle", effort: 4 });
  });
});

describe("the composer's rough estimate", () => {
  const history = Array.from({ length: 60 }, () => ({ content: "x".repeat(400) }));

  it("says nothing without an allowance to measure against, and grows with effort and draft", () => {
    expect(previewShare({ draft: "hi", history, effort: 2, tokensLeft: null })).toBeNull();
    expect(previewShare({ draft: "hi", history, effort: 2, tokensLeft: 0 })).toBe(1);
    const quick = previewShare({ draft: "hi", history, effort: 1, tokensLeft: 60000 })!;
    const balanced = previewShare({ draft: "hi", history, effort: 2, tokensLeft: 60000 })!;
    const max = previewShare({ draft: "hi", history, effort: 4, tokensLeft: 60000 })!;
    expect(quick).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(max);
    expect(previewShare({ draft: "x".repeat(8000), history, effort: 2, tokensLeft: 60000 })!).toBeGreaterThan(balanced);
    expect(sharePctLabel(0.0001)).toBe("1%");
    expect(sharePctLabel(0.256)).toBe("26%");
  });
});

describe("the chat client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  const sse = (headers: Record<string, string> = {}) => new Response("data: [DONE]\n\n", { status: 200, headers: { "Content-Type": "text/event-stream", ...headers } });

  it("reads which Kreto model and effort answered, and decodes the notice", () => {
    const route = readKretoRoute(new Headers({ "X-Kreto-Profile": "vision", "X-Kreto-Effort": "4", "X-Kreto-Suggest-Effort": "3", "X-Kreto-Notice": encodeURIComponent("The deepest tier is on Premium for now, so Kreto Vision ran at Deep strength."), "X-Kreto-Share": "12" }));
    expect(route).toEqual({ profile: "vision", effort: 4, suggestEffort: 3, notice: "The deepest tier is on Premium for now, so Kreto Vision ran at Deep strength.", sharePct: 12 });
    expect(readKretoRoute(new Headers())).toBeNull();
  });

  it("sends the choice and says it can ask; a 409 asks instead of failing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: "KRETO_CONFIRM", error: "This needs about 40% of what's left today. Run it?", basis: "today", estimate: { tokens: 9000, share_pct: 40 } }), { status: 409 }));
    const onError = vi.fn(), onNeedsConfirm = vi.fn(), onDelta = vi.fn();
    await streamCopilot({ messages: [{ role: "user", content: "brief" }], surface: "home", conversationId: "conv", profile: "forge", effort: 3, confirmSupported: true, onNeedsConfirm, onError, onDelta, onDone: vi.fn() });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ mode: "chat", profile: "forge", effort: 3, confirm_supported: true });
    expect(body.confirm_estimate).toBeUndefined();
    expect(onNeedsConfirm).toHaveBeenCalledWith({ message: "This needs about 40% of what's left today. Run it?", sharePct: 40, basis: "today" });
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("a caller that cannot ask never says it can; the confirmed resend says so", async () => {
    fetchMock.mockImplementation(async () => sse());
    await streamCopilot({ messages: [{ role: "user", content: "brief" }], surface: "home", conversationId: "conv", confirmSupported: true, onError: vi.fn(), onDelta: vi.fn(), onDone: vi.fn() });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).confirm_supported).toBeUndefined();
    await streamCopilot({ messages: [{ role: "user", content: "brief" }], surface: "home", conversationId: "conv", confirmSupported: true, confirmEstimate: true, onNeedsConfirm: vi.fn(), onError: vi.fn(), onDelta: vi.fn(), onDone: vi.fn() });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ confirm_supported: true, confirm_estimate: true });
  });

  it("an allowance that does not fit, or a model that is off, shows the server's own words", async () => {
    const onError = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: "KRETO_ALLOWANCE_INSUFFICIENT", error: "This needs more than you have left today. It comes back at midnight UTC. Quick gives a lighter answer." }), { status: 429 }));
    await streamCopilot({ messages: [{ role: "user", content: "brief" }], surface: "home", conversationId: "conv", onError, onDelta: vi.fn(), onDone: vi.fn() });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: "KRETO_PROFILE_UNAVAILABLE", error: "Kreto Oracle is on Premium for now. I can run this with Kreto Vision." }), { status: 400 }));
    await streamCopilot({ messages: [{ role: "user", content: "brief" }], surface: "home", conversationId: "conv", profile: "oracle", onError, onDelta: vi.fn(), onDone: vi.fn() });
    expect(onError.mock.calls.map((c) => c[0])).toEqual([
      "This needs more than you have left today. It comes back at midnight UTC. Quick gives a lighter answer.",
      "Kreto Oracle is on Premium for now. I can run this with Kreto Vision.",
    ]);
  });

  it("tells the caller which Kreto model answered before the reply streams", async () => {
    fetchMock.mockResolvedValue(sse({ "X-Kreto-Profile": "pulse", "X-Kreto-Effort": "2" }));
    const onRoute = vi.fn();
    await streamCopilot({ messages: [{ role: "user", content: "brief" }], surface: "home", conversationId: "conv", onRoute, onError: vi.fn(), onDelta: vi.fn(), onDone: vi.fn() });
    expect(onRoute).toHaveBeenCalledWith(expect.objectContaining({ profile: "pulse", effort: 2, suggestEffort: null }));
  });
});
