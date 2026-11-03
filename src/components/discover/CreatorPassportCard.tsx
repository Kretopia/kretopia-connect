import { X } from "lucide-react";
import { CardPill } from "@/components/cards/CardShell";
import { ProfileCard } from "@/components/passport/ProfileCard";
import { extractSkillsArray } from "@/lib/matchScoring";
import type { MatchReason } from "@/lib/matchReasons";

export interface CreatorCardProfile {
  full_name: string | null; role: string | null; avatar_url: string | null;
  cover_image_url?: string | null; location: string | null; bio?: string | null;
  professional_skills?: unknown; verification_tier?: string | null; average_rating?: number | null;
  collab_intent?: string | null; match_reasons?: MatchReason[];
}

const INTENT: Record<string, string> = { looking_to_hire: "Looking to hire", available_for_hire: "Available for hire", open_to_trade: "Open to trade", seeking_collaborators: "Seeking collaborators", networking: "Open to networking" };

/** What a surface can ask of a person's card besides opening it: a reply to someone who liked them (Match) and a way to pass. */
export interface CreatorCardReply { onMatch: () => void; onPass: () => void; busy?: boolean }

/** A creator in Browse or Likes you: the profile card with real creator fields, opening their Passport. */
export function CreatorPassportCard({ profile: p, onOpen, reply }: { profile: CreatorCardProfile; onOpen: () => void; reply?: CreatorCardReply }) {
  const name = p.full_name || "Creator";
  const intent = p.collab_intent && INTENT[p.collab_intent] ? INTENT[p.collab_intent] : null;
  const standing = p.verification_tier && p.verification_tier !== "none" ? "Verified" : null;
  return (
    <ProfileCard
      name={name}
      meta={[p.role || "Creator", p.location].filter(Boolean).join(" · ")}
      coverUrl={p.cover_image_url}
      avatarUrl={p.avatar_url}
      standing={standing}
      badge={intent ? <CardPill>{intent}</CardPill> : null}
      bio={p.bio}
      tags={extractSkillsArray(p.professional_skills).map((skill) => <CardPill key={skill}>{skill}</CardPill>)}
      reasons={p.match_reasons}
      open={{ onClick: onOpen }}
      primary={reply ? { label: "Match", onClick: reply.onMatch, disabled: reply.busy } : { label: "View Passport", onClick: onOpen, ariaLabel: `View Passport — ${name}` }}
      secondary={reply ? { icon: <X className="h-4 w-4" aria-hidden />, label: "Pass", onClick: reply.onPass, disabled: reply.busy } : undefined}
    />
  );
}

