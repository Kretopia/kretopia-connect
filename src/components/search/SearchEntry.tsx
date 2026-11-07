import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { genericSearchTarget } from "@/lib/searchEntry";

/**
 * The /search route. With a term in the address it renders the results page it is given; without one (the old generic search landing,
 * the footer's "Talent Search", a bookmark) it sends the visitor to Discover, keeping the parameters Discover reads.
 */
export function SearchEntry({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const discover = genericSearchTarget(search);
  return discover ? <Navigate to={discover} replace /> : <>{children}</>;
}

export default SearchEntry;
