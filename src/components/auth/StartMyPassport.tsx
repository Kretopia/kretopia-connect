import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { usableDestination } from "@/lib/postSignupDestination";

/**
 * /start: the one direct way to create a Passport, apart from browsing the directory (/passport). A visitor who is signed out lands on the
 * sign-up page with the account options first; a member goes straight to their Passport. Where the visitor was heading (?next=), an
 * invitation (?invite=), a claim or an event is carried through sign-up rather than dropped.
 */
const CARRIED = ["invite", "inviteCode", "claim", "event", "connect", "q"] as const;

export function StartMyPassport() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();

  if (loading) return <KretopiaLoader label="Opening your Passport" size="sm" />;
  if (user) return <Navigate to="/profile" replace />;

  const next = usableDestination(params.get("next")) ?? "/profile";
  const target = new URLSearchParams({ tab: "signup", mode: "classic", next, src: params.get("src") || "start" });
  for (const key of CARRIED) {
    const value = params.get(key);
    if (value) target.set(key, value);
  }
  return <Navigate to={`/auth?${target.toString()}`} replace />;
}

export default StartMyPassport;
