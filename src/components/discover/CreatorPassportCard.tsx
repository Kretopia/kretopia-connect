import { useState, type ReactNode } from "react";
import { MapPin, ArrowUpRight, Verified, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HoloCard } from "@/components/passport/HoloCard";
import { extractSkillsArray } from "@/lib/matchScoring";
import type { MatchReason } from "@/lib/matchReasons";

export interface CreatorCardProfile {
  full_name: string | null; role: string | null; avatar_url: string | null;
  cover_image_url?: string | null; location: string | null; bio?: string | null;
  professional_skills?: unknown; verification_tier?: string | null; average_rating?: number | null;
  collab_intent?: string | null; match_reasons?: MatchReason[];
}

const INTENT: Record<string, string> = { looking_to_hire: "Looking to hire", available_for_hire: "Available for hire", open_to_trade: "Open to trade", seeking_collaborators: "Seeking collaborators", networking: "Open to networking" };

/** Scout's artwork → identity → evidence → action anatomy, using real creator fields. */
export function CreatorPassportCard({ profile: p, onOpen, footer }: { profile: CreatorCardProfile; onOpen: () => void; footer?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  const skills = extractSkillsArray(p.professional_skills).slice(0, 3);
  const name = p.full_name || "Creator";
  return <HoloCard glow={false} maxTilt={0} className="h-full">
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Button variant="ghost" onClick={onOpen} className="group h-auto min-w-0 flex-1 flex-col items-stretch justify-start gap-0 whitespace-normal rounded-none p-0 text-left hover:bg-transparent" aria-label={`View Passport — ${name}`}>
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {!broken && (p.cover_image_url || p.avatar_url) ? <img src={p.cover_image_url || p.avatar_url || ""} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" onError={() => setBroken(true)} /> : <div className="flex h-full items-center justify-center text-4xl font-bold text-muted-foreground">{name[0]}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <div className="min-w-0"><h3 className="line-clamp-2 break-words text-base font-bold leading-tight text-foreground">{name}</h3><p className="mt-1 line-clamp-2 text-xs text-foreground/80">{p.role || "Creator"}</p></div>
            {p.verification_tier && p.verification_tier !== "none" && <Verified className="h-4 w-4 shrink-0 text-success" aria-label="Verified creator" />}
          </div>
        </div>
        <div className="flex w-full flex-1 flex-col gap-2.5 p-3">
          {p.location && <p className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{p.location}</p>}
          {p.bio && <p className="line-clamp-2 text-xs font-normal leading-relaxed text-muted-foreground">{p.bio}</p>}
          {skills.length > 0 && <div className="flex flex-wrap gap-1">{skills.map(skill => <Badge key={skill} variant="secondary" className="max-w-full whitespace-normal text-[10px] font-medium">{skill}</Badge>)}</div>}
          {p.collab_intent && INTENT[p.collab_intent] && <p className="text-[11px] font-medium text-foreground">{INTENT[p.collab_intent]}</p>}
          {p.match_reasons && p.match_reasons.length > 0 && <ul aria-label={`Why ${name} is suggested`} className="flex flex-wrap gap-1">{p.match_reasons.map(reason => <li key={reason.key}><Badge variant="outline" className="whitespace-normal text-left text-[10px] font-normal">{reason.label}</Badge></li>)}</ul>}
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">View Passport <ArrowUpRight className="h-3.5 w-3.5" /></span>
            {!!p.average_rating && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Star className="h-3 w-3" />{Number(p.average_rating).toFixed(1)}</span>}
          </div>
        </div>
      </Button>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </article>
  </HoloCard>;
}