import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShieldOff, Loader2 } from "lucide-react";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BlockedProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export const BlockedUsersCard = () => {
  const { blockedIds, loading, unblockUser } = useUserBlocks();
  const [profiles, setProfiles] = useState<BlockedProfile[]>([]);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const ids = Array.from(blockedIds);
    if (ids.length === 0) {
      setProfiles([]);
      return;
    }
    setFetching(true);
    supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, username")
      .in("user_id", ids)
      .then(({ data }) => {
        setProfiles((data as BlockedProfile[]) || []);
        setFetching(false);
      });
  }, [blockedIds]);

  const handleUnblock = async (userId: string, name: string | null) => {
    const ok = await unblockUser(userId);
    if (ok) toast({ title: `Unblocked ${name || "user"}` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          Blocked Users
        </CardTitle>
        <CardDescription>Manage who can't see or contact you</CardDescription>
      </CardHeader>
      <CardContent>
        {loading || fetching ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">You haven't blocked anyone.</p>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between gap-3 rounded-lg border p-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback>{(p.full_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.full_name || "Unnamed"}</p>
                    {p.username && <p className="text-xs text-muted-foreground truncate">@{p.username}</p>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleUnblock(p.user_id, p.full_name)}>
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
