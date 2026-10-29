import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { InviteCircleCard } from "@/components/InviteCircleCard";
import { InviteDialog } from "@/components/InviteDialog";
import { ConnectionList } from "@/components/circle/ConnectionList";
import { NetworkVisualization } from "@/components/circle/NetworkVisualization";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ConnectedProfile = {
  user_id: string;
  full_name: string;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  badge: string;
  level: number;
};

/**
 * The people the viewer has accepted connections with, and the way back into the conversation with each of them.
 * Both directions of a connection count once it is accepted; a pending or declined row is not a collaborator. Messaging
 * opens the canonical thread (/messages?user=), which is where every other surface continues a conversation.
 * A failed read says so and offers a retry: it is never shown as "you have no connections".
 */
export function ConnectedCollaborators() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<ConnectedProfile[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setState("loading");
    try {
      const [outgoing, incoming] = await Promise.all([
        supabase.from("connections").select("connected_user_id, status").eq("user_id", user.id),
        supabase.from("connections").select("user_id, status").eq("connected_user_id", user.id),
      ]);
      if (outgoing.error || incoming.error) throw outgoing.error ?? incoming.error;
      const ids = new Set<string>();
      outgoing.data?.forEach((c) => { if (c.status === "accepted") ids.add(c.connected_user_id); });
      incoming.data?.forEach((c) => { if (c.status === "accepted") ids.add(c.user_id); });
      if (ids.size === 0) {
        setConnections([]);
        setState("ready");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role, location, level, xp, bio, badge")
        .in("user_id", Array.from(ids));
      if (error) throw error;
      setConnections((data ?? []) as ConnectedProfile[]);
      setState("ready");
    } catch (e) {
      console.error("[ConnectedCollaborators]", e);
      setState("error");
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        <Link to="/auth" className="underline">Sign in</Link> to see the people you have connected with.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state === "loading" && <div className="flex justify-center py-10"><KretopiaLoader label="Loading your connections" size="sm" /></div>}
      {state === "error" && (
        <div className="space-y-2 py-6 text-center" role="alert">
          <p className="text-sm text-destructive">Your connections could not be loaded.</p>
          <Button type="button" variant="outline" onClick={load} className="min-h-11">Try again</Button>
        </div>
      )}
      {state === "ready" && (
        <>
          {connections.length === 0 && <InviteCircleCard variant="match" />}
          <NetworkVisualization onInvite={() => setShowInvite(true)} />
          {connections.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold">Your collaborators</h3>
              <ConnectionList connections={connections} loading={false} onMessage={(id) => navigate(`/messages?user=${id}`)} />
            </div>
          )}
        </>
      )}
      <InviteDialog open={showInvite} onOpenChange={setShowInvite} />
    </div>
  );
}
