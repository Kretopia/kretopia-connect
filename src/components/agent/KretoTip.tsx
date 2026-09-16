/**
 * KretoTip — contextual whisper card from Kreto, Kretopia's Executive Producer.
 *
 * Reads the current route to pick a relevant tip + seed prompt. Tapping
 * "Ask Kreto" opens the global Copilot FAB pre-loaded with the prompt
 * via the existing `thrive-copilot:open` event listener.
 *
 * Drop it onto any authed surface — Today, Discover, Desk, Pay — without
 * any per-page wiring.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { KretoMark } from "@/components/brand/KretoMark";
import { KretoPresence } from "@/components/brand/KretoPresence";
import { cn } from "@/lib/utils";

type Tip = { eyebrow: string; line: string; cta: string; prompt: string };

const ROUTE_TIPS: Array<{ match: (p: string) => boolean; tips: Tip[] }> = [
  {
    match: (p) => p === "/" || p.startsWith("/today"),
    tips: [
      { eyebrow: "Today",   line: "Want me to line up three opportunities for you this week?", cta: "Find me opportunities", prompt: "Find me three new opportunities I should pursue this week and explain why each one fits." },
      { eyebrow: "Today",   line: "Your Creative Passport is doing the work — want me to draft an outreach DM?",            cta: "Draft outreach",         prompt: "Draft an outreach DM I can send to two creators or brands I should be talking to right now." },
      { eyebrow: "Today",   line: "I can scan your last week and tell you where you're leaving money on the table.",        cta: "Run the audit",          prompt: "Audit my last week of activity and tell me where I'm leaving money or opportunities on the table." },
    ],
  },
  {
    match: (p) => p.startsWith("/discover") || p.startsWith("/scout") || p.startsWith("/opportunities"),
    tips: [
      { eyebrow: "Scout",   line: "Tell me what you're hunting for — I'll filter the noise and shortlist real fits.",       cta: "Shortlist for me",       prompt: "Based on my Passport, shortlist the opportunities here that are a real fit and explain why." },
      { eyebrow: "Scout",   line: "Want me to draft a pitch for the first one that catches your eye?",                       cta: "Draft a pitch",          prompt: "Help me draft a pitch for the opportunity I'm looking at — in my voice." },
    ],
  },
  {
    match: (p) => p.startsWith("/desk"),
    tips: [
      { eyebrow: "Studio",  line: "Drop a brief or a voice note — I'll turn it into a project, tasks and a moodboard.",     cta: "Turn it into a plan",    prompt: "I have a new brief. Help me turn it into a project plan with milestones, tasks and a deliverables board." },
      { eyebrow: "Studio",  line: "Want me to draft the proposal, rate card or contract for this one?",                       cta: "Draft the doc",          prompt: "Draft a proposal for this project — pull rates, scope and timeline from my history." },
    ],
  },
  {
    match: (p) => p.startsWith("/match"),
    tips: [
      { eyebrow: "Match",   line: "Tell me the brief — I'll surface collaborators whose past work actually proves they can do it.", cta: "Find collaborators", prompt: "Find me collaborators for a brief I'm working on. Ask me what you need to know first." },
    ],
  },
  {
    match: (p) => p.startsWith("/thrivepay") || p.startsWith("/accounting"),
    tips: [
      { eyebrow: "KrePay",  line: "Want me to chase the unpaid invoices and draft the follow-ups?",                          cta: "Chase invoices",         prompt: "Look at my open invoices and draft polite, firm follow-up messages for the ones overdue." },
      { eyebrow: "KrePay",  line: "I can scan a brief and tell you exactly what to charge.",                                  cta: "Price this job",         prompt: "Help me price a new job — ask me for the brief, scope and timeline." },
    ],
  },
  {
    match: (p) => p.startsWith("/profile"),
    tips: [
      { eyebrow: "Passport",line: "Want me to audit your Passport and tell you the three highest-leverage things to fix?",   cta: "Audit my Passport",      prompt: "Audit my Creative Passport. Give me the three highest-leverage things to improve, in order." },
    ],
  },
  {
    match: (p) => p.startsWith("/clients"),
    tips: [
      { eyebrow: "Clients", line: "Paste a signature, a brief or just a name — I'll build the client record for you.",       cta: "Add a client for me",    prompt: "I'll paste some client details. Extract the name, company, email and phone and tell me what's missing." },
      { eyebrow: "Clients", line: "Want me to draft the follow-up to the client you haven't spoken to in a while?",           cta: "Draft the follow-up",    prompt: "Draft a warm follow-up message to a client I haven't spoken to in a while, in my voice." },
    ],
  },
  {
    match: (p) => p.startsWith("/meetup") || p.startsWith("/events"),
    tips: [
      { eyebrow: "Events",  line: "Describe your event in one sentence — I'll build the whole listing.",                      cta: "Build my event",         prompt: "I want to host an event. Ask me one question at a time and then write the full listing: title, description, date, venue and tickets." },
      { eyebrow: "Events",  line: "Want me to write the invite copy and pick who to send it to?",                             cta: "Write the invite",       prompt: "Write invite copy for my next event and suggest which creators in my network to send it to." },
    ],
  },
  {
    match: (p) => p.startsWith("/circle") || p.startsWith("/stages"),
    tips: [
      { eyebrow: "Circle",  line: "I can tell you who's worth adding to your circle based on who you've already worked with.", cta: "Suggest people",         prompt: "Based on my credits and collaborations, who should I add to my circle and why?" },
    ],
  },
  {
    match: (p) => p.startsWith("/recordings"),
    tips: [
      { eyebrow: "Recordings", line: "Give me a recording and I'll pull the brief, the decisions and the follow-ups out of it.", cta: "Summarise a call",    prompt: "Summarise my latest recorded call: key decisions, action items and who owns each one." },
    ],
  },
  {
    match: (p) => p.startsWith("/work") || p.startsWith("/studios"),
    tips: [
      { eyebrow: "Studios", line: "Drop a brief and I'll spin up the Studio — tasks, deliverables and timeline included.",     cta: "Spin up a Studio",       prompt: "I have a new brief. Turn it into a Studio with tasks, deliverables and a timeline." },
    ],
  },
];

const FALLBACK: Tip = {
  eyebrow: "Kreto",
  line: "I run point on your career. Ask me anything — opportunities, pricing, outreach, planning.",
  cta: "Open Kreto",
  prompt: "",
};

const DISMISS_KEY = "kreto-tip-dismissed-at";
const DISMISS_HOURS = 6;

/** Kreto controlled rollout, one route group at a time, each with explicit
 *  approval after the pilot review (KRETO_3D_REFERENCE_AND_RIGHTS_AUDIT.md
 *  §13, KRETO_3D_PILOT_IMPLEMENTATION_REPORT.md). Route groups in this set
 *  get the embodied presence instead of the flat KretoMark used by every
 *  other group here. Studio shipped in the pilot; Scout, Passport, Events
 *  and Circle (the brief's "Stage/Circle context" -- covers both /circle
 *  and /stages) are the rollout surfaces approved so far. */
const PRESENCE_EYEBROWS = new Set(["Studio", "Scout", "Passport", "Events", "Circle"]);

interface KretoTipProps {
  /** Override route detection with an explicit tip group. */
  surface?: "today" | "discover" | "desk" | "match" | "pay" | "passport";
  className?: string;
  compact?: boolean;
}

export const KretoTip = ({ surface, className, compact }: KretoTipProps) => {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return;
      const ts = Number(raw);
      if (Number.isFinite(ts) && Date.now() - ts < DISMISS_HOURS * 60 * 60 * 1000) {
        setDismissed(true);
      }
    } catch {}
  }, []);

  const tips = useMemo<Tip[]>(() => {
    const path = location.pathname;
    const surfacePath: Record<string, string> = {
      today: "/", discover: "/discover", desk: "/desk", match: "/match", pay: "/thrivepay", passport: "/profile",
    };
    const target = surface ? surfacePath[surface] : path;
    const group = ROUTE_TIPS.find((g) => g.match(target));
    return group?.tips ?? [FALLBACK];
  }, [location.pathname, surface]);

  // Rotate the tip every 8s for variety; pause if only one.
  useEffect(() => {
    if (tips.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % tips.length), 8000);
    return () => clearInterval(id);
  }, [tips.length]);

  if (dismissed) return null;

  const tip = tips[idx] ?? FALLBACK;
  // The tips themselves are static, route-based canned suggestions (see
  // ROUTE_TIPS above), not a real generated proposal, so every instance
  // renders state="idle" regardless of surface -- proposal_ready would be a
  // false claim about work Kreto hasn't actually done.
  const usesPresence = PRESENCE_EYEBROWS.has(tip.eyebrow);

  const openKreto = (prompt?: string) => {
    window.dispatchEvent(new CustomEvent("thrive-copilot:open", { detail: prompt ? { prompt } : {} }));
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground",
        compact ? "p-3" : "p-4 sm:p-5",
        className,
      )}
    >
      {/* Sunset glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--kretopia-sunset, hsl(327 100% 59%))" }}
      />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center text-card-foreground/50 hover:text-card-foreground hover:bg-card-foreground/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="relative flex items-start gap-3 sm:gap-4">
        {usesPresence ? (
          <KretoPresence size={compact ? "compact" : "card"} state="idle" />
        ) : (
          <KretoMark variant="default" size={compact ? "sm" : "md"} />
        )}

        <div className="min-w-0 flex-1 pr-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[hsl(var(--energy))] mb-1">
            Kreto · {tip.eyebrow}
          </p>
          <p className={cn("text-card-foreground/90 leading-snug", compact ? "text-sm" : "text-sm sm:text-[15px]")}>
            {tip.line}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openKreto(tip.prompt)}
              className="group inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-card-foreground bg-card-foreground/10 border border-card-foreground/15 hover:bg-card-foreground/15 transition-colors"
            >
              {tip.cta}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => openKreto()}
              className="text-[11px] font-semibold text-card-foreground/60 hover:text-card-foreground px-2 py-1 transition-colors"
            >
              Or just chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KretoTip;
