import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { IdCard, Ruler } from "lucide-react";
import { formatStatLine, type ModelStats } from "@/lib/modelUnits";

interface Props {
  userId: string;
  isOwner?: boolean;
  stats?: ModelStats | null;
  motherAgency?: string | null;
  unions?: string[] | null;
  categories?: string[] | null;
}

/**
 * Casting-grade strip that surfaces a model's industry-essential info
 * directly on the public EPK. Renders only when the profile has model data.
 */
export function ModelStrip({ userId, isOwner, stats, motherAgency, unions, categories }: Props) {
  const statLine = formatStatLine(stats, "metric");
  const hasAny =
    statLine || motherAgency || (unions && unions.length) || (categories && categories.length);
  if (!hasAny && !isOwner) return null;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Model details
          </span>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`/comp/${userId}`} target="_blank">
            <IdCard className="h-3.5 w-3.5 mr-1.5" />
            Comp card
          </Link>
        </Button>
      </div>

      {statLine ? (
        <p className="text-sm font-medium leading-snug">{statLine}</p>
      ) : isOwner ? (
        <p className="text-sm text-muted-foreground">
          Add your stats so casting directors see them at a glance.{" "}
          <Link to="/passport/comp-card" className="text-primary underline">
            Set up
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {motherAgency ? (
          <Badge variant="secondary" className="text-[10px]">{motherAgency}</Badge>
        ) : null}
        {unions?.map((u) => (
          <Badge key={u} variant="outline" className="text-[10px]">{u}</Badge>
        ))}
        {categories?.map((c) => (
          <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
        ))}
      </div>
    </div>
  );
}
