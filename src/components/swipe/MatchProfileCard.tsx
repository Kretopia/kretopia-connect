import { Heart } from "lucide-react";
import { ProfileCard } from "@/components/passport/ProfileCard";
import { CardPill } from "@/components/cards/CardShell";
import { Button } from "@/components/ui/button";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import type { SwipeProfile } from "@/hooks/useSwipeProfiles";
import { extractSkillsArray } from "@/lib/matchScoring";
import { buildMatchReasons } from "@/lib/matchReasons";
import { badgeLabel } from "@/lib/badgeLabel";
import { CARD_PORTRAIT_DECK } from "@/components/cards/cardTokens";

const label = (value: string) => {
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** One complete Passport and exactly two answers: Pass or Connect. */
export function MatchProfileCard({ profile, busy, onLike, onPass }: {
  profile: SwipeProfile; busy: boolean;
  onLike: (profile: SwipeProfile, context: { type: string; label: string }) => void;
  onPass: (profile: SwipeProfile) => void;
}) {
  const gestures = useSwipeGestures({
    onSwipeLeft: () => { if (!busy) onPass(profile); },
    onSwipeRight: () => { if (!busy) onLike(profile, { type: "profile", label: "their profile" }); },
    swipeThreshold: 120, dragThreshold: 60,
  });
  const locked = busy || gestures.isAnimating;
  const reasons = buildMatchReasons({ signals: profile._matchSignals, role: profile.role, location: profile.location, likedYou: profile._likedYou, max: 1 });
  const interested = () => { if (!locked) onLike(profile, { type: "profile", label: "their profile" }); };
  const pass = () => { if (!locked) onPass(profile); };
  const skills = [...new Set([...extractSkillsArray(profile.professional_skills), ...extractSkillsArray(profile.passion_skills)])];
  const stats = ([
    ["Level", profile.level], ["XP", profile.xp], ["Portfolio", profile.portfolio_count],
    ["Credits", profile.credits_count], ["Awards", profile.awards_count],
    ["Instagram followers", profile.instagram_followers], ["YouTube subscribers", profile.youtube_subscribers],
    ["TikTok followers", profile.tiktok_followers], ["X / Twitter followers", profile.twitter_followers],
    ["Spotify listeners", profile.spotify_listeners],
  ] as Array<[string, number | null | undefined]>).filter((item): item is [string, number] => typeof item[1] === "number");
  const hasDetails = !!(profile.sub_roles?.length || profile.collab_intent || stats.length);

  return <div className={`${CARD_PORTRAIT_DECK} min-w-0`} aria-busy={busy}>
    <div role="group" aria-label={`Discover ${profile.full_name}`} tabIndex={0}
      className="touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ transform: `translateX(${gestures.dragOffset.x}px)`, transition: gestures.isDragging ? "none" : "transform 200ms" }}
      onMouseDown={!locked ? gestures.handleDragStart : undefined}
      onTouchStart={!locked ? gestures.handleDragStart : undefined}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || locked) return;
        if (event.key === "ArrowLeft") { event.preventDefault(); pass(); }
        if (event.key === "ArrowRight") { event.preventDefault(); interested(); }
      }}>
      <ProfileCard portrait name={profile.full_name}
        meta={[profile.role, profile.location].filter(Boolean).join(" · ")}
        avatarUrl={profile.avatar_url} coverUrl={profile.cover_image_url}
        bio={profile.bio}
        tags={skills.map(skill => <CardPill key={skill}>{skill}</CardPill>)}
        standing={profile.verification_tier && profile.verification_tier !== "unverified" ? label(profile.verification_tier) : undefined}
        badge={profile.badge ? <CardPill tone="type">{badgeLabel(profile.badge)}</CardPill> : undefined}
        reasons={reasons}
        open={{}}
        backContent={hasDetails ? <div className="space-y-2 border-t border-border pt-2" data-card-part="passport-details">
          {profile.sub_roles?.length ? <p className="text-xs leading-snug text-muted-foreground"><span className="font-semibold text-foreground">Also · </span>{profile.sub_roles.join(" · ")}</p> : null}
          {profile.collab_intent ? <p className="text-xs leading-snug text-muted-foreground"><span className="font-semibold text-foreground">Collaboration · </span>{label(profile.collab_intent)}</p> : null}
          {stats.length ? <dl className="grid grid-cols-3 gap-x-3 gap-y-2">{stats.map(([name, value]) => <div key={name} className="min-w-0">
            <dt className="text-[9px] leading-tight text-muted-foreground">{name}</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{value.toLocaleString()}</dd>
          </div>)}</dl> : null}
        </div> : null}
      />
    </div>
    <div className="mt-2 grid h-12 grid-cols-2 gap-2" role="group" aria-label="Discovery actions">
      <Button variant="outline" onClick={pass} disabled={locked} className="h-12 rounded-full text-sm font-semibold" aria-label="Pass">Pass</Button>
      <Button onClick={interested} disabled={locked} variant="hero" className="h-12 gap-2 rounded-full px-6 text-sm" aria-label="Connect"><Heart className="h-5 w-5" aria-hidden /> Connect</Button>
    </div>
  </div>;
}
