import { Navigate, useLocation } from "react-router-dom";

import { genericSearchTarget } from "@/lib/searchEntry";

/** Compatibility redirect; the retired results page is never mounted. */
export function SearchEntry() {
  const { search } = useLocation();
  const discover = genericSearchTarget(search);
  return <Navigate to={discover} replace />;
}

export default SearchEntry;
