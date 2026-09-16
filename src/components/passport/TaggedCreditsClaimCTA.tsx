import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fingerprint, ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brandLexicon";

interface Props {
  /** Count of unclaimed `discovered_credits` rows for the user. */
  taggedCount: number;
  /** Where the claim CTA goes. */
  to?: string;
}

/**
 * TaggedCreditsClaimCTA — the "tagged-but-unclaimed" wedge.
 *
 * Surfaces in-context whenever a user has discovered_credits awaiting their
 * approval. The strongest pull-hook: their name is *already* on the record;
 * they just need to claim it.
 */
export const TaggedCreditsClaimCTA = ({ taggedCount, to = "/profile?tab=discoveries" }: Props) => {
  if (!taggedCount || taggedCount < 1) return null;

  return (
    <Card className="relative overflow-hidden border-amber-500/40 bg-amber-500/[0.04]">
      <div className="p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-amber-500 font-bold">
            You're already on the record
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            Your name appears in {taggedCount} credit{taggedCount === 1 ? "" : "s"} — claim {taggedCount === 1 ? "it" : "them"} for your {BRAND.passport}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Verified credits build your standing, your co-signs, and your access to gated Calls.
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 bg-amber-500 text-black hover:bg-amber-500/90"
        >
          <Link to={to}>
            Claim <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </Card>
  );
};

export default TaggedCreditsClaimCTA;
