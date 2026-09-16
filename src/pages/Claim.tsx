import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Wave 1 redesign: /claim public funnel deprecated (0 conversions in 30 days).
 * Redirect all traffic to /auth?tab=signup, preserving any analytics intent
 * via sessionStorage so post-auth flow can resume claim context if needed.
 */
const Claim = () => {
  const [params] = useSearchParams();

  useEffect(() => {
    try {
      const intent: Record<string, string> = {};
      ["q", "source", "gig", "event", "redirect"].forEach((k) => {
        const v = params.get(k);
        if (v) intent[k] = v;
      });
      if (Object.keys(intent).length > 0) {
        sessionStorage.setItem("claim_intent", JSON.stringify(intent));
      }
      import("@/lib/analytics").then(({ analytics }) => {
        analytics.featureUsed("claim_redirect_to_signup", { source: intent.source || "direct" });
      }).catch(() => {});
    } catch {}
  }, [params]);

  return <Navigate to="/auth?tab=signup" replace />;
};

export default Claim;
