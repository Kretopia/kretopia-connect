import { describe, expect, it } from "vitest";
import { gigStateFor, gigStatesById } from "../gigState";
import type { ScoutActionRow } from "../scout.types";

const act = (action: string, outcome: string | null = null, id = "g"): ScoutActionRow => ({ scouted_gig_id: id, action, outcome });

describe("gigStateFor", () => {
  it("is null when the person did nothing with the gig", () => {
    expect(gigStateFor([])).toBeNull();
    expect(gigStateFor([act("opened"), act("dismissed")])).toBeNull();
  });

  it("names the furthest thing the person did", () => {
    expect(gigStateFor([act("saved")])?.label).toBe("Saved");
    expect(gigStateFor([act("saved"), act("drafted")])?.label).toBe("Preparing");
    expect(gigStateFor([act("saved"), act("drafted"), act("apply_clicked")])?.label).toBe("Handed off");
    expect(gigStateFor([act("apply_clicked"), act("applied", "pending")])?.label).toBe("Marked applied");
  });

  it("outcomes are the person's own marks, worded as such", () => {
    expect(gigStateFor([act("applied", "won")])?.label).toBe("Marked won");
    expect(gigStateFor([act("applied", "lost")])?.label).toBe("Marked lost");
    expect(gigStateFor([act("applied", "ghosted")])?.label).toBe("No reply");
  });

  it("never claims a receipt or an acceptance, for any state", () => {
    const all = [
      gigStateFor([act("saved")]),
      gigStateFor([act("drafted")]),
      gigStateFor([act("apply_clicked")]),
      gigStateFor([act("applied", "pending")]),
      gigStateFor([act("applied", "won")]),
      gigStateFor([act("applied", "lost")]),
      gigStateFor([act("applied", "ghosted")]),
    ];
    for (const state of all) expect(`${state?.label} ${state?.hint}`).not.toMatch(/submitted|accepted|confirmed|received/i);
  });
});

describe("gigStatesById", () => {
  it("builds one state per gig from the whole list of actions", () => {
    const map = gigStatesById([act("saved", null, "a"), act("applied", "won", "b"), act("opened", null, "c"), act("drafted", null, "a")]);
    expect(map.get("a")?.label).toBe("Preparing");
    expect(map.get("b")?.label).toBe("Marked won");
    expect(map.has("c")).toBe(false);
  });
});
