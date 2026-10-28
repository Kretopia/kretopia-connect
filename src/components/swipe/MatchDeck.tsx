import { useAccountTone } from "@/hooks/useAccountTone";
import { SwipeFeature, type SwipeFeatureProps } from "./SwipeFeature";

/**
 * The Match deck every surface shows (Discover, Match, Circle). A creator account sees offers found outside Kretopia between the
 * people; a company account keeps people only, since a company is not looking for gigs. While the account mode is still being read
 * nothing is added, so a company never sees an offer flash by.
 */
export function MatchDeck(props: Omit<SwipeFeatureProps, "offers">) {
  const { isBusiness, loading } = useAccountTone();
  return <SwipeFeature {...props} offers={!loading && !isBusiness} />;
}
