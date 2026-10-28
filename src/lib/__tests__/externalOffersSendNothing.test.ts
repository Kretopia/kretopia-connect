import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An offer found outside Kretopia has no person on Kretopia behind it. Answering one must never message, notify, connect, match or apply
 * for anyone. These read the code of that path so a later change cannot quietly add one of those.
 */
const ROOT = join(__dirname, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const FILES = ["src/hooks/useExternalOffers.ts", "src/components/swipe/ExternalOfferCard.tsx", "src/components/swipe/MatchDeck.tsx", "src/lib/swipeDeck.ts"];
const FORBIDDEN: [string, RegExp][] = [
  ["a function call (notifications, emails)", /functions\s*\.\s*invoke/],
  ["a notification or message insert", /from\(\s*["'](notifications|messages|conversations)["']/],
  ["a match or a connection", /from\(\s*["'](matches|connections)["']|create_bidirectional_connection|notify-swipe/],
  ["an application", /from\(\s*["'](applications|opportunity_applications|scouted_gig_actions)["']|apply_to|submitApplication/],
  ["a profile swipe", /target_type\s*:\s*["']profile["']/],
];

describe("answering an offer found outside Kretopia reaches nobody", () => {
  it.each(FILES)("%s contains no way to message, notify, connect, match or apply", (file) => {
    const code = read(file);
    for (const [what, re] of FORBIDDEN) expect(code, `${file} must not contain ${what}`).not.toMatch(re);
  });

  it("the only table an answer is written to is the member's own swipes, as an 'opportunity'", () => {
    const code = read("src/hooks/useExternalOffers.ts");
    const writes = [...code.matchAll(/\.from\(\s*["']([a-z_]+)["']/g)].map((m) => m[1]);
    expect(new Set(writes)).toEqual(new Set(["public_external_listings", "swipes"]));
    expect(code).toMatch(/target_type:\s*"opportunity"/);
    expect(code).not.toMatch(/target_type:\s*"profile"/);
  });

  it("the deck hands people to the existing flow and offers to this one, never the other way round", () => {
    const deck = read("src/components/swipe/SwipeFeature.tsx");
    // a person's answer still goes through recordSwipe (matches, notifications); an offer's through resolveOffer only
    expect(deck).toMatch(/await resolveOffer\(offer, 'right'\)/);
    expect(deck).toMatch(/await resolveOffer\(offer, 'left'\)/);
    const offerHandlers = deck.slice(deck.indexOf("const handleOfferInterested"), deck.indexOf("const handleUndo"));
    expect(offerHandlers).not.toMatch(/recordSwipe/);
    expect(offerHandlers).not.toMatch(/functions\s*\.\s*invoke/);
  });
});
