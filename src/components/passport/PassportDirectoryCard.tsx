import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Layers, MapPin, MessageCircle, ShieldCheck, Star, Users2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KretoScene } from "@/components/brand/KretoScene";
import { cn } from "@/lib/utils";

export interface DirectoryPassport {
  user_id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  verification_tier: string | null;
  level: number | null;
}

const STANDING_LABEL: Record<string, string> = {
  elite: "Elite Verified",
  industry: "Industry Verified",
  verified: "Verified",
};

export const passportIdFor = (userId: string) => `KRT-${userId.replace(/-/g, "").slice(0, 5).toUpperCase()}`;

export const passportHref = (p: Pick<DirectoryPassport, "user_id" | "username">) =>
  p.username ? `/@${p.username.replace(/^@/, "")}` : `/profile/${p.user_id}`;

interface PassportDirectoryCardProps {
  passport: DirectoryPassport;
  credits: number;
  cosigns: number;
  /** The signed-in person's own card: goes to /profile, no Message. */
  isMe?: boolean;
  onMessage: (passport: DirectoryPassport) => void;
}

/**
 * One person in the Passport Directory. The whole top of the card is the way
 * in (cover, name, record), a labelled primary action repeats it, and Message
 * is the one secondary. Counts are real rows, never a guess; a Passport with
 * no cover wears a scene from the Kreto library instead of an empty box.
 */
export function PassportDirectoryCard({ passport: p, credits, cosigns, isMe = false, onMessage }: PassportDirectoryCardProps) {
  const [coverBroken, setCoverBroken] = useState(false);
  const name = p.full_name || p.username || "Creative";
  const handle = p.username ? `@${p.username.replace(/^@/, "")}` : null;
  const href = isMe ? "/profile" : passportHref(p);
  const tier = p.verification_tier?.toLowerCase();
  const standing = tier ? STANDING_LABEL[tier] : null;
  const showCover = !!p.cover_image_url && !coverBroken;

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isMe ? "border-[hsl(var(--energy)/0.55)]" : "border-border hover:border-[hsl(var(--energy)/0.4)]",
      )}
    >
      <Link
        to={href}
        aria-label={`Open ${isMe ? "your" : `${name}'s`} Passport`}
        className="block flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--energy))]"
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {showCover ? (
            <img
              src={p.cover_image_url!}
              alt=""
              loading="lazy"
              onError={() => setCoverBroken(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <KretoScene scene="talent-search" size="thumb" className="h-full w-full" />
          )}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card to-transparent" />
          {standing && (
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold text-foreground">
              <ShieldCheck className="h-3 w-3 text-[hsl(var(--energy))]" aria-hidden />
              {standing}
            </span>
          )}
          {isMe && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-[hsl(var(--energy))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--energy-foreground))]">
              You
            </span>
          )}
          <Avatar className="absolute -bottom-6 left-4 h-14 w-14 ring-2 ring-card">
            <AvatarImage src={p.avatar_url ?? undefined} />
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>

        <div className="space-y-2.5 p-4 pt-8">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{name}</p>
            {handle && <p className="truncate text-xs text-muted-foreground">{handle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {p.role && <span className="truncate">{p.role}</span>}
            {p.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {p.location}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-center">
            <Stat icon={<Star className="h-3 w-3" aria-hidden />} value={credits} label={credits === 1 ? "credit" : "credits"} />
            <Stat icon={<Users2 className="h-3 w-3" aria-hidden />} value={cosigns} label={cosigns === 1 ? "co-sign" : "co-signs"} />
            <Stat icon={<Layers className="h-3 w-3" aria-hidden />} value={p.level ?? 0} label="level" />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground/70">{passportIdFor(p.user_id)}</p>
        </div>
      </Link>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-border/60 p-2.5">
        <Button asChild size="sm" className="h-9 gap-1.5 rounded-full text-xs">
          <Link to={href}>
            {isMe ? "Open my Passport" : "Open Passport"}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
        {!isMe && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 rounded-full text-xs"
            onClick={() => onMessage(p)}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Message
          </Button>
        )}
      </div>
    </article>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-card px-1 py-2">
      <p className="flex items-center justify-center gap-1 text-sm font-bold tabular-nums text-foreground">
        <span className="text-[hsl(var(--energy))]">{icon}</span>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default PassportDirectoryCard;
