import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Eye, IdCard } from "lucide-react";
import { Link } from "react-router-dom";
import { formatStatLine } from "@/lib/modelUnits";

interface CompApplicant {
  id: string;
  applicant_id: string;
  full_name: string;
  avatar_url?: string;
  status: string;
  comp_card_snapshot?: any;
}

interface Props {
  applicants: CompApplicant[];
  onStatusChange: (applicationId: string, newStatus: string) => void;
}

/**
 * Casting-grade comp-board: thumbnail-first grid of applicants with stats
 * and a one-tap shortlist toggle. Mounted above the standard pipeline
 * when opportunity.type === 'casting'.
 */
export function CompBoard({ applicants, onStatusChange }: Props) {
  if (!applicants.length) return null;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <IdCard className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Comp board</h3>
        <Badge variant="outline" className="text-[10px]">{applicants.length}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {applicants.map((a) => {
          const snap = a.comp_card_snapshot || {};
          const layout = snap.comp_card_layout;
          const hero =
            layout?.slots?.find?.((s: any) => s.slot_index === 0)?.image_url ||
            snap.avatar_url ||
            a.avatar_url;
          const stats = formatStatLine(snap.model_stats, "metric");
          const shortlisted = a.status === "shortlisted" || a.status === "accepted";

          return (
            <Card key={a.id} className="overflow-hidden">
              <div className="relative aspect-[5.5/8.5] bg-muted">
                {hero ? (
                  <img src={hero} alt={a.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={a.avatar_url} />
                      <AvatarFallback>{a.full_name[0]}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
                {shortlisted && (
                  <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="p-2 space-y-1.5">
                <p className="text-xs font-medium truncate">{a.full_name}</p>
                {stats && <p className="text-[10px] text-muted-foreground truncate">{stats}</p>}
                {snap.mother_agency && (
                  <p className="text-[10px] text-muted-foreground truncate">{snap.mother_agency}</p>
                )}
                <div className="flex gap-1 pt-0.5">
                  <Button asChild size="sm" variant="ghost" className="h-6 px-1.5 flex-1">
                    <Link to={`/comp/${a.applicant_id}`} target="_blank">
                      <Eye className="h-3 w-3" />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant={shortlisted ? "default" : "outline"}
                    className="h-6 px-2 flex-1 text-[10px]"
                    onClick={() =>
                      onStatusChange(a.id, shortlisted ? "pending" : "shortlisted")
                    }
                  >
                    {shortlisted ? "On list" : "Shortlist"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
