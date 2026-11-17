import { useState } from "react";
import { Eye, X, Heart } from "lucide-react";
import { ProfileCard } from "@/components/passport/ProfileCard";
import { CardPill } from "@/components/cards/CardShell";
import { Button } from "@/components/ui/button";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import type { SwipeProfile } from "@/hooks/useSwipeProfiles";
import { extractSkillsArray } from "@/lib/matchScoring";
import { buildMatchReasons } from "@/lib/matchReasons";
import { CARD_PORTRAIT_DECK } from "@/components/cards/cardTokens";

/** Scout's actual shell, with the existing swipe engine outside its independent flip controls. */
export function MatchProfileCard({ profile, busy, onLike, onPass, onViewProfile }: {
  profile: SwipeProfile; busy: boolean;
  onLike: (profile: SwipeProfile, context: { type: string; label: string }) => void;
  onPass: (profile: SwipeProfile) => void;
  onViewProfile: (profile: SwipeProfile) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const gestures = useSwipeGestures({
    onSwipeLeft: () => { if (!busy && !flipped) onPass(profile); },
    onSwipeRight: () => { if (!busy && !flipped) onLike(profile, { type: "profile", label: "their profile" }); },
    swipeThreshold: 120, dragThreshold: 60,
  });
  const locked = busy || gestures.isAnimating;
  const reasons = buildMatchReasons({ signals: profile._matchSignals, role: profile.role, location: profile.location, likedYou: profile._likedYou, max: 2 });
  const interested = () => { if (!locked) onLike(profile, { type: "profile", label: "their profile" }); };
  const pass = () => { if (!locked) onPass(profile); };
  const skills = [...new Set([...extractSkillsArray(profile.professional_skills), ...extractSkillsArray(profile.passion_skills)])];
  return <div className={`${CARD_PORTRAIT_DECK} min-w-0 overflow-hidden`} aria-busy={busy}>
    <div role="group" aria-label={`Discover ${profile.full_name}`} tabIndex={0}
      className="touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ transform: `translateX(${gestures.dragOffset.x}px)`, transition: gestures.isDragging ? "none" : "transform 200ms" }}
      onMouseDown={!locked && !flipped ? gestures.handleDragStart : undefined}
      onTouchStart={!locked && !flipped ? gestures.handleDragStart : undefined}
      onKeyDown={e => {
        if (e.target !== e.currentTarget || flipped || locked) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); pass(); }
        if (e.key === "ArrowRight") { e.preventDefault(); interested(); }
      }}>
      <ProfileCard portrait name={profile.full_name}
        meta={[profile.role, profile.location].filter(Boolean).join(" · ")}
        avatarUrl={profile.avatar_url} coverUrl={profile.cover_image_url}
        bio={profile.bio}
        tags={skills.map(skill => <CardPill key={skill}>{skill}</CardPill>)}
        standing={profile.verification_tier && profile.verification_tier !== 'unverified' ? profile.verification_tier.replace(/_/g, ' ') : undefined}
        reasons={reasons}
        backContent={<>{profile.sub_roles?.length ? <p className="text-sm text-muted-foreground">{profile.sub_roles.join(" · ")}</p> : null}{profile.collab_intent ? <p className="text-sm text-muted-foreground">{profile.collab_intent.replace(/_/g, " ")}</p> : null}
          <dl className="grid grid-cols-2 gap-3 text-sm">{[
            ['Level', profile.level], ['Credits', profile.credits_count], ['Awards', profile.awards_count],
            ['Instagram followers', profile.instagram_followers], ['YouTube subscribers', profile.youtube_subscribers],
            ['TikTok followers', profile.tiktok_followers], ['Spotify listeners', profile.spotify_listeners],
          ].filter(([, value]) => typeof value === 'number').map(([label, value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold text-foreground">{Number(value).toLocaleString()}</dd></div>)}</dl>
        </>}
        open={{ onClick: () => onViewProfile(profile) }}
        backActions={<Button variant="outline" size="sm" disabled={locked} className="min-h-11" onClick={interested}>Interested</Button>}
        onFlipChange={value => { gestures.resetSwipe(); setFlipped(value); }}
      />
    </div>
    <div className="mt-3 flex items-center justify-center gap-5" role="group" aria-label="Discovery actions">
      <Button variant="outline" size="icon" onClick={pass} disabled={locked} className="h-14 w-14 rounded-full" aria-label="Pass" title="Pass"><X className="h-6 w-6" /></Button>
      <Button variant="ghost" size="icon" onClick={() => onViewProfile(profile)} className="h-11 w-11 rounded-full" aria-label="View profile" title="View profile"><Eye className="h-5 w-5" /></Button>
      <Button size="icon" onClick={interested} disabled={locked} className="h-14 w-14 rounded-full" aria-label="Interested" title="Interested"><Heart className="h-6 w-6" /></Button>
    </div>
  </div>;
}