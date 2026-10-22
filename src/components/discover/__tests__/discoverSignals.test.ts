import { describe, expect, it, vi } from "vitest";

import { buildDiscoverSignals, type DiscoverSignalInput } from "@/components/discover/discoverSignals";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/today/radar/radar.queries", () => ({ fetchGigs: vi.fn(), fetchLiveStages: vi.fn(), fetchNearbyEvents: vi.fn() }));

const ready = (value: number) => ({ value, state: "ready" as const });

function input(over: Partial<DiscoverSignalInput> = {}): DiscoverSignalInput {
  return { signedIn: false, people: ready(3), gigs: ready(4), stages: ready(2), events: ready(1), onSelect: vi.fn(), ...over };
}

describe("buildDiscoverSignals", () => {
  it("gives a guest one tile per public lane, in lane order, and no gigs number", () => {
    const ids = buildDiscoverSignals(input()).map((s) => s.id);
    expect(ids).toEqual(["people", "stages", "events"]);
  });

  it("adds the gigs tile for a signed-in person, between people and Stages", () => {
    const ids = buildDiscoverSignals(input({ signedIn: true })).map((s) => s.id);
    expect(ids).toEqual(["people", "gigs", "stages", "events"]);
  });

  it("words each number as Today's Radar does, singular and plural", () => {
    const labels = (n: number) => buildDiscoverSignals(input({ signedIn: true, people: ready(n), gigs: ready(n), stages: ready(n), events: ready(n) })).map((s) => s.label);
    expect(labels(1)).toEqual(["creative joined", "new gig for you", "Stage live now", "event this week"]);
    expect(labels(2)).toEqual(["creatives joined", "new gigs for you", "Stages live now", "events this week"]);
    expect(labels(0)).toEqual(["creatives joined", "new gigs for you", "Stages live now", "events this week"]);
  });

  it("marks a Stage as hot only when one is live and the read succeeded", () => {
    const hot = (stages: DiscoverSignalInput["stages"]) => buildDiscoverSignals(input({ stages })).find((s) => s.id === "stages")?.hot;
    expect(hot(ready(2))).toBe(true);
    expect(hot(ready(0))).toBe(false);
    expect(hot({ value: 0, state: "loading" })).toBe(false);
    expect(hot({ value: 0, state: "error" })).toBe(false);
  });

  it("keeps a failed or loading read as a state, never as a zero", () => {
    const signals = buildDiscoverSignals(input({ people: { value: 0, state: "error" }, events: { value: 0, state: "loading" } }));
    expect(signals.find((s) => s.id === "people")?.state).toBe("error");
    expect(signals.find((s) => s.id === "events")?.state).toBe("loading");
  });

  it("sends each tile to the lane it counts", () => {
    const onSelect = vi.fn();
    const signals = buildDiscoverSignals(input({ signedIn: true, onSelect }));
    signals.forEach((s) => s.onSelect?.());
    expect(onSelect.mock.calls.map(([lane]) => lane)).toEqual(["people", "opps", "live", "events"]);
  });

  it("invites a person into a live Stage, and says plainly when none is on", () => {
    const hint = (value: number) => buildDiscoverSignals(input({ stages: ready(value) })).find((s) => s.id === "stages")?.hint;
    expect(hint(2)).toBe("Join the room");
    expect(hint(0)).toBe("None right now");
  });
});
