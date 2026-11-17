import { useState, type ReactNode } from "react";
import { ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KretoScene } from "@/components/brand/KretoScene";
import { CardPill, CardShell, CardActionButton, CardIconButton, type CardAction, type CardIconAction, type CardTarget } from "@/components/cards/CardShell";

export interface ProfileCardProps {
  landscape?: boolean;
  portrait?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  backContent?: ReactNode;
  backActions?: ReactNode;
  testId?: string;
  name: string;
  /** One line under the name: handle, role, place. */
  meta?: ReactNode;
  coverUrl?: string | null;
  avatarUrl?: string | null;
  /** How far this person is verified, on the cover ("Verified", "Elite Verified"). */
  standing?: string | null;
  /** Another label on the cover ("You"). */
  badge?: ReactNode;
  bio?: string | null;
  /** Skills, or counts: three are drawn. */
  tags?: ReactNode[];
  /** Why this person is suggested, strongest first. A list on the front, nothing invented when there is none. */
  reasons?: Array<{ key: string; label: string }>;
  /** Where the name goes; the whole card is that target. */
  open: CardTarget;
  primary?: CardAction;
  secondary?: CardIconAction;
}

/**
 * A person, as the profile variant of CardShell: the cover (their picture, or Kreto's talent-search scene) with their avatar on it, their name,
 * one line about who and where they are, two lines of bio, three skills or counts, and the reasons they are suggested when there are any. Every
 * surface that shows a person (Browse, Likes you, the Passport directory) is this card; what differs is the action it offers.
 */
export function ProfileCard({ landscape, portrait, onFlipChange, backContent, backActions, testId, name, meta, coverUrl, avatarUrl, standing, badge, bio, tags, reasons, open, primary, secondary }: ProfileCardProps) {
  const [broken, setBroken] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = Array.from(new Set((portrait ? [avatarUrl, coverUrl] : [coverUrl]).filter((url): url is string => !!url)));
  const photo = photos[photoIndex % Math.max(photos.length, 1)];
  const showCover = !!photo && !broken;
  return (
    <CardShell
      landscape={landscape}
      portrait={portrait}
      className={portrait ? "k-match-card" : undefined}
      onFlipChange={onFlipChange}
      testId={testId}
      title={name}
      open={open}
      cover={
        <>
          {showCover ? <img src={photo} alt={portrait ? `${name}, photo ${photoIndex + 1}` : ""} loading={portrait ? "eager" : "lazy"} decoding="async" draggable={false} className="h-full w-full object-cover" onError={() => { if (photos.length > 1 && photoIndex === 0) setPhotoIndex(1); else setBroken(true); }} /> : <KretoScene scene="talent-search" size="thumb" className="h-full w-full" />}
          {portrait && photos.length > 1 ? <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-end gap-2">
            <Button variant="secondary" size="icon" className="h-11 w-11 rounded-full" aria-label="Previous photo" title="Previous photo" onClick={() => { setBroken(false); setPhotoIndex(i => (i + photos.length - 1) % photos.length); }}><ChevronLeft className="h-5 w-5" /></Button>
            <Button variant="secondary" size="icon" className="h-11 w-11 rounded-full" aria-label="Next photo" title="Next photo" onClick={() => { setBroken(false); setPhotoIndex(i => (i + 1) % photos.length); }}><ChevronRight className="h-5 w-5" /></Button>
          </div> : null}
          <Avatar className="absolute bottom-3 left-3 h-12 w-12 ring-2 ring-card">
            <AvatarImage src={avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </>
      }
      coverStart={
        <>
          {portrait ? <CardPill tone="origin">Kretopia · Passport</CardPill> : null}
          {standing ? <CardPill tone="origin"><ShieldCheck className="h-3 w-3" aria-hidden />{standing}</CardPill> : null}
          {badge}
        </>
      }
      coverControls={secondary ? <CardIconButton action={secondary} /> : undefined}
      meta={meta}
      description={bio}
      tags={tags}
      trust={
        reasons && reasons.length > 0 ? (
          <ul aria-label={`Why ${name} is suggested`} className="flex flex-wrap gap-1">
            {reasons.map((reason) => <li key={reason.key}><CardPill>{reason.label}</CardPill></li>)}
          </ul>
        ) : null
      }
      primary={primary}
      back={{
        label: "profile details",
        eyebrow: "Creative Passport",
        children: <>{bio && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">{bio}</p>}{tags?.length ? <div className="flex flex-wrap gap-2">{tags}</div> : null}{backContent}</>,
        actions: <><CardActionButton action={{ label: "View profile", ...open }} />{backActions}</>,
      }}
    />
  );
}
