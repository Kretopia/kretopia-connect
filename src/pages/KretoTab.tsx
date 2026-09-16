import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PenLine, IdCard, Compass, Send, ArrowUpRight,
  CheckCircle2, Clock, ShieldQuestion, Loader2,
} from "lucide-react";
import { BRAND } from "@/lib/brandLexicon";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { KRETO_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { InlineKretoChat } from "@/components/kreto/InlineKretoChat";
import { KretoConversationHistory } from "@/components/kreto/KretoConversationHistory";

const QUICK_ACTIONS = [
  {
    icon: PenLine,
    label: "Draft a pitch",
    prompt: "Help me draft a pitch for an opportunity I'm considering.",
  },
  {
    icon: IdCard,
    label: "Improve my Passport",
    prompt: "Look at my Passport and tell me what would make it stronger.",
  },
  {
    icon: Compass,
    label: "Find matching opportunities",
    prompt: "Find opportunities that match my skills and availability right now.",
  },
  {
    icon: Send,
    label: "Prepare a follow-up",
    prompt: "Help me prepare a follow-up message for a conversation that's gone quiet.",
  },
] as const;

interface RecentGig {
  id: string;
  title: string;
  company: string | null;
  fit_score: number;
}

interface RecentAction {
  id: string;
  title: string;
  status: string;
  action_type: string;
}

interface PassportSnapshot {
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

/**
 * /kreto — Kreto's live workspace. Renders the chat inline (InlineKretoChat,
 * not the global Copilot Sheet) alongside real account context (Passport
 * snapshot, most recent Scout match, recent proposed actions) so the page
 * reads as an active dashboard rather than an empty pitch for a feature the
 * user hasn't tried yet. Every section only renders when real data exists —
 * no placeholder numbers, no invented activity.
 */
export default function KretoTab() {
  const { user } = useAuth();
  const [passport, setPassport] = useState<PassportSnapshot | null>(null);
  const [gig, setGig] = useState<RecentGig | null>(null);
  const [actions, setActions] = useState<RecentAction[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [seed, setSeed] = useState<{ text: string; n: number } | null>(null);
  const ask = (text: string) => setSeed((s) => ({ text, n: (s?.n ?? 0) + 1 }));
  // null = a fresh, not-yet-persisted draft conversation.
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const handleConversationCreated = (id: string) => {
    setActiveConversationId(id);
    setHistoryRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!user) { setLoadingContext(false); return; }
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { data: gigs }, { data: actionRows }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, role").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("scouted_gigs")
          .select("id, title, company, fit_score")
          .eq("target_user_id", user.id)
          .gt("expires_at", new Date().toISOString())
          .order("fit_score", { ascending: false })
          .limit(1),
        supabase
          .from("agent_actions")
          .select("id, title, status, action_type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      if (cancelled) return;
      setPassport(profile ?? null);
      setGig(gigs?.[0] ?? null);
      setActions(actionRows ?? []);
      setLoadingContext(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background text-foreground">
      <FeaturePageHeader
        eyebrow="Executive Producer"
        title={`${BRAND.agentName}.`}
        accentTitle="Your creative career, run point."
        subtitle={`${BRAND.agentRole}. Finds opportunities, drafts pitches, keeps your Passport sharp, and closes the loop from search to paid credit — with your approval at every step.`}
        tutorial={{ featureKey: "kreto", label: "How Kreto works", steps: KRETO_TUTORIAL }}
      />

      <StudioFeatureShell>
        <div className="flex gap-4 items-start">
          {/* Desktop: fixed rail beside the chat. Mobile: a compact History
              button that opens the same list in a Sheet. */}
          <KretoConversationHistory
            activeConversationId={activeConversationId}
            onSelect={setActiveConversationId}
            onNew={() => setActiveConversationId(null)}
            refreshKey={historyRefreshKey}
          />

          <div className="flex-1 min-w-0 space-y-5">
            {/* Primary surface — the live thread, answered right here on the page */}
            <InlineKretoChat
              seedPrompt={seed?.text ?? null}
              seedNonce={seed?.n}
              conversationId={activeConversationId}
              onConversationCreated={handleConversationCreated}
            />

            {/* Quick actions — secondary shortcuts, visually quieter than the primary CTA above */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/40 font-semibold mb-2.5">Or start with</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => ask(prompt)}
                    className="btn-glass btn-glass-outline flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium"
                  >
                    <Icon className="h-4 w-4 text-foreground/50 shrink-0" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live context: Passport, Scout, recent actions */}
        {loadingContext ? (
          <div className="flex items-center gap-2 text-foreground/40 text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your context…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {passport && (
              <Link
                to="/profile"
                className="rounded-xl border border-border bg-foreground/[0.03] p-4 hover:border-foreground/25 transition-colors"
              >
                <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/40 font-semibold mb-2">Passport</p>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-foreground/10 overflow-hidden shrink-0 flex items-center justify-center text-xs font-semibold">
                    {passport.avatar_url ? (
                      <img src={passport.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      passport.full_name?.[0] || "?"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{passport.full_name || "Your profile"}</p>
                    <p className="text-xs text-foreground/50 truncate">{passport.role || "Open your Passport"}</p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-foreground/30 ml-auto shrink-0" />
                </div>
              </Link>
            )}

            {gig && (
              <button
                type="button"
                onClick={() => ask(`Help me think through this opportunity: "${gig.title}"${gig.company ? ` at ${gig.company}` : ""}.`)}
                className="btn-glass btn-glass-outline text-left rounded-xl p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/40 font-semibold mb-2">Top Scout match</p>
                <p className="text-sm font-medium truncate">{gig.title}</p>
                <p className="text-xs text-foreground/50 truncate">
                  {gig.company || "Opportunity"} · {gig.fit_score}% fit
                </p>
              </button>
            )}

            {actions.length > 0 && (
              <div className="rounded-xl border border-border bg-foreground/[0.03] p-4 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-foreground/40 font-semibold mb-2.5">Recent proposed actions</p>
                <div className="space-y-2">
                  {actions.map((a) => {
                    const Icon = a.status === "completed" ? CheckCircle2 : a.status === "pending" ? ShieldQuestion : Clock;
                    return (
                      <div key={a.id} className="flex items-center gap-2.5 text-sm">
                        <Icon className="h-3.5 w-3.5 text-foreground/40 shrink-0" aria-hidden />
                        <span className="truncate flex-1">{a.title}</span>
                        <span className="text-[10px] uppercase tracking-wider text-foreground/40 shrink-0">{a.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-foreground/35 leading-relaxed">
          {BRAND.agentName} opens automatically above. Anything that could affect other people, spend
          money, or send something on your behalf waits for your approval first — {BRAND.agentName}
          only acts on its own for safe, reversible steps.
        </p>
      </StudioFeatureShell>
    </div>
  );
}
