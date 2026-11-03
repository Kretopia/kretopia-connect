import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ token: "tok" as string | null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: auth.token ? { access_token: auth.token } : null } }) } },
}));

import { VOICE_INSTRUCTIONS, pickBrowserVoice, stopPlayback, synthesizeReply } from "@/lib/thriveVoice";

class FakeAudio {
  static all: FakeAudio[] = [];
  listeners: Record<string, Array<() => void>> = {};
  paused = false;
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  play() {
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  end() {
    for (const fn of this.listeners.ended ?? []) fn();
  }
}

const speak = vi.fn();
const cancel = vi.fn();
let fetchResults: Array<Record<string, unknown>> = [];
const fetchMock = vi.fn(async () => ({ json: async () => fetchResults.shift() ?? { audio_base64: "QUJD", audio_mime: "audio/mpeg" } }));
const sentTexts = () => fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, { body: string }])[1].body).text as string);
const tick = () => new Promise((r) => setTimeout(r, 0));

const SENTENCES = Array.from({ length: 14 }, (_, i) => `Sentence number ${i + 1} says something fairly ordinary here.`).join(" ");

beforeEach(() => {
  auth.token = "tok";
  FakeAudio.all = [];
  fetchResults = [];
  fetchMock.mockClear();
  speak.mockClear();
  cancel.mockClear();
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak, cancel, getVoices: () => [] } });
});
afterEach(() => {
  stopPlayback();
  vi.unstubAllGlobals();
});

describe("synthesizeReply", () => {
  it("speaks what a person would say, with the voice instructions, not the markdown", async () => {
    await synthesizeReply("**Great** news! See https://kretopia.com/x — budget $1,200–$2,000 😀");
    expect(sentTexts()).toEqual(["Great news! See a link, budget 1,200 to 2,000 dollars."]);
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body).instructions).toBe(VOICE_INSTRUCTIONS);
    expect(FakeAudio.all).toHaveLength(1);
  });

  it("starts on a short first piece and asks for the next while the first plays", async () => {
    const { audioUrl } = await synthesizeReply(SENTENCES);
    expect(audioUrl).toMatch(/^data:audio\/mpeg;base64,/);
    const texts = sentTexts();
    expect(texts[0].length).toBeLessThanOrEqual(240);
    expect(texts).toHaveLength(2); // the second is already on its way, the rest wait
    expect(FakeAudio.all).toHaveLength(1);
  });

  it("plays the pieces one after the other, each requested one ahead, until the reply is said", async () => {
    await synthesizeReply(SENTENCES);
    const pieces = fetchMock.mock.calls.length; // 2 so far
    expect(pieces).toBe(2);
    FakeAudio.all[0].end();
    await tick();
    expect(FakeAudio.all).toHaveLength(2);
    expect(fetchMock.mock.calls.length).toBe(3);
    // run it to the end
    for (let i = 1; i < 20 && FakeAudio.all[i]; i++) {
      FakeAudio.all[i].end();
      await tick();
    }
    const said = sentTexts().join(" ");
    expect(said.replace(/\s+/g, " ")).toBe(SENTENCES.replace(/\s+/g, " "));
    expect(speak).not.toHaveBeenCalled();
  });

  it("stops for good when told to: no further piece is played or requested", async () => {
    await synthesizeReply(SENTENCES);
    const requested = fetchMock.mock.calls.length;
    stopPlayback();
    FakeAudio.all[0].end();
    await tick();
    expect(FakeAudio.all).toHaveLength(1);
    expect(fetchMock.mock.calls.length).toBe(requested);
    expect(cancel).toHaveBeenCalled();
  });

  it("lets a newer reply replace the one being said", async () => {
    await synthesizeReply(SENTENCES);
    await synthesizeReply("Short new reply.");
    FakeAudio.all[0].end();
    await tick();
    // the old reply's second piece is never played
    expect(FakeAudio.all.filter((a) => a.src && !a.paused).length).toBeLessThanOrEqual(1);
    expect(sentTexts()).toContain("Short new reply.");
  });

  it("finishes in the browser's voice if a later piece cannot be made", async () => {
    fetchResults = [{ audio_base64: "QUJD", audio_mime: "audio/mpeg" }, { tts_fallback: true }];
    await synthesizeReply(SENTENCES);
    FakeAudio.all[0].end();
    await tick();
    expect(FakeAudio.all).toHaveLength(1);
    expect(speak).toHaveBeenCalled();
    const spoken = speak.mock.calls.map((c) => (c[0] as { text: string }).text).join(" ");
    expect(spoken).toContain("Sentence number 14");
    expect(spoken).not.toContain("Sentence number 1 says"); // what was already said is not said twice
  });

  it("falls back to the browser's voice for the whole reply when the first piece cannot be made", async () => {
    fetchResults = [{ tts_fallback: true, tts_error: "rate_limited" }];
    const { audioUrl } = await synthesizeReply("Hello **there**. See https://x.com now.");
    expect(audioUrl).toBeNull();
    expect(speak.mock.calls.map((c) => (c[0] as { text: string }).text).join(" ")).toBe("Hello there. See a link now.");
  });

  it("uses the browser's voice, with the cleaned text, for someone without a session", async () => {
    auth.token = null;
    const { audioUrl } = await synthesizeReply("Budget is $300/day 🎉");
    expect(audioUrl).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(speak.mock.calls.map((c) => (c[0] as { text: string }).text).join(" ")).toBe("Budget is 300 dollars a day.");
  });

  it("says nothing for a reply with nothing to say", async () => {
    await synthesizeReply("```\ncode only\n```");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });
});

describe("pickBrowserVoice", () => {
  const v = (name: string, lang: string) => ({ name, lang });
  it("prefers a natural or neural English voice", () => {
    expect(pickBrowserVoice([v("Alex", "en-US"), v("Microsoft Aria Online (Natural)", "en-US"), v("Thomas", "fr-FR")])?.name).toBe("Microsoft Aria Online (Natural)");
  });
  it("then a known good one, then any US or UK English, then any English, then anything", () => {
    expect(pickBrowserVoice([v("Fred", "en-US"), v("Samantha", "en-US")])?.name).toBe("Samantha");
    expect(pickBrowserVoice([v("Thomas", "fr-FR"), v("Fred", "en-GB")])?.name).toBe("Fred");
    expect(pickBrowserVoice([v("Thomas", "fr-FR"), v("Ravi", "en-IN")])?.name).toBe("Ravi");
    expect(pickBrowserVoice([v("Thomas", "fr-FR")])?.name).toBe("Thomas");
    expect(pickBrowserVoice([])).toBeUndefined();
  });
});
