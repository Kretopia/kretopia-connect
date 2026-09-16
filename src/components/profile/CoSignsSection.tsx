import { useMemo, useState } from "react";
import { ShieldCheck, Shield, Clock, Globe, ShieldQuestion } from "lucide-react";
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

const GROUP_META: Record<CreditEvidenceStatus, { label: string; description: string; icon: typeof ShieldCheck; badgeClass: string }> = {
  verified: {
    label: "Verified",
    description: "Confirmed — via a known platform, collaborator vouching, or Kretopia's review process.",
    icon: ShieldCheck,
    badgeClass: "bg-[hsl(var(--signal-teal))]/15 text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40",
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
    label: "Self-claimed",
    description: "Added by you. Ask a collaborator to co-sign it to build trust.",
    icon: Shield,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

const GROUP_ORDER: CreditEvidenceStatus[] = ["verified", "pending", "self_claimed", "publicly_sourced"];

/**
 * Co-Signs — four evidence-state carousels built from the same `credits`
 * data the Stamps tab uses, bucketed with the exact same classifier
 * (classifyCreditEvidence) so this can never disagree with what the Stamps
 * grid or AchievementCard's badge already say about a given credit.
 *
 * This is NOT the star-rating testimonial system (that's ReviewsSection,
 * its own "Reviews" tab) — this is evidence status for specific credit
 * claims. Never implies Self-claimed equals Verified.
 */
export function CoSignsSection({ credits, userId }: CoSignsSectionProps) {
  const [endorsementCredit, setEndorsementCredit] = useState<Credit | null>(null);
  const reducedMotion = useReducedMotion();

  const groups = useMemo(() => {
    const buckets: Record<CreditEvidenceStatus, Credit[]> = {
      verified: [], publicly_sourced: [], pending: [], self_claimed: [],
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

  return (
    <div className="space-y-6">
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
                onRequestCosign={(c) => setEndorsementCredit(c)}
              />
            )}
          </div>
        );
      })}

      {endorsementCredit && (
        <CreditEndorsementDialog
          open={!!endorsementCredit}
          onOpenChange={(open) => !open && setEndorsementCredit(null)}
          credit={endorsementCredit}
          userId={userId}
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
  onRequestCosign,
}: {
  items: Credit[];
  status: CreditEvidenceStatus;
  label: string;
  reducedMotion: boolean;
  onRequestCosign: (c: Credit) => void;
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
                    {status !== "pending" && (
                      <button
                        type="button"
                        onClick={() => onRequestCosign(c)}
                        className="mt-auto pt-2 text-[11px] font-semibold text-white text-left hover:text-[#FF2DA1] hover:underline transition-colors"
                      >
                        Request Co-Sign
                      </button>
                    )}
                    {status === "pending" && (
                      <p className="mt-auto pt-2 text-[11px] text-muted-foreground">Awaiting response</p>
                    )}
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

export default CoSignsSection;
