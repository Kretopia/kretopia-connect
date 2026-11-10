import { CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { hostContactLinks, type EventHost } from "@/lib/eventHostLinks";

interface EventHostBlockProps {
  host: EventHost | null;
  /** The viewer is the host: there is nobody to contact. */
  isHost: boolean;
  isAuthenticated: boolean;
  /** Opens the host's public Passport, where messaging is gated by the Passport itself. */
  onContact: () => void;
  onSignIn: () => void;
}

/**
 * Who hosts the event, once: identity, verified state and "Contact host". Contacting needs an account (a visitor is sent to sign in), and
 * the host's own public channels, when they shared any, sit in the same menu instead of in a second card. The host sees no contact control
 * (there is nobody to contact); the booking control already says "You're hosting".
 */
export function EventHostBlock({ host, isHost, isAuthenticated, onContact, onSignIn }: EventHostBlockProps) {
  const name = host?.full_name || "Event host";
  const channels = hostContactLinks(host);
  const hosted = host?.hostedCount ? `${host.hostedCount} ${host.hostedCount === 1 ? "event" : "events"} hosted` : null;

  return (
    <div id="host" aria-labelledby="event-host-name" role="group" className="scroll-mt-24 space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-primary/15">
          <AvatarImage src={host?.avatar_url || undefined} alt="" />
          <AvatarFallback>{name.trim().charAt(0).toUpperCase() || "H"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hosted by</p>
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            <span id="event-host-name" className="truncate">{name}</span>
            {host?.id_verified && <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-label="Verified host" />}
          </p>
          {hosted && <p className="text-xs text-muted-foreground">{hosted}</p>}
        </div>
      </div>
      {isHost ? null : !isAuthenticated ? (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onSignIn}>Contact host</Button>
      ) : channels.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full">Contact host</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={onContact}>Message on Kretopia</DropdownMenuItem>
            {channels.map(({ label, url }) => (
              <DropdownMenuItem key={label} asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open host ${label}`}>{label}</a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onContact}>Contact host</Button>
      )}
    </div>
  );
}

export default EventHostBlock;
