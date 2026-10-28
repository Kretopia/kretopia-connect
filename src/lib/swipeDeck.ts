/**
 * Which card the Match deck shows next, when people and offers found outside Kretopia share one deck. Pure.
 *
 * People stay the deck: an offer comes up after every OFFER_EVERY people the member has answered, and on its own when there are
 * no people left to show (so offers are not hidden behind "All caught up"). With no offers the deck is exactly what it was.
 * Nothing here reorders people or ranks offers: offers arrive in the order they are given.
 */
export const OFFER_EVERY = 4;

export type DeckItem<P, O> = { type: "profile"; item: P } | { type: "offer"; item: O };

export function nextDeckItem<P, O>(profiles: readonly P[], offers: readonly O[], profilesSinceOffer: number, every: number = OFFER_EVERY): DeckItem<P, O> | null {
  const person = profiles[0];
  const offer = offers[0];
  if (offer === undefined) return person === undefined ? null : { type: "profile", item: person };
  if (person === undefined) return { type: "offer", item: offer };
  return profilesSinceOffer >= every ? { type: "offer", item: offer } : { type: "profile", item: person };
}
