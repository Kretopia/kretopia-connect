import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, CheckCircle2, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Collaborator {
  user_id: string | null;
  name: string;
  role: string;
  avatar_url?: string | null;
  verified: boolean;
}

interface RollCallProps {
  collaborators: Collaborator[];
  creditId: string;
}

export function RollCall({ collaborators, creditId }: RollCallProps) {
  const navigate = useNavigate();

  if (!collaborators.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Verified Roll Call
      </h4>
      <div className="space-y-1.5">
        {collaborators.map((c, i) => (
          <div
            key={`${c.user_id || i}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={c.avatar_url || ""} />
              <AvatarFallback className="text-[10px]">{(c.name || "?")[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{c.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{c.role}</p>
            </div>
            {c.user_id ? (
              <div className="flex items-center gap-1">
                {c.verified ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <button
                  onClick={() => navigate(`/profile/${c.user_id}`)}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  View
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => navigate(`/auth?redirect=/claim/${creditId}`)}
              >
                <UserPlus className="h-3 w-3" />
                Claim
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
