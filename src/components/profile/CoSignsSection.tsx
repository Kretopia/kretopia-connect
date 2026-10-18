import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getShareUrl } from "@/lib/constants";
import { ShieldCheck, Shield, Clock, Globe, Handshake, ShieldQuestion, BellRing, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { HoloCard } from "@/components/passport/HoloCard";
import { EmptyState } from "@/components/ui/empty-state";
import { CreditEndorsementDialog } from "./CreditEndorsementDialog";
import { classifyCreditEvidence, type CreditEvidenceStatus } from "@/lib/passport/creditEvidence";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Credit {
  id: string;
  project_name: string;
  role: string;
  year?: number | null;
  client_brand?: string | null;
  platform?: string | null;
  verification_status?: string | null;
  endorsement_count?: number | null;
}

interface CoSignsSectionProps {
  credits: Credit[];
  userId: string;
}

interface PendingRequest {
  credit_id: string;
  token: string | null;
  endorser_name: string | null;
  requested_at: string;
}

const GROUP_META: Record<CreditEvidenceStatus, { label: string; description: string; icon: typeof ShieldCheck; badgeClass: string }> = {
  verified: {
    label: "Verified",
    description: "Confirmed — via a known platform, collaborator vouching, or Kretopia's review process.",
    icon: ShieldCheck,
    badgeClass: "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40",
  },
  co_signed: {
    label: "Co-signed",
    description: "Collaborators who worked on it vouch for it. Not yet verified by an authoritative source.",
    icon: Handshake,
    badgeClass: "bg-[hsl(var(--signal-teal))]/10 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/30",
  },
  publicly_sourced: {
    label: "Publicly Sourced",
    description: "Kreto found this from public information and you confirmed it's yours.",
    icon: Globe,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "Pending",
    description: "Waiting on a collaborator to confirm.",
    icon: Clock,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  self_claimed: {
    label: "Self-declared",
    description: "Added by you. Ask a collaborator to co-sign it to build trust.",
    icon: Shield,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

const GROUP_ORDER: CreditEvidenceStatus[] = ["verified", "co_signed", "pending", "self_claimed", "publicly_sourced"];

/**
 * Co-Signs — four evidence-state carousels built from the same `credits`
 * data the Stamps tab uses, bucketed with the exact same classifier
 * (classifyCreditEvidence) so this can never disagree with what the Stamps
 * grid or AchievementCard's badge already say about a given credit.
 *
 * This is NOT the star-rating testimonial system (that's ReviewsSection,
 * its own "Reviews" tab) — this is evidence status for specific credit
 * claims. Never implies Self-declared equals Verified.
 */
export function CoSignsSection({ credits, userId }: CoSignsSectionProps) {
  const [endorsementCredit, setEndorsementCredit] = useState<Credit | null>(null);
  const [reminder, setReminder] = useState<{ link: string; name?: string | null } | null>(null);
  const reducedMotion = useReducedMotion();

  // Requests the user already sent and nobody has answered yet. Without this a
  // pending credit was a dead end ("Awaiting response", no way to nudge anyone).
  // If the read is blocked or empty the cards simply fall back to "ask someone".
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["credit-cosign-pending", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_endorsements")
        .select("credit_id, token, endorser_name, requested_at")
        .eq("requested_by", userId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) return [] as PendingRequest[];
      return (data || []) as PendingRequest[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
  const pendingByCredit = useMemo(() => {
    const m = new Map<string, PendingRequest>();
    for (const r of pendingRequests) if (!m.has(r.credit_id)) m.set(r.credit_id, r);
    return m;
  }, [pendingRequests]);

  const openRemind = (c: Credit) => {
    const req = pendingByCredit.get(c.id);
    setReminder(req?.token ? { link: getShareUrl(`/credit-verify?token=${encodeURIComponent(req.token)}`), name: req.endorser_name } : null);
    setEndorsementCredit(c);
  };
  const openAsk = (c: Credit) => {
    setReminder(null);
    setEndorsementCredit(c);
  };

  const groups = useMemo(() => {
    const buckets: Record<CreditEvidenceStatus, Credit[]> = {
      verified: [], co_signed: [], publicly_sourced: [], pending: [], self_claimed: [],
    };
    for (const c of credits) {
      buckets[classifyCreditEvidence(c)].push(c);
    }
    return buckets;
  }, [credits]);

  if (credits.length === 0) {
    return (
      <EmptyState
        icon={ShieldQuestion}
        eyebrow="Co-Signs"
        title="No credits to co-sign yet"
        description="Add a credit in Stamps first, then ask the people you worked with to confirm it."
      />
    );
  }

  const verifiedCount = groups.verified.length;
  const pct = Math.round((verifiedCount / credits.length) * 100);
  const nextToConfirm = groups.self_claimed.find((c) => !pendingByCredit.has(c.id)) ?? groups.publicly_sourced.find((c) => !pendingByCredit.has(c.id));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Confirmed work history</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {verifiedCount} of {credits.length} credits confirmed
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A credit someone else confirmed is what lets a client trust your experience at a glance.
            </p>
          </div>
          {nextToConfirm && (
            <Button size="sm" className="shrink-0 gap-1.5" onClick={() => openAsk(nextToConfirm)}>
              <UserPlus className="h-3.5 w-3.5" />
              <span className="max-w-[10rem] truncate">Confirm {nextToConfirm.project_name}</span>
            </Button>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Credits confirmed">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-energy transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {GROUP_ORDER.map((status) => {
        const meta = GROUP_META[status];
        const Icon = meta.icon;
        const items = groups[status];
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 shrink-0" />
              <h3 className="text-sm font-bold">{meta.label}</h3>
              <Badge variant="outline" className={meta.badgeClass}>{items.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{meta.description}</p>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground">Nothing here yet.</p>
              </div>
            ) : (
              <EvidenceCarousel
                items={items}
                status={status}
                label={meta.label}
                reducedMotion={reducedMotion}
                pendingByCredit={pendingByCredit}
                onRequestCosign={openAsk}
                onRemind={openRemind}
              />
            )}
          </div>
        );
      })}

      {endorsementCredit && (
        <CreditEndorsementDialog
          open={!!endorsementCredit}
          onOpenChange={(open) => { if (!open) { setEndorsementCredit(null); setReminder(null); } }}
          credit={endorsementCredit}
          userId={userId}
          reminder={reminder}
        />
      )}
    </div>
  );
}

function EvidenceCarousel({
  items,
  status,
  label,
  reducedMotion,
  pendingByCredit,
  onRequestCosign,
  onRemind,
}: {
  items: Credit[];
  status: CreditEvidenceStatus;
  label: string;
  reducedMotion: boolean;
  pendingByCredit: Map<string, PendingRequest>;
  onRequestCosign: (c: Credit) => void;
  onRemind: (c: Credit) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }}
        className="w-full"
        aria-label={`${label} credits`}
      >
        <CarouselContent className="-ml-3">
          {items.map((c) => (
            <CarouselItem key={c.id} className="pl-3 basis-auto">
              <div className="w-60">
                <HoloCard maxTilt={4}>
                  <div className="rounded-2xl border border-border/60 bg-card p-3.5 min-h-[140px] flex flex-col">
                    <p className="text-sm font-semibold truncate">{c.project_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.role}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {[c.client_brand || c.platform, c.year].filter(Boolean).join(" · ")}
                    </p>
                    <CardAction
                      credit={c}
                      status={status}
                      request={pendingByCredit.get(c.id)}
                      onAsk={onRequestCosign}
                      onRemind={onRemind}
                    />
                  </div>
                </HoloCard>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {items.length > 2 && (
          <>
            <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label={`Previous — ${label} credits`} />
            <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label={`Next — ${label} credits`} />
          </>
        )}
      </Carousel>
      {items.length > 1 && <CarouselPositionDots api={api} label={`${label} credits`} className="mt-2" />}
    </div>
  );
}

function CardAction({
  credit,
  status,
  request,
  onAsk,
  onRemind,
}: {
  credit: Credit;
  status: CreditEvidenceStatus;
  request?: PendingRequest;
  onAsk: (c: Credit) => void;
  onRemind: (c: Credit) => void;
}) {
  // A request is out and unanswered: show how long, and make nudging one tap.
  if (request || status === "pending") {
    const days = request ? Math.max(0, differenceInCalendarDays(new Date(), new Date(request.requested_at))) : null;
    const waiting = days === null ? "Awaiting response" : days === 0 ? "Asked today" : `Asked ${days} day${days === 1 ? "" : "s"} ago`;
    return (
      <div className="mt-auto pt-2">
        <p className="text-[11px] text-muted-foreground">{waiting}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-1.5 h-8 w-full gap-1.5 text-xs"
          onClick={() => (request?.token ? onRemind(credit) : onAsk(credit))}
        >
          <BellRing className="h-3.5 w-3.5" />
          {request?.token ? "Send a reminder" : "Ask someone"}
        </Button>
      </div>
    );
  }
  if (status === "verified") {
    return (
      <div className="mt-auto pt-2">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => onAsk(credit)}>
          Add another co-sign
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-auto pt-2">
      <Button size="sm" className="h-8 w-full gap-1.5 text-xs" onClick={() => onAsk(credit)}>
        <ShieldCheck className="h-3.5 w-3.5" />
        Ask for a co-sign
      </Button>
    </div>
  );
}

export default CoSignsSection;
