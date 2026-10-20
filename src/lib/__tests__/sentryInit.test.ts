import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import { initSentry, SENTRY_REPLAY_OPTIONS } from "@/lib/sentryInit";

// The real SDK builds the Replay integration; only `init` is replaced so nothing starts recording.
vi.mock("@sentry/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/react")>()),
  init: vi.fn(),
}));

/** What the SDK itself will pass to rrweb: the privacy that actually applies, not the options we asked for. */
type ReplayInternals = {
  name: string;
  _initialOptions: { blockAllMedia: boolean; maskAllText: boolean; maskAllInputs: boolean; networkCaptureBodies: boolean; networkDetailAllowUrls: string[] };
  _recordingOptions: { maskAllText: boolean; maskAllInputs: boolean; blockSelector?: string };
};

function installedReplay(): ReplayInternals {
  const config = vi.mocked(Sentry.init).mock.calls[0]?.[0];
  const replay = (config?.integrations as { name: string }[] | undefined)?.find((integration) => integration.name === "Replay");
  if (!replay) throw new Error("initSentry installed no Replay integration");
  return replay as unknown as ReplayInternals;
}

describe("Sentry Replay privacy", () => {
  beforeEach(() => {
    vi.mocked(Sentry.init).mockClear();
    initSentry();
  });

  it("masks all text and all inputs in what the SDK records", () => {
    const replay = installedReplay();
    expect(replay._recordingOptions.maskAllText).toBe(true);
    expect(replay._recordingOptions.maskAllInputs).toBe(true);
    expect(replay._initialOptions.maskAllText).toBe(true);
    expect(replay._initialOptions.maskAllInputs).toBe(true);
  });

  it("blocks images, video, audio and other embedded media", () => {
    const replay = installedReplay();
    expect(replay._initialOptions.blockAllMedia).toBe(true);
    const blocked = (replay._recordingOptions.blockSelector ?? "").split(",");
    for (const tag of ["img", "video", "audio", "svg", "picture"]) expect(blocked).toContain(tag);
  });

  it("never captures request or response bodies, and lists no URL for network details", () => {
    const replay = installedReplay();
    expect(replay._initialOptions.networkCaptureBodies).toBe(false);
    expect(replay._initialOptions.networkDetailAllowUrls).toEqual([]);
  });

  it("keeps the rest of the configuration unchanged", () => {
    const config = vi.mocked(Sentry.init).mock.calls[0][0]!;
    expect(config.tracesSampleRate).toBe(1.0);
    expect(config.replaysSessionSampleRate).toBe(0.1);
    expect(config.replaysOnErrorSampleRate).toBe(1.0);
    expect(SENTRY_REPLAY_OPTIONS).toEqual({ maskAllText: true, maskAllInputs: true, blockAllMedia: true, networkCaptureBodies: false });
  });
});
