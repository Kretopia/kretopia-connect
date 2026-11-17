import { useState } from "react";
import { Eye, X, Heart } from "lucide-react";
import { ProfileCard } from "@/components/passport/ProfileCard";
import { CardPill } from "@/components/cards/CardShell";
import { Button } from "@/components/ui/button";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import type { SwipeProfile } from "@/hooks/useSwipeProfiles";
import { extractSkillsArray } from "@/lib/matchScoring";
import { buildMatchReasons } from "@/lib/matchReasons";

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
  return <div className="w-full min-w-0 overflow-hidden" aria-busy={busy}>
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
      <ProfileCard landscape name={profile.full_name}
        meta={[profile.role, profile.location].filter(Boolean).join(" · ")}
        avatarUrl={profile.avatar_url} coverUrl={profile.cover_image_url}
        bio={profile.bio}
        tags={extractSkillsArray(profile.professional_skills).map(skill => <CardPill key={skill}>{skill}</CardPill>)}
        reasons={reasons}
        backContent={<>{profile.sub_roles?.length ? <p className="text-xs text-muted-foreground">{profile.sub_roles.join(" · ")}</p> : null}{profile.collab_intent ? <p className="text-xs text-muted-foreground">{profile.collab_intent.replace(/_/g, " ")}</p> : null}</>}
        open={{ onClick: () => onViewProfile(profile) }}
        primary={{ label: busy ? "Saving…" : "Interested", onClick: interested, disabled: locked }}
        backActions={<Button variant="outline" size="sm" disabled={locked} className="min-h-11" onClick={interested}>Interested</Button>}
        onFlipChange={value => { gestures.resetSwipe(); setFlipped(value); }}
      />
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2" role="group" aria-label="Discovery actions">
      <Button variant="outline" onClick={pass} disabled={locked} className="min-h-11 gap-2"><X className="h-4 w-4" />Pass</Button>
      <Button variant="ghost" onClick={() => onViewProfile(profile)} className="min-h-11 gap-2"><Eye className="h-4 w-4" />View profile</Button>
      <Button onClick={interested} disabled={locked} className="min-h-11 gap-2"><Heart className="h-4 w-4" />Interested</Button>
    </div>
  </div>;
}