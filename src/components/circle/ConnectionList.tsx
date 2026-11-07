import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CardPill } from "@/components/cards/CardShell";
import { CARD_COVER_RATIO, CARD_RADIUS } from "@/components/cards/cardTokens";
import { ProfileCard } from "@/components/passport/ProfileCard";
import { NetworkVisualization } from "./NetworkVisualization";
import { InviteDialog } from "@/components/InviteDialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Connection {
  user_id: string;
  full_name: string;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url?: string | null;
  location: string | null;
  badge: string;
  level: number;
}

interface ConnectionListProps {
  connections: Connection[];
  loading: boolean;
  onMessage: (userId: string) => void;
}

interface RecentCredit {
  project_name: string;
  role: string;
}

/**
 * The people the viewer is connected with, each as the shared profile card (the same one Browse, Interested and the Passport directory draw):
 * who they are and where, their most recent credit, and the one thing to do next, which is to message them. The whole card opens their
 * Passport; the button opens the conversation. What a connection is, and who counts as one, is decided by ConnectedCollaborators.
 */
export const ConnectionList = ({ connections, loading, onMessage }: ConnectionListProps) => {
  const [showInvite, setShowInvite] = useState(false);
  const [recentCredits, setRecentCredits] = useState<Record<string, RecentCredit>>({});
  const navigate = useNavigate();

  // Fetch most recent credit for each connection
  useEffect(() => {
    if (connections.length === 0) return;
    const userIds = connections.map(c => c.user_id);

    supabase
      .from("credits")
      .select("user_id, project_name, role")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, RecentCredit> = {};
        for (const credit of data) {
          if (!map[credit.user_id]) {
            map[credit.user_id] = { project_name: credit.project_name, role: credit.role };
          }
        }
        setRecentCredits(map);
      });
  }, [connections]);

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {[...Array(3)].map((_, i) => (
          <div key={i} className={cn("animate-pulse overflow-hidden border border-border bg-card", CARD_RADIUS)}>
            <div className={cn("bg-muted", CARD_COVER_RATIO)} />
            <div className="space-y-2 p-5">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-48 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <>
        <NetworkVisualization onInvite={() => setShowInvite(true)} />
        <InviteDialog open={showInvite} onOpenChange={setShowInvite} />
      </>
    );
  }

  return (
    <ul aria-label="Your collaborators" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {connections.map((connection) => {
        const credit = recentCredits[connection.user_id];
        return (
          <li key={connection.user_id} className="min-w-0">
            <ProfileCard
              testId={`connection-${connection.user_id}`}
              name={connection.full_name}
              meta={[connection.role, connection.location].filter(Boolean).join(" · ")}
              coverUrl={connection.cover_image_url}
              avatarUrl={connection.avatar_url}
              badge={connection.badge ? <CardPill>{connection.badge.toUpperCase()}</CardPill> : null}
              bio={connection.bio}
              tags={credit ? [<CardPill key="recent-credit">{credit.role} on {credit.project_name}</CardPill>] : []}
              open={{ onClick: () => navigate(`/profile/${connection.user_id}`), ariaLabel: `View ${connection.full_name}'s Passport` }}
              primary={{ label: "Message", onClick: () => onMessage(connection.user_id), ariaLabel: `Message ${connection.full_name}` }}
            />
          </li>
        );
      })}
    </ul>
  );
};
