import { Navigate, useParams, useLocation } from "react-router-dom";

/**
 * Phase 1 — Crews rebrand.
 * Legacy /circle/:circleId(/chat) deep links redirect to /crew/:circleId(/chat),
 * preserving querystring + hash so shared invite links keep working.
 */
export const CircleToCrewRedirect = ({ suffix = "" }: { suffix?: string }) => {
  const { circleId } = useParams();
  const { search, hash } = useLocation();
  if (!circleId) return <Navigate to="/crews" replace />;
  return <Navigate to={`/crew/${circleId}${suffix}${search}${hash}`} replace />;
};
