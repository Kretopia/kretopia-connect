import { SwipeFeature, type SwipeFeatureProps } from "./SwipeFeature";

/**
 * Match discovers people on every surface and in every account mode.
 * Jobs and opportunities belong to Scout, never to the Match deck.
 */
export function MatchDeck(props: Omit<SwipeFeatureProps, "offers">) {
  return <SwipeFeature {...props} offers={false} />;
}
