import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Camera, Sparkles } from "lucide-react";
import { CreatorListItem, type NearbyCreator, formatDistance, getSkills } from "./NearbyCreatorCard";
import { SessionListItem, type NearbySession } from "./NearbySessionListItem";
import { SessionCard } from "@/components/sessions/SessionCard";
import { LocationListItem, type CreativeLocation } from "./LocationListItem";
import type { AtlasFilter } from "./AtlasFilterTabs";

interface NearbySidebarProps {
  creators: NearbyCreator[];
  sessions: NearbySession[];
  locations: CreativeLocation[];
  atlasFilter: AtlasFilter;
  loading: boolean;
  selectedItem: { type: string; id: string } | null;
  onSelectCreator: (id: string) => void;
  onSelectSession: (session: NearbySession) => void;
  onSelectLocation: (loc: CreativeLocation) => void;
  onViewProfile: (userId: string) => void;
  onCreateSession: () => void;
  onAddLocation: () => void;
  onSeedLocations: () => void;
  onRefresh: () => void;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (id: string) => void;
}

export const NearbySidebar = ({
  creators, sessions, locations, atlasFilter, loading,
  selectedItem, onSelectCreator, onSelectSession, onSelectLocation,
  onViewProfile, onCreateSession, onAddLocation, onSeedLocations, onRefresh,
  bookmarkedIds, onToggleBookmark,
}: NearbySidebarProps) => (
  <div className="space-y-4">
    {/* Action Buttons */}
    <div className="flex gap-2">
      <Button className="flex-1" variant="gradient" onClick={onCreateSession}>
        <Plus className="h-4 w-4 mr-1" />Host Session
      </Button>
      <Button className="flex-1" variant="outline" onClick={onAddLocation}>
        <Camera className="h-4 w-4 mr-1" />Pin a Spot
      </Button>
      <Button variant="outline" size="icon" onClick={onSeedLocations} title="Discover Spots">
        <Sparkles className="h-4 w-4" />
      </Button>
    </div>

    {/* Creators */}
    {creators.length > 0 && (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-primary/60" />
          <h3 className="font-semibold text-sm">{creators.length} Creators</h3>
        </div>
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            creators.slice(0, 10).map((c) => (
              <CreatorListItem
                key={c.user_id}
                creator={c}
                isSelected={selectedItem?.type === 'creator' && selectedItem?.id === c.user_id}
                onClick={() => onSelectCreator(c.user_id)}
                onViewProfile={onViewProfile}
              />
            ))
          )}
        </div>
      </div>
    )}

    {/* Sessions */}
    {(atlasFilter === 'all' || atlasFilter === 'sessions') && (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <h3 className="font-semibold text-sm">{sessions.length} Sessions</h3>
        </div>
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : sessions.length === 0 ? (
            <Card className="p-3">
              <p className="text-xs text-muted-foreground text-center mb-2">No sessions nearby</p>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={onCreateSession}>
                <Sparkles className="h-3 w-3 mr-1" />Be the first to host
              </Button>
            </Card>
          ) : (
            sessions.map((s) => (
              <SessionListItem
                key={s.id}
                session={s}
                isSelected={selectedItem?.type === 'session' && selectedItem?.id === s.id}
                onClick={() => onSelectSession(s)}
                formatDistance={formatDistance}
              />
            ))
          )}
        </div>
      </div>
    )}

    {/* Locations */}
    {(atlasFilter !== 'creators' && atlasFilter !== 'sessions') && (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm"></span>
          <h3 className="font-semibold text-sm">{locations.length} Spots</h3>
        </div>
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {locations.length === 0 ? (
            <Card className="p-3">
              <p className="text-xs text-muted-foreground text-center mb-2">No creative spots pinned nearby</p>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={onAddLocation}>
                <Camera className="h-3 w-3 mr-1" />Pin the first spot
              </Button>
            </Card>
          ) : (
            locations.slice(0, 10).map((loc) => (
              <LocationListItem
                key={loc.id}
                location={loc}
                isSelected={selectedItem?.type === 'location' && selectedItem?.id === loc.id}
                onClick={() => onSelectLocation(loc)}
                formatDistance={formatDistance}
                isBookmarked={bookmarkedIds.has(loc.id)}
                onToggleBookmark={() => onToggleBookmark(loc.id)}
              />
            ))
          )}
        </div>
      </div>
    )}
  </div>
);
