import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ExternalLink } from "lucide-react";

interface EventHost {
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  id_verified?: boolean | null;
  hostedCount?: number;
  avg_response_hours?: number | null;
}

interface EventHostCardProps {
  host: EventHost | null;
  isAuthenticated: boolean;
  onOpenPassport: (username: string) => void;
  onSignIn: () => void;
}

export function EventHostCard({ host, isAuthenticated, onOpenPassport, onSignIn }: EventHostCardProps) {
  const responseHours = host?.avg_response_hours;
  const responseLabel = typeof responseHours === "number" && Number.isFinite(responseHours) && responseHours >= 0
    ? responseHours < 1
      ? "Usually within an hour"
      : `Usually within ${Math.round(responseHours)} ${Math.round(responseHours) === 1 ? "hour" : "hours"}`
    : "Response time not listed";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Avatar className="h-14 w-14 ring-2 ring-primary/15">
          <AvatarImage src={host?.avatar_url || undefined} alt="" />
          <AvatarFallback>{host?.full_name?.trim().charAt(0) || "H"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hosted by</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{host?.full_name || "Event host"}</h3>
            {host?.id_verified && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
                Verified
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[host?.hostedCount ? `${host.hostedCount} ${host.hostedCount === 1 ? "event" : "events"} hosted` : null, responseLabel]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        {host?.username && (
          isAuthenticated ? (
            <Button variant="outline" className="shrink-0 gap-2" onClick={() => onOpenPassport(host.username!)}>
              Contact host <ExternalLink className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button variant="outline" className="shrink-0" onClick={onSignIn}>
              Sign in to contact
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
