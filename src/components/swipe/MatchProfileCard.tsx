import { Heart, MapPin, ShieldCheck } from "lucide-react";
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

function PassportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2 border-t border-border pt-3" data-card-part="passport-details">
    <h5 className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">{title}</h5>
    {children}
  </section>;
}

/** The fixed-size public Passport, front and back, with exactly two equal decisions. */
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
  const professionalSkills = extractSkillsArray(profile.professional_skills);
  const passionSkills = extractSkillsArray(profile.passion_skills);
  const skills = [...new Set([...professionalSkills, ...passionSkills])];
  const stats = ([
    ["Level", profile.level], ["XP", profile.xp], ["Portfolio", profile.portfolio_count],
    ["Credits", profile.credits_count], ["Awards", profile.awards_count],
    ["Instagram followers", profile.instagram_followers], ["YouTube subscribers", profile.youtube_subscribers],
    ["TikTok followers", profile.tiktok_followers], ["X / Twitter followers", profile.twitter_followers],
    ["Spotify listeners", profile.spotify_listeners],
  ] as Array<[string, number | null | undefined]>).filter((item): item is [string, number] => typeof item[1] === "number");

  const fullPassport = <div className="space-y-4">
    <PassportSection title="Identity">
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-muted-foreground">Primary craft</dt><dd className="mt-1 font-semibold text-foreground">{profile.role || "Not shared"}</dd></div>
        <div><dt className="text-muted-foreground">Based in</dt><dd className="mt-1 flex items-center gap-1 font-semibold text-foreground"><MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />{profile.location || "Not shared"}</dd></div>
        <div><dt className="text-muted-foreground">Verification</dt><dd className="mt-1 flex items-center gap-1 font-semibold text-foreground"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />{profile.verification_tier ? label(profile.verification_tier) : "Unverified"}</dd></div>
        <div><dt className="text-muted-foreground">Kretopia recognition</dt><dd className="mt-1 font-semibold text-foreground">{profile.badge ? badgeLabel(profile.badge) : "No badge"}</dd></div>
      </dl>
    </PassportSection>
    {profile.sub_roles?.length ? <PassportSection title="Also working as"><p className="text-sm leading-relaxed text-foreground">{profile.sub_roles.join(" · ")}</p></PassportSection> : null}
    {professionalSkills.length ? <PassportSection title="Professional skills"><div className="flex flex-wrap gap-1.5">{professionalSkills.map(skill => <CardPill key={`pro-${skill}`}>{skill}</CardPill>)}</div></PassportSection> : null}
    {passionSkills.length ? <PassportSection title="Passions & creative interests"><div className="flex flex-wrap gap-1.5">{passionSkills.map(skill => <CardPill key={`passion-${skill}`}>{skill}</CardPill>)}</div></PassportSection> : null}
    {profile.collab_intent ? <PassportSection title="Collaboration intent"><p className="text-sm font-semibold text-foreground">{label(profile.collab_intent)}</p></PassportSection> : null}
    {stats.length ? <PassportSection title="Passport record & reach"><dl className="grid grid-cols-3 gap-x-3 gap-y-3">{stats.map(([name, value]) => <div key={name} className="min-w-0">
      <dt className="text-[10px] leading-tight text-muted-foreground">{name}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value.toLocaleString()}</dd>
    </div>)}</dl></PassportSection> : null}
    {reasons.length ? <PassportSection title="Why Kreto suggested this person"><p className="text-xs leading-relaxed text-muted-foreground">{reasons[0].label}</p></PassportSection> : null}
    <p className="text-[10px] leading-relaxed text-muted-foreground">Only public Passport fields shared by this member are shown. Empty or private fields are never guessed.</p>
  </div>;

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
        backContent={fullPassport}
      />
    </div>
    <div className="mt-2 grid h-12 grid-cols-2 gap-2" role="group" aria-label="Discovery actions">
      <Button variant="outline" onClick={pass} disabled={locked} className="h-12 gap-2 rounded-full border-border bg-card px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5" aria-label="Pass">Pass</Button>
      <Button onClick={interested} disabled={locked} variant="outline" className="h-12 gap-2 rounded-full border-border bg-card px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5" aria-label="Connect"><Heart className="h-5 w-5 text-primary" aria-hidden /> Connect</Button>
    </div>
  </div>;
}
