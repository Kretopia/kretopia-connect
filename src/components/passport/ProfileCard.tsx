import { useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KretoScene } from "@/components/brand/KretoScene";
import { CardPill, CardShell, type CardAction, type CardIconAction, type CardTarget } from "@/components/cards/CardShell";

export interface ProfileCardProps {
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
  primary: CardAction;
  secondary?: CardIconAction;
}

/**
 * A person, as the profile variant of CardShell: the cover (their picture, or Kreto's talent-search scene) with their avatar on it, their name,
 * one line about who and where they are, two lines of bio, three skills or counts, and the reasons they are suggested when there are any. Every
 * surface that shows a person (Browse, Likes you, the Passport directory) is this card; what differs is the action it offers.
 */
export function ProfileCard({ testId, name, meta, coverUrl, avatarUrl, standing, badge, bio, tags, reasons, open, primary, secondary }: ProfileCardProps) {
  const [broken, setBroken] = useState(false);
  const showCover = !!coverUrl && !broken;
  return (
    <CardShell
      testId={testId}
      title={name}
      stretch
      open={open}
      cover={
        <>
          {showCover ? <img src={coverUrl!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : <KretoScene scene="talent-search" size="thumb" className="h-full w-full" />}
          <Avatar className="absolute bottom-3 left-3 h-12 w-12 ring-2 ring-card">
            <AvatarImage src={avatarUrl ?? undefined} alt="" />
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </>
      }
      coverStart={
        <>
          {standing ? <CardPill tone="origin"><ShieldCheck className="h-3 w-3" aria-hidden />{standing}</CardPill> : null}
          {badge}
        </>
      }
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
      secondary={secondary}
    />
  );
}
