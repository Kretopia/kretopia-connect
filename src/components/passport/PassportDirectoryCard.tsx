import { MessageCircle } from "lucide-react";
import { CardPill } from "@/components/cards/CardShell";
import { ProfileCard } from "./ProfileCard";

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

const Count = ({ value, label }: { value: number; label: string }) => (
  <CardPill><b className="tabular-nums">{value}</b><span>{label}</span></CardPill>
);

/**
 * One person in the Passport Directory: the profile card with their record. The whole card opens the Passport, a labelled primary action repeats
 * it, and Message is the one secondary. Counts are real rows, never a guess; a Passport with no cover wears a scene from the Kreto library.
 */
export function PassportDirectoryCard({ passport: p, credits, cosigns, isMe = false, onMessage }: PassportDirectoryCardProps) {
  const name = p.full_name || p.username || "Creative";
  const handle = p.username ? `@${p.username.replace(/^@/, "")}` : null;
  const href = isMe ? "/profile" : passportHref(p);
  const tier = p.verification_tier?.toLowerCase();
  return (
    <ProfileCard
      name={name}
      meta={[handle, p.role, p.location].filter(Boolean).map((part, i) => <span key={i}>{i > 0 ? " · " : ""}{part}</span>)}
      coverUrl={p.cover_image_url}
      avatarUrl={p.avatar_url}
      standing={tier ? STANDING_LABEL[tier] : null}
      badge={isMe ? <CardPill tone="origin">You</CardPill> : null}
      tags={[
        <Count key="credits" value={credits} label={credits === 1 ? "credit" : "credits"} />,
        <Count key="cosigns" value={cosigns} label={cosigns === 1 ? "co-sign" : "co-signs"} />,
        <Count key="level" value={p.level ?? 0} label="level" />,
      ]}
      open={{ to: href, ariaLabel: `Open ${isMe ? "your" : `${name}'s`} Passport` }}
      primary={{ label: isMe ? "Open my Passport" : "Open Passport", to: href }}
      secondary={isMe ? undefined : { icon: <MessageCircle className="h-4 w-4" aria-hidden />, label: `Message ${name}`, onClick: () => onMessage(p) }}
    />
  );
}

export default PassportDirectoryCard;
