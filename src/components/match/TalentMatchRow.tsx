import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardRow } from "@/components/cards/CardRow";
import { CardPill } from "@/components/cards/CardShell";

export interface TalentMatchSummary {
  user_id: string;
  full_name: string;
  role?: string | null;
  avatar_url?: string | null;
  location?: string | null;
  match_reasons?: string[] | null;
  headline?: string | null;
}

interface TalentMatchRowProps {
  talent: TalentMatchSummary;
  /** Kreto's order, 1 first. A model-made percentage is never shown: nothing behind it can be checked. */
  rank: number;
  shortlisted: boolean;
  saving: boolean;
  onViewPassport: () => void;
  onShortlist: () => void;
  onMessage: () => void;
}

/**
 * One of Kreto's matches for a brief, as a row of the shared card: their rank and picture, who they are and where, Kreto's one-line headline
 * and up to two reasons, and what to do next. The row opens their Passport; Shortlist keeps them, and once kept the action becomes Message.
 */
export function TalentMatchRow({ talent, rank, shortlisted, saving, onViewPassport, onShortlist, onMessage }: TalentMatchRowProps) {
  return (
    <CardRow
      testId={`talent-match-${talent.user_id}`}
      title={talent.full_name}
      open={{ to: `/profile/${talent.user_id}` }}
      lead={
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={talent.avatar_url ?? undefined} />
            <AvatarFallback>{talent.full_name?.[0] || "?"}</AvatarFallback>
          </Avatar>
        </div>
      }
      meta={[talent.role, talent.location].filter(Boolean).join(" · ") || null}
      description={talent.headline ? <>"{talent.headline}"</> : null}
      tags={(talent.match_reasons ?? []).slice(0, 2).map((reason, i) => <CardPill key={i}>{reason}</CardPill>)}
      secondary={{ label: "View Passport", onClick: onViewPassport }}
      primary={shortlisted ? { label: "Message", onClick: onMessage } : { label: "Shortlist", busy: saving, onClick: onShortlist }}
    />
  );
}
