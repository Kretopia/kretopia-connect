import { describe, expect, it } from "vitest";
import { nextDeckItem, OFFER_EVERY } from "../swipeDeck";

const people = ["ada", "bo", "cy", "di", "ed", "flo"];
const offers = ["offer-1", "offer-2"];

describe("nextDeckItem: people stay the deck, offers found outside Kretopia join it", () => {
  it("with no offers the deck is exactly what it was, however many people were answered", () => {
    for (const since of [0, 1, OFFER_EVERY, 99]) expect(nextDeckItem(people, [], since)).toEqual({ type: "profile", item: "ada" });
  });

  it("an offer comes up only after OFFER_EVERY people were answered since the last one", () => {
    for (let since = 0; since < OFFER_EVERY; since++) expect(nextDeckItem(people, offers, since)).toEqual({ type: "profile", item: "ada" });
    expect(nextDeckItem(people, offers, OFFER_EVERY)).toEqual({ type: "offer", item: "offer-1" });
    expect(nextDeckItem(people, offers, OFFER_EVERY + 3)).toEqual({ type: "offer", item: "offer-1" });
  });

  it("when no people are left the offers are shown, in the order given, not hidden behind 'all caught up'", () => {
    expect(nextDeckItem([], offers, 0)).toEqual({ type: "offer", item: "offer-1" });
    expect(nextDeckItem([], offers.slice(1), 0)).toEqual({ type: "offer", item: "offer-2" });
  });

  it("nothing at all is null, which is the 'all caught up' state", () => {
    expect(nextDeckItem([], [], 0)).toBeNull();
    expect(nextDeckItem([], [], OFFER_EVERY)).toBeNull();
  });

  it("answering people and offers in turn alternates predictably and never skips or repeats a person", () => {
    const left = [...people];
    const pending = [...offers];
    let since = 0;
    const seen: string[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const next = nextDeckItem(left, pending, since);
      if (!next) break;
      if (next.type === "offer") { pending.shift(); since = 0; } else { left.shift(); since += 1; }
      seen.push(next.item);
    }
    expect(seen).toEqual(["ada", "bo", "cy", "di", "offer-1", "ed", "flo", "offer-2"]);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("the interval can be changed", () => {
    expect(nextDeckItem(people, offers, 1, 1)).toEqual({ type: "offer", item: "offer-1" });
    expect(nextDeckItem(people, offers, 1, 2)).toEqual({ type: "profile", item: "ada" });
  });
});
