import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Calendar, Globe, UserSearch, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { orderCompanyActions } from "@/lib/companyHiringGoal";

const ACTIONS = [
  { label: "Post a Gig", path: "/post-opportunity", icon: Briefcase },
  { label: "Review applicants", path: "/opportunity-dashboard", icon: Users },
  { label: "Find talent", path: "/talent-finder", icon: UserSearch },
  // Found outside Kretopia and checked by a curator: Discover's Sourced lanes, which only a company account has.
  { label: "Sourced creatives", path: "/discover?tab=people&mode=sourced", icon: Globe },
  { label: "Sourced events", path: "/discover?tab=events&mode=sourced", icon: Calendar },
  { label: "Pay creators", path: "/thrivepay", icon: Wallet },
];

export function CompanyWorkspaceActions() {
  const { user } = useAuth();
  // What the company said it is here to do (profiles.primary_intents, saved by company onboarding). Until it
  // is known, or when it cannot be read, the four actions keep their usual order.
  const [intents, setIntents] = useState<unknown>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("primary_intents, primary_intent")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setIntents((data as any)?.primary_intents ?? (data as any)?.primary_intent ?? null);
      } catch {
        /* keep the default order */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <nav aria-label="Company workspace" className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {orderCompanyActions(ACTIONS, intents).map(({ label, path, icon: Icon }) => (
        <Button key={path} asChild variant="outline" size="sm">
          <Link to={path}><Icon aria-hidden className="h-4 w-4" />{label}</Link>
        </Button>
      ))}
    </nav>
  );
}
