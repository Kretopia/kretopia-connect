import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowRight, UserX, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { DegreeBadge } from "./DegreeBadge";
import { cn } from "@/lib/utils";

interface SearchResult {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

interface ConnectionPath {
  degree: number;
  path_user_ids: string[];
  path_user_names: string[];
}

interface PathProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface PathFinderProps {
  className?: string;
}

export function PathFinder({ className }: PathFinderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [pathData, setPathData] = useState<ConnectionPath | null>(null);
  const [pathProfiles, setPathProfiles] = useState<PathProfile[]>([]);
  const [loadingPath, setLoadingPath] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || query.length < 2) return;
    
    setSearching(true);
    setSelectedUser(null);
    setPathData(null);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role')
        .neq('user_id', user?.id || '')
        .ilike('full_name', `%${query}%`)
        .limit(10);

      if (error) {
        console.error('[PathFinder] Search error:', error);
        return;
      }

      setSearchResults(data || []);
    } catch (err) {
      console.error('[PathFinder] Error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = async (selectedProfile: SearchResult) => {
    if (!user?.id) return;
    
    setSelectedUser(selectedProfile);
    setLoadingPath(true);
    setSearchResults([]);
    
    try {
      const { data, error } = await supabase.rpc('get_connection_path', {
        from_user_id: user.id,
        to_user_id: selectedProfile.user_id
      });

      if (error) {
        console.error('[PathFinder] Path error:', error);
        setPathData(null);
        return;
      }

      if (data && data.length > 0) {
        const result = data[0] as ConnectionPath;
        setPathData(result);
        
        // Fetch profiles for the path
        if (result.path_user_ids && result.path_user_ids.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', result.path_user_ids);
          
          // Order profiles by path order
          const orderedProfiles = result.path_user_ids.map(id => {
            const profile = profiles?.find(p => p.user_id === id);
            return profile || { user_id: id, full_name: 'Unknown', avatar_url: null };
          });
          
          setPathProfiles(orderedProfiles);
        }
      } else {
        setPathData(null);
        setPathProfiles([]);
      }
    } catch (err) {
      console.error('[PathFinder] Error:', err);
    } finally {
      setLoadingPath(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleViewProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const resetSearch = () => {
    setQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    setPathData(null);
    setPathProfiles([]);
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Compass className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Find Connection Path</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Search for any creator to see how you're connected
      </p>

      {/* Search Input */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={searching || query.length < 2}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Results */}
      {searching && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && searchResults.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {searchResults.map((profile) => (
            <button
              key={profile.user_id}
              onClick={() => handleSelectUser(profile)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{profile.full_name?.charAt(0) || '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{profile.full_name}</p>
                {profile.role && (
                  <p className="text-xs text-muted-foreground">{profile.role}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Path Visualization */}
      {selectedUser && (
        <div className="mt-4 pt-4 border-t">
          {loadingPath ? (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>
          ) : pathData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DegreeBadge degree={pathData.degree} size="md" />
                  <span className="text-sm text-muted-foreground">
                    {pathData.degree === 1 && "Direct connection"}
                    {pathData.degree === 2 && "Connected through 1 person"}
                    {pathData.degree === 3 && "Connected through 2 people"}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={resetSearch}>
                  New Search
                </Button>
              </div>

              {/* Visual Path */}
              <div className="flex items-center justify-center gap-1 py-4 overflow-x-auto">
                {pathProfiles.map((profile, index) => (
                  <div key={profile.user_id} className="flex items-center">
                    <button
                      onClick={() => handleViewProfile(profile.user_id)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar className={cn(
                        "border-2",
                        index === 0 ? "border-primary h-12 w-12" : 
                        index === pathProfiles.length - 1 ? "border-accent h-12 w-12" :
                        "border-muted-foreground/30 h-10 w-10"
                      )}>
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {profile.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground max-w-[60px] truncate">
                        {index === 0 ? "You" : profile.full_name?.split(' ')[0]}
                      </span>
                    </button>
                    {index < pathProfiles.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <UserX className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">{selectedUser.full_name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Not in your network yet
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Connect with more creators to expand your reach
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => handleViewProfile(selectedUser.user_id)}
              >
                View Profile
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
