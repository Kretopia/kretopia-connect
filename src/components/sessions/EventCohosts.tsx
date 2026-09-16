import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, X, Search, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Cohost {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface EventCohostsProps {
  eventId: string;
  isCreator: boolean;
}

export const EventCohosts = ({ eventId, isCreator }: EventCohostsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cohosts, setCohosts] = useState<Cohost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadCohosts();
  }, [eventId]);

  const loadCohosts = async () => {
    const { data, error } = await supabase
      .from('event_cohosts' as any)
      .select('id, user_id')
      .eq('event_id', eventId);

    if (error || !data || (data as any[]).length === 0) {
      setCohosts([]);
      setLoading(false);
      return;
    }

    const items = data as any[];
    const userIds = items.map((c: any) => c.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, role')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setCohosts(items.map((c: any) => {
      const profile = profileMap.get(c.user_id);
      return {
        id: c.id,
        user_id: c.user_id,
        full_name: profile?.full_name || 'Unknown',
        avatar_url: profile?.avatar_url || null,
        role: profile?.role || 'Creator',
      };
    }));
    setLoading(false);
  };

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);

    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, role')
      .ilike('full_name', `%${query}%`)
      .neq('user_id', user?.id || '')
      .limit(5);

    const existingIds = new Set(cohosts.map(c => c.user_id));
    setSearchResults((data || []).filter(p => !existingIds.has(p.user_id)));
    setSearching(false);
  };

  const addCohost = async (profile: any) => {
    if (!user) return;
    setAdding(true);

    const { error } = await supabase
      .from('event_cohosts' as any)
      .insert({
        event_id: eventId,
        user_id: profile.user_id,
        added_by: user.id,
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCohosts(prev => [...prev, {
        id: crypto.randomUUID(),
        user_id: profile.user_id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: profile.role || 'Creator',
      }]);
      setSearchQuery("");
      setSearchResults([]);
      toast({ title: "Co-host added!" });
    }
    setAdding(false);
  };

  const removeCohost = async (cohost: Cohost) => {
    const { error } = await supabase
      .from('event_cohosts' as any)
      .delete()
      .eq('id', cohost.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCohosts(prev => prev.filter(c => c.id !== cohost.id));
      toast({ title: "Co-host removed" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" /> Co-hosts
        </Label>
        {cohosts.length > 0 && (
          <Badge variant="secondary" className="text-xs">{cohosts.length}</Badge>
        )}
      </div>

      {/* Current co-hosts */}
      {cohosts.length > 0 && (
        <div className="space-y-2">
          {cohosts.map(cohost => (
            <div key={cohost.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
              <Avatar className="h-9 w-9">
                <AvatarImage src={cohost.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {cohost.full_name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cohost.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{cohost.role}</p>
              </div>
              {isCreator && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeCohost(cohost)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add co-host search */}
      {isCreator && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search creators to add as co-host..."
              value={searchQuery}
              onChange={e => searchUsers(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {searching && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="border rounded-lg divide-y overflow-hidden">
              {searchResults.map(profile => (
                <div key={profile.user_id} className="flex items-center gap-3 p-2.5 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback className="text-xs">{profile.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile.role || 'Creator'}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addCohost(profile)} disabled={adding}>
                    <UserPlus className="h-3 w-3" /> Add
                  </Button>
                </div>
              ))}
            </div>
          )}

          {cohosts.length === 0 && !searchQuery && (
            <p className="text-xs text-muted-foreground">Add co-hosts to credit them on this event</p>
          )}
        </div>
      )}
    </div>
  );
};
