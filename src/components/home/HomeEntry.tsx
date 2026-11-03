import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Navigate } from "react-router-dom";

const Welcome = lazy(() => import("@/pages/Welcome"));
const UnifiedHome = lazy(() => import("./UnifiedHome"));

/** Resolve identity separately from the heavy, authenticated Today dashboard. */
export default function HomeEntry() {
  const { user } = useAuth();
  const { isComplete, loading } = useOnboarding();

  // Public content is safe during session restoration; never clear the session
  // or treat a slow identity request as a sign-out.
  if (!user) return <Welcome />;

  // A profile lookup is not a prerequisite for painting the home surface.
  // Keep the existing onboarding redirect once the actual result is known.
  if (!loading) {
    if (!isComplete) return <Navigate to="/onboarding" replace />;
    const pendingEvent = sessionStorage.getItem("pending_event_join");
    if (pendingEvent) {
      sessionStorage.removeItem("pending_event_join");
      return <Navigate to={`/event/${pendingEvent}`} replace />;
    }
  }

  return <UnifiedHome />;
}