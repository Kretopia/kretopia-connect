import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, MapPin, CheckCircle2 } from "lucide-react";
import { CreditThumb } from "./CreditThumb";
import { cn } from "@/lib/utils";
import type { ClaimedCredit, DraftProfile } from "./types";

interface Props {
  profile: DraftProfile;
  credits: ClaimedCredit[];
  onBack: () => void;
  onConfirm: () => void;
}

/**
 * Full-screen cinematic preview of the final profile card.
 * Last beat before email/Google handoff — "this is what you're claiming."
 */
export const ProfileRevealStep = ({ profile, credits, onBack, onConfirm }: Props) => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 60);
    return () => clearTimeout(t);
  }, []);

  const initial = profile.full_name?.trim().charAt(0).toUpperCase() || "?";
  const topCredits = credits.slice(0, 6);

  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
      {/* Ambient gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative min-h-full flex flex-col">
        {/* Header */}
        <div
          className="px-5 pt-6 pb-3 flex items-center justify-between"
          style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Edit
          </button>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Step 4 of 4 · Preview
          </div>
        </div>

        {/* Tagline */}
        <div className="px-5 pt-2 pb-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
            Your live profile card
          </p>
          <h2 className="text-2xl font-bold leading-tight mt-1">
            This is how the world will see you.
          </h2>
        </div>

        {/* The card */}
        <div className="flex-1 px-4 pb-4">
          <div
            className={cn(
              "mx-auto max-w-md rounded-3xl border border-border/60 bg-card/90 backdrop-blur-sm shadow-2xl overflow-hidden",
              "transition-all duration-700 ease-out",
              revealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-[0.97]",
            )}
          >
            {/* Cover band */}
            <div className="relative h-24 bg-gradient-to-br from-primary/40 via-primary/20 to-accent/30">
              <div className="absolute -bottom-10 left-5">
                <Avatar className="h-24 w-24 ring-4 ring-card shadow-xl">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                <CheckCircle2 className="h-3 w-3" />
                Verified credits
              </div>
            </div>

            {/* Identity */}
            <div className="pt-12 px-5 pb-4 space-y-2">
              <h3 className="text-xl font-bold leading-tight">
                {profile.full_name || "Your name"}
              </h3>
              {profile.role && (
                <p className="text-sm font-medium text-primary">{profile.role}</p>
              )}
              {profile.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {profile.location}
                </p>
              )}
              {profile.bio && (
                <p className="text-sm text-foreground/80 leading-relaxed pt-1">
                  {profile.bio}
                </p>
              )}
              {profile.skills && profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {profile.skills.slice(0, 6).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[11px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Credits grid */}
            {topCredits.length > 0 && (
              <div className="px-5 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Featured credits
                  </p>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {credits.length} total
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {topCredits.map((c) => (
                    <div
                      key={c._id}
                      className="rounded-lg overflow-hidden border border-border/60 bg-muted/40"
                    >
                      <CreditThumb
                        src={c.thumbnail}
                        title={c.title}
                        platform={c.platform || c.source_name}
                        className="aspect-square w-full"
                        iconClassName="h-6 w-6"
                      />
                      <div className="px-1.5 py-1">
                        <p className="text-[10px] font-medium line-clamp-1">{c.title}</p>
                        {c.year && (
                          <p className="text-[9px] text-muted-foreground">{c.year}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4 px-6">
            You can edit anything after you sign in. Nothing is public until you say so.
          </p>
        </div>

        {/* Sticky CTA */}
        <div
          className="sticky bottom-0 px-4 pt-3 pb-4 bg-gradient-to-t from-background via-background to-transparent border-t border-border/40"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-md mx-auto flex gap-2">
            <Button variant="outline" onClick={onBack} size="lg">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button onClick={onConfirm} size="lg" className="flex-1 font-semibold">
              Looks great — claim it
              <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
