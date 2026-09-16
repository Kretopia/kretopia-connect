import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Person {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface LivePresencePileProps {
  collaborators: Person[];
  onlineUserIds: Set<string>;
  currentUserId: string;
  max?: number;
  className?: string;
}

/**
 * Compact face-pile for the VibeHeader. Renders avatars of currently-online
 * collaborators (excluding the viewer) with a pulsing energy ring so the room
 * feels alive the moment someone joins.
 */
export const LivePresencePile = ({
  collaborators,
  onlineUserIds,
  currentUserId,
  max = 4,
  className,
}: LivePresencePileProps) => {
  const online = collaborators.filter(
    (c) => c.id !== currentUserId && onlineUserIds.has(c.id),
  );

  if (online.length === 0) return null;

  const visible = online.slice(0, max);
  const overflow = online.length - visible.length;
  const firstName = (n: string) => n.split(" ")[0];
  const label =
    online.length === 1
      ? `${firstName(online[0].full_name)} is here`
      : online.length === 2
        ? `${firstName(online[0].full_name)} & ${firstName(online[1].full_name)} are here`
        : `${online.length} in the room`;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-card/85 backdrop-blur-sm",
        "ring-1 ring-[hsl(var(--energy)/0.4)] pl-1.5 pr-3 py-1",
        "shadow-[0_0_12px_hsl(var(--energy)/0.25)]",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--energy))] opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--energy))]" />
      </span>

      <div className="flex -space-x-2">
        {visible.map((p) => (
          <Avatar
            key={p.id}
            className="h-6 w-6 ring-2 ring-background"
            title={`${p.full_name} is online`}
          >
            <AvatarImage src={p.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] font-bold">
              {p.full_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
        {overflow > 0 && (
          <span className="h-6 w-6 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center ring-2 ring-background text-muted-foreground">
            +{overflow}
          </span>
        )}
      </div>

      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--energy))]">
        {label}
      </span>
    </div>
  );
};
