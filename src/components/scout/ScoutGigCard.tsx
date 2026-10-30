import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banknote } from "lucide-react";
import { HoloCard } from "@/components/passport/HoloCard";
import { KretoScene } from "@/components/brand/KretoScene";
import { Button } from "@/components/ui/button";
import { hasRealCompensation } from "@/lib/scoutPay";

export function ScoutPayChip({ compensation }: { compensation?: string | null }) {
  return hasRealCompensation(compensation) ? (
    <span title={compensation ?? undefined} className="inline-flex max-w-full items-center gap-1 rounded-full border border-energy/30 bg-energy/10 px-2 py-0.5 text-[10px] font-bold text-foreground">
      <Banknote className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{compensation}</span>
    </span>
  ) : <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground">Pay not listed</span>;
}

/** For You's image, title, pay, evidence and action anatomy, shared across Scout. */
export function ScoutGigCard({ title, image, href, onOpen, badges, children, footer, pay, testId }: {
  title: string; image?: string | null; href?: string; onOpen?: () => void;
  badges?: ReactNode; children?: ReactNode; footer?: ReactNode; pay?: string | null; testId?: string;
}) {
  const [broken, setBroken] = useState(false);
  const titleClass = "block text-left text-base font-bold leading-tight text-foreground line-clamp-2";
  return (
    <HoloCard className="h-full" glow={false} maxTilt={0}>
      <article data-testid={testId} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="relative aspect-[16/9] shrink-0 overflow-hidden">
          {image && !broken ? <img src={image} alt={title} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover" /> : <KretoScene scene="scout" size="thumb" className="h-full w-full" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-1.5">{badges}</div>
          <div className="absolute inset-x-3 bottom-3">
            {onOpen ? <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-0 hover:bg-transparent" onClick={onOpen} aria-label={`View brief for ${title}`}><span className={titleClass}>{title}</span></Button> : href?.startsWith("/") ? <Link to={href} className={titleClass}>{title}</Link> : <a href={href} target="_blank" rel="noopener noreferrer" className={titleClass}>{title}</a>}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div><ScoutPayChip compensation={pay} /></div>
          {children}
          <div className="mt-auto space-y-1 pt-1">{footer}</div>
        </div>
      </article>
    </HoloCard>
  );
}