import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { intentMeta, normalizeIntents, type PrimaryIntent } from "@/lib/intents";

interface StarterStep {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

/**
 * Shown to users in their first 7 days post-onboarding.
 * 4-step starter checklist that pulls them into actual platform actions.
 * Steps adapt to the user's primary_intent (collaborate / gigs / fund / manage).
 */
export const NewMemberStarterCard = ({ className = "" }: { className?: string }) => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [steps, setSteps] = useState<StarterStep[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [intent, setIntent] = useState<PrimaryIntent | null>(null);

  useEffect(() => {
    if (!user) return;

    const dismissedAt = localStorage.getItem(`starter-dismissed-${user.id}`);
    if (dismissedAt) {
      setDismissed(true);
      return;
    }

    const load = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("created_at, onboarding_completed, bio, avatar_url, primary_intent, primary_intents")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.onboarding_completed) return;

        const ageMs = Date.now() - new Date(profile.created_at).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays > 7) return;

        // Use first selected intent as primary driver for the checklist
        const intents = normalizeIntents(
          (profile as any).primary_intents ?? (profile as any).primary_intent
        );
        const userIntent = (intents[0] ?? null) as PrimaryIntent | null;
        setIntent(userIntent);

        // Run all probe queries in parallel
        const [appliedRes, msgRes, eventRes, connRes, projectRes, campaignRes, invoiceRes] =
          await Promise.all([
            supabase.from("applications").select("id", { count: "exact", head: true }).eq("applicant_id", user.id),
            supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", user.id),
            supabase.from("jam_participants").select("id", { count: "exact", head: true }).eq("user_id", user.id),
            supabase.from("connections").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "accepted"),
            supabase.from("projects").select("id", { count: "exact", head: true }).eq("created_by", user.id),
            supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
            supabase.from("invoices" as any).select("id", { count: "exact", head: true }).eq("issued_by", user.id),
          ]);

        const profileDone = !!(profile.bio && profile.avatar_url);
        const appliedDone = (appliedRes.count ?? 0) > 0;
        const msgDone = (msgRes.count ?? 0) > 0;
        const eventDone = (eventRes.count ?? 0) > 0;
        const connDone = (connRes.count ?? 0) > 0;
        const projectDone = (projectRes.count ?? 0) > 0;
        const campaignDone = (campaignRes.count ?? 0) > 0;
        const invoiceDone = ((invoiceRes as any).count ?? 0) > 0;

        // Default (no intent) — generic starter
        let built: StarterStep[] = [
          { id: "profile", label: "Add bio + photo", href: "/profile/edit", done: profileDone },
          { id: "apply", label: "Apply to your first gig", href: "/opportunities", done: appliedDone },
          { id: "message", label: "Send your first message", href: "/circle", done: msgDone },
          { id: "event", label: "Join an event near you", href: "/nearby", done: eventDone },
        ];

        if (userIntent === "collaborate") {
          built = [
            { id: "profile", label: "Add bio + photo", href: "/profile/edit", done: profileDone },
            { id: "browse", label: "Browse Match — find your circle", href: "/circle", done: connDone },
            { id: "message", label: "Send your first message", href: "/circle", done: msgDone },
            { id: "event", label: "Join a creative jam", href: "/nearby", done: eventDone },
          ];
        } else if (userIntent === "gigs") {
          built = [
            { id: "profile", label: "Polish your profile (bio + photo)", href: "/profile/edit", done: profileDone },
            { id: "browse-gigs", label: "Browse open opportunities", href: "/opportunities", done: false },
            { id: "apply", label: "Apply to your first gig", href: "/opportunities", done: appliedDone },
            { id: "message", label: "DM a creator you'd hire", href: "/circle", done: msgDone },
          ];
        } else if (userIntent === "fund") {
          built = [
            { id: "profile", label: "Add bio + photo", href: "/profile/edit", done: profileDone },
            { id: "browse-fund", label: "Explore ThriveFund campaigns", href: "/thrivefund", done: false },
            { id: "campaign", label: "Draft your first campaign", href: "/thrivefund/new", done: campaignDone },
            { id: "share", label: "Share your campaign link", href: "/thrivefund", done: false },
          ];
        } else if (userIntent === "manage") {
          built = [
            { id: "profile", label: "Add bio + photo", href: "/profile/edit", done: profileDone },
            { id: "project", label: "Create your first project", href: "/projects", done: projectDone },
            { id: "invoice", label: "Send your first invoice", href: "/thrivepay", done: invoiceDone },
            { id: "invite", label: "Invite a collaborator", href: "/projects", done: connDone },
          ];
        } else if (userIntent === "hire") {
          built = [
            { id: "profile", label: "Add bio + photo", href: "/profile/edit", done: profileDone },
            { id: "post-gig", label: "Post your first opportunity", href: "/post-opportunity", done: false },
            { id: "browse-talent", label: "Browse verified creators", href: "/circle", done: connDone },
            { id: "message", label: "DM a creator you want to hire", href: "/circle", done: msgDone },
          ];
        }

        // Only show if at least one step still incomplete
        if (built.some((s) => !s.done)) {
          setSteps(built);
          setShow(true);
        }
      } catch (e) {
        console.error("[NewMemberStarterCard]", e);
      }
    };

    load().catch((e) => console.error("[NewMemberStarterCard] load", e));
  }, [user]);

  if (!show || dismissed) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const meta = intentMeta(intent);

  const handleDismiss = () => {
    if (user) localStorage.setItem(`starter-dismissed-${user.id}`, new Date().toISOString());
    setDismissed(true);
  };

  return (
    <div className={`relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card to-energy/[0.05] p-5 ${className}`}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss starter card"
      >
        Dismiss
      </button>

      <div className="flex items-center gap-2 mb-1">
        <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
          {meta ? <span className="text-base" aria-hidden>{meta.emoji}</span> : <Sparkles className="h-4 w-4 text-primary" />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">
            {meta ? `Your first week — ${meta.short}` : "Your first week starter"}
          </p>
          <p className="text-[11px] text-muted-foreground">{doneCount} of {steps.length} done · {pct}%</p>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-3 mb-4">
        <div
          className="h-full bg-gradient-to-r from-primary to-energy transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              to={s.href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                s.done
                  ? "bg-success/10 text-muted-foreground line-through"
                  : "bg-card hover:bg-muted/60 text-foreground border border-border/40"
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="flex-1 font-medium">{s.label}</span>
              {!s.done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
