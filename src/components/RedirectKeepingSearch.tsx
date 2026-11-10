import { Navigate, useLocation } from "react-router-dom";
import { redirectTarget } from "@/lib/redirectTarget";

/**
 * A retired address that still has to land somewhere: <Navigate replace> to `to`, carrying the query string and hash the visitor arrived
 * with (see redirectTarget). Used where old links carry parameters that the new place reads, such as /scout?tab=all&q=film.
 */
export const RedirectKeepingSearch = ({ to }: { to: string }) => {
  const { search, hash } = useLocation();
  return <Navigate to={redirectTarget(to, search, hash)} replace />;
};
