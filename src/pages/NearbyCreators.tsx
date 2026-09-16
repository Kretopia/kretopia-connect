import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Navigation, Users, Plus, Sparkles, List, Map, Search, SlidersHorizontal, RefreshCw, Share2 } from "lucide-react";
import { InviteDialog } from "@/components/InviteDialog";
import { UnifiedNearbyMap, type MapItemType } from "@/components/nearby/UnifiedNearbyMap";
import { CreateSessionDialog } from "@/components/sessions/CreateSessionDialog";
import { SessionCard } from "@/components/sessions/SessionCard";
import { SessionDetailDialog } from "@/components/sessions/SessionDetailDialog";
import { type LocationPrecision } from "@/components/nearby/LocationPrivacySelect";
import { ProfileVisibilityBanner } from "@/components/ProfileVisibilityBanner";
import { AddCreativeLocationDialog } from "@/components/nearby/AddCreativeLocationDialog";
import { type CreativeLocation } from "@/components/nearby/LocationListItem";
import { LocationDetailDialog } from "@/components/nearby/LocationDetailDialog";
import { AtlasFilterTabs, type AtlasFilter } from "@/components/nearby/AtlasFilterTabs";
import { useLocationBookmarks } from "@/hooks/useLocationBookmarks";
import { SeedLocationsDialog } from "@/components/nearby/SeedLocationsDialog";
import { analytics } from "@/lib/analytics";
import Events from "@/pages/Events";
import { NearbyCreator, CreatorCard, formatDistance } from "@/components/nearby/NearbyCreatorCard";
import { NearbySession } from "@/components/nearby/NearbySessionListItem";
import { LocationListItem } from "@/components/nearby/LocationListItem";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConnectedUsers } from "@/hooks/useConnectedUsers";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { BrowseCreators } from "@/components/discover/BrowseCreators";


const NearbyCreators = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [creators, setCreators] = useState<NearbyCreator[]>([]);
  const [sessions, setSessions] = useState<NearbySession[]>([]);
  const [locations, setLocations] = useState<CreativeLocation[]>([]);
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(25);
  const [locationVisible, setLocationVisible] = useState(true);
  const [locationPrecision, setLocationPrecision] = useState<LocationPrecision>('approximate');
  const [selectedItem, setSelectedItem] = useState<{ type: MapItemType; id: string } | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [selectedSession, setSelectedSession] = useState<NearbySession | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CreativeLocation | null>(null);
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [atlasFilter, setAtlasFilter] = useState<AtlasFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [discoverMode, setDiscoverMode] = useState<'nearby' | 'browse'>('nearby');
  const [cityName, setCityName] = useState<string>("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const { bookmarkedIds, toggleBookmark } = useLocationBookmarks();
  const { connectedIds, isConnected } = useConnectedUsers();
  const { isBlocked, refetch: refetchBlocks } = useUserBlocks();

  useEffect(() => {
    analytics.pageView("nearby-creators");
    analytics.featureUsed("nearby_creators_opened");
  }, []);

  // Load preferences
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from('profiles').select('location_visible, location_precision, latitude, longitude, location').eq('user_id', user.id).single();
      if (data) {
        setLocationVisible(data.location_visible ?? true);
        setLocationPrecision((data.location_precision as LocationPrecision) ?? 'approximate');
        if (data.latitude && data.longitude) setUserLocation({ lat: data.latitude, lng: data.longitude });
        if ((data as any).location) setCityName(String((data as any).location).split(',')[0].trim());
      }
    };
    load().catch(err => console.warn('[NearbyCreators] profile prefs load failed:', err));
  }, [user]);

  const detectLocation = useCallback(async () => {
    setLocating(true);
    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");
      const getPos = (highAcc: boolean, timeout: number): Promise<GeolocationPosition> =>
        new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: highAcc, timeout, maximumAge: 300000 }));
      
      let position: GeolocationPosition;
      try { position = await getPos(true, 30000); } catch { position = await getPos(false, 20000); }
      
      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      
      if (user) {
        const { error } = await supabase.rpc('update_my_location', { lat: latitude, lon: longitude });
        if (error) { toast({ title: "Failed to save location", description: error.message, variant: "destructive" }); return; }
      }
      toast({ title: "Location updated", description: "Your location has been updated successfully" });
    } catch (error: any) {
      let msg = "Please enable location services to find nearby creators";
      if (error.code === 1) msg = "Location permission denied. Please allow location access in your browser settings.";
      else if (error.code === 2) msg = "Location unavailable. Please check your device's location settings.";
      else if (error.code === 3) msg = "Location request timed out. Please try again.";
      toast({ title: "Location access denied", description: msg, variant: "destructive" });
    } finally { setLocating(false); }
  }, [user, toast]);

  const fetchNearbyData = useCallback(async () => {
    if (!userLocation) { setLoading(false); return; }
    setLoading(true);
    try {
      const [cr, sr, lr] = await Promise.all([
        supabase.rpc('get_nearby_creators', { user_lat: userLocation.lat, user_lon: userLocation.lng, radius_km: radius, limit_count: 50 }),
        supabase.rpc('get_nearby_jams', { user_lat: userLocation.lat, user_lon: userLocation.lng, radius_km: radius, limit_count: 20 }),
        supabase.rpc('get_nearby_locations', { user_lat: userLocation.lat, user_lon: userLocation.lng, radius_km: radius, limit_count: 50 }),
      ]);
      if (cr.error) throw cr.error;
      if (sr.error) throw sr.error;
      setCreators(cr.data || []);
      setSessions((sr.data || []) as NearbySession[]);
      setLocations((lr.data || []) as CreativeLocation[]);
    } catch (error: any) {
      toast({ title: "Error loading nearby data", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [userLocation, radius, toast]);

  useEffect(() => { if (userLocation) fetchNearbyData(); }, [userLocation, radius, fetchNearbyData]);

  const toggleVisibility = async () => {
    if (!user) return;
    const newVal = !locationVisible;
    setLocationVisible(newVal);
    await supabase.from('profiles').update({ location_visible: newVal }).eq('user_id', user.id);
    toast({ title: newVal ? "Location visible" : "Location hidden" });
  };

  const handleViewProfile = (userId: string) => navigate(`/profile/${userId}`);
  const handleMessage = async (userId: string) => {
    const { data } = await supabase.from('matches').select('id')
      .or(`user1_id.eq.${user?.id},user2_id.eq.${user?.id}`)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`).single();
    navigate(data ? `/messages?match=${data.id}` : `/profile/${userId}`);
  };

  // Simplified filtering — exclude blocked users
  const filteredCreators = useMemo(() => {
    if (atlasFilter !== 'all' && atlasFilter !== 'creators') return [];
    let r = creators.filter(c => !isBlocked(c.user_id));
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter(c => c.full_name?.toLowerCase().includes(q) || c.role?.toLowerCase().includes(q)); }
    return r;
  }, [atlasFilter, creators, searchQuery, isBlocked]);

  const filteredSessions = useMemo(() => {
    if (atlasFilter !== 'all' && atlasFilter !== 'sessions') return [];
    const now = Date.now();
    // Hide events that have already started (>2h ago) or are at capacity
    let r = sessions.filter(s => {
      const startMs = new Date(s.start_time).getTime();
      const isPast = startMs < now - 2 * 60 * 60 * 1000;
      const isFull = s.max_participants > 0 && s.participant_count >= s.max_participants;
      return !isPast && !isFull;
    });
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter(s => s.title?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)); }
    return r;
  }, [atlasFilter, sessions, searchQuery]);

  const filteredLocations = useMemo(() => {
    let r = locations;
    if (atlasFilter === 'bookmarked') r = r.filter(l => bookmarkedIds.has(l.id));
    else if (atlasFilter !== 'all' && atlasFilter !== 'spots') return [];
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter(l => l.name?.toLowerCase().includes(q) || l.address?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q)); }
    return r.sort((a, b) => a.distance_km - b.distance_km);
  }, [atlasFilter, locations, bookmarkedIds, searchQuery]);

  const totalResults = filteredCreators.length + filteredSessions.length + filteredLocations.length;

  return (
    <div className="min-h-screen pb-24 md:pb-6">
      {/* Clean sticky header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border/60">
        <div className="px-3 py-2.5 sm:px-4 space-y-2">
          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-energy shadow-glow-lime animate-pulse" />
              </div>
              <h1 className="text-xl font-black tracking-[-0.03em] truncate">Discover</h1>
              {userLocation && discoverMode === 'nearby' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-sm bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))] border-[hsl(var(--energy)/0.35)] whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))]" />
                  {totalResults} nearby
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 shrink-0">
              <button
                onClick={() => setDiscoverMode('nearby')}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${discoverMode === 'nearby' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              >Nearby</button>
              <button
                onClick={() => setDiscoverMode('browse')}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${discoverMode === 'browse' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
              >Browse</button>
            </div>
          </div>

          {/* Nearby-only header controls */}
          {discoverMode === 'nearby' && (
            <div className="flex items-center justify-end gap-1.5">
              {userLocation && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewMode(v => v === 'map' ? 'list' : 'map')}>
                    {viewMode === 'map' ? <List className="h-4 w-4" /> : <Map className="h-4 w-4" />}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-4" align="end">
                      <div>
                        <Label className="text-xs mb-2 block">Radius: {radius}km</Label>
                        <Slider value={[radius]} onValueChange={(v) => setRadius(v[0])} min={5} max={100} step={5} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Show me on map</Label>
                        <Switch checked={locationVisible} onCheckedChange={toggleVisibility} />
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={fetchNearbyData} disabled={loading}>
                        <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
                      </Button>
                    </PopoverContent>
                  </Popover>
                </>
              )}
              <Button onClick={detectLocation} disabled={locating} variant="gradient" size="sm" className="h-8 text-xs px-3">
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                <span className="ml-1.5 hidden xs:inline">{userLocation ? 'Update' : 'Locate'}</span>
              </Button>
            </div>
          )}

          {/* Search + filters (Nearby mode only) */}
          {discoverMode === 'nearby' && userLocation && (
            <>
              <div className="relative">
                <Search
                  aria-hidden
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                  style={{ color: "hsl(var(--energy))" }}
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search creators, events, studios..."
                  className="pl-9 h-9 text-xs rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm focus-visible:border-primary"
                />
              </div>
              <div className="overflow-x-auto -mx-3 px-3 scrollbar-hide">
                <AtlasFilterTabs active={atlasFilter} onChange={setAtlasFilter} counts={{
                  creators: creators.length,
                  sessions: sessions.length,
                  spots: locations.length,
                  bookmarked: locations.filter(l => bookmarkedIds.has(l.id)).length,
                }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-4 py-3 space-y-3 max-w-7xl mx-auto">
        {discoverMode === 'browse' ? (
          <BrowseCreators />
        ) : (
        <>
        <ProfileVisibilityBanner isVisible={true} missingFields={[]} />

        {/* No location state */}
        {!userLocation && !loading && (
          <div className="space-y-6">
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <MapPin className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Discover Your Creative Scene</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Find creators, events, studios, and creative spots near you. Enable location to get started.
                </p>
                <Button onClick={detectLocation} disabled={locating} variant="gradient" size="lg">
                  {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
                  Enable Location
                </Button>
              </CardContent>
            </Card>
            <Events embedded />
          </div>
        )}

        {/* Map-first layout */}
        {userLocation && (
          <div className="space-y-3">
            {/* Quick actions */}
            <div className="flex gap-2">
              <Button className="flex-1 h-9 text-xs" variant="gradient" onClick={() => setShowCreateSession(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Host Event
              </Button>
              <Button className="flex-1 h-9 text-xs" variant="outline" onClick={() => setShowAddLocation(true)}>
                <MapPin className="h-3.5 w-3.5 mr-1" />Pin a Spot
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowSeedDialog(true)} title="AI Discover Spots">
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </div>

            {(() => {
              const within50 = creators.filter(c => (c.distance_km ?? 0) <= 50).length;
              const showEmpty = !loading && within50 < 3;
              if (showEmpty) {
                const cityLabel = cityName || "your area";
                return (
                  <div className="rounded-xl border border-dashed border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6 sm:p-8 text-center space-y-4">
                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-base sm:text-lg font-bold">No creators nearby yet</h2>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        But your city is growing. Invite someone to put {cityLabel} on the map.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button onClick={() => setShowInviteDialog(true)} className="gap-2">
                        <Share2 className="h-4 w-4" />
                        Invite a creative
                      </Button>
                      <Button variant="outline" onClick={() => setDiscoverMode('browse')}>
                        Browse all creators
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {within50 === 0
                        ? "0 within 50 km"
                        : `${within50} within 50 km — needs at least 3 to unlock the map`}
                    </p>
                  </div>
                );
              }
              return viewMode === 'map' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Map takes priority */}
                <div className="lg:col-span-2">
                  <div className="rounded-xl overflow-hidden border h-[55vh] sm:h-[65vh]">
                    <UnifiedNearbyMap
                      creators={filteredCreators} sessions={filteredSessions} locations={filteredLocations}
                      userLocation={userLocation} selectedItem={selectedItem}
                      onSelectCreator={(c) => setSelectedItem(c ? { type: 'creator', id: c.user_id } : null)}
                      onSelectSession={(s) => { if (s) { setSelectedItem({ type: 'session', id: s.id }); setSelectedSession(s); } else setSelectedItem(null); }}
                      onSelectLocation={(l) => setSelectedItem(l ? { type: 'location', id: l.id } : null)}
                      loading={loading}
                      connectedIds={connectedIds}
                    />
                  </div>
                </div>

                {/* Sidebar summary on desktop */}
                <div className="hidden lg:block space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                  {filteredCreators.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        <Users className="h-3 w-3 inline mr-1" />{filteredCreators.length} Creators
                      </h3>
                      <div className="space-y-1.5">
                        {filteredCreators.slice(0, 8).map(c => {
                          const connected = isConnected(c.user_id);
                          const displayName = connected ? c.full_name : `${c.full_name?.split(' ')[0]?.[0] || ''}***`;
                          return (
                            <button key={c.user_id}
                              onClick={() => setSelectedItem({ type: 'creator', id: c.user_id })}
                              className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-muted/50 ${selectedItem?.id === c.user_id ? 'bg-primary/5 border border-primary/20' : ''}`}>
                              <div className="h-8 w-8 rounded-full overflow-hidden bg-muted shrink-0">
                                {connected && c.avatar_url ? <img src={c.avatar_url} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-xs font-medium">{c.full_name?.charAt(0)}</div>}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{displayName}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{c.role} • {formatDistance(c.distance_km)}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {filteredSessions.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {filteredSessions.length} Events
                      </h3>
                      <div className="space-y-1.5">
                        {filteredSessions.slice(0, 6).map(s => (
                          <button key={s.id}
                            onClick={() => { setSelectedItem({ type: 'session', id: s.id }); setSelectedSession(s); }}
                            className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-muted/50 ${selectedItem?.id === s.id ? 'bg-accent/10 border border-accent/20' : ''}`}>
                            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                              <span className="text-xs">📅</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{s.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {new Date(s.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {formatDistance(s.distance_km)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredLocations.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {filteredLocations.length} Spots
                      </h3>
                      <div className="space-y-1.5">
                        {filteredLocations.slice(0, 8).map(loc => (
                          <button key={loc.id}
                            onClick={() => { setSelectedItem({ type: 'location', id: loc.id }); setSelectedLocation(loc); }}
                            className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-muted/50 ${selectedItem?.id === loc.id ? 'bg-primary/5 border border-primary/20' : ''}`}>
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {loc.cover_image_url ? <img src={loc.cover_image_url} className="h-full w-full object-cover" /> : <span className="text-xs">📍</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{loc.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {loc.location_type.replace('_', ' ')} • {formatDistance(loc.distance_km)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile: scrollable cards below map */}
                <div className="lg:hidden">
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : totalResults === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <p className="text-sm text-muted-foreground mb-3">Nothing found nearby. Try expanding your radius.</p>
                        <Button variant="gradient" size="sm" onClick={() => setShowCreateSession(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Host an Event
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {filteredCreators.slice(0, 5).map(c => (
                        <CreatorCard key={c.user_id} creator={c} onViewProfile={handleViewProfile} onMessage={handleMessage} isConnected={isConnected(c.user_id)} onBlocked={refetchBlocks} />
                      ))}
                      {filteredSessions.slice(0, 5).map(s => (
                        <SessionCard key={s.id} session={s} onJoin={fetchNearbyData} onClick={() => setSelectedSession(s)} />
                      ))}
                      {filteredLocations.slice(0, 5).map(loc => (
                        <LocationListItem key={loc.id} location={loc} isSelected={false} onClick={() => setSelectedLocation(loc)}
                          formatDistance={formatDistance} isBookmarked={bookmarkedIds.has(loc.id)} onToggleBookmark={() => toggleBookmark(loc.id)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* List view */
              <div className="space-y-3">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : atlasFilter === 'sessions' ? (
                  <Events embedded />
                ) : totalResults === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nothing nearby</h3>
                      <p className="text-sm text-muted-foreground mb-4">Try increasing your search radius or host an event!</p>
                      <Button variant="gradient" onClick={() => setShowCreateSession(true)}><Plus className="h-4 w-4 mr-2" />Host Event</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {filteredCreators.map(c => <CreatorCard key={c.user_id} creator={c} onViewProfile={handleViewProfile} onMessage={handleMessage} isConnected={isConnected(c.user_id)} onBlocked={refetchBlocks} />)}
                    {filteredSessions.map(s => <SessionCard key={s.id} session={s} onJoin={fetchNearbyData} onClick={() => setSelectedSession(s)} />)}
                    {filteredLocations.map(loc => (
                      <LocationListItem key={loc.id} location={loc} isSelected={false} onClick={() => setSelectedLocation(loc)}
                        formatDistance={formatDistance} isBookmarked={bookmarkedIds.has(loc.id)} onToggleBookmark={() => toggleBookmark(loc.id)} />
                    ))}
                  </>
                )}
              </div>
            );
            })()}
          </div>
        )}
        </>
        )}
      </div>

      {/* Dialogs */}
      <CreateSessionDialog open={showCreateSession} onOpenChange={setShowCreateSession} onCreated={fetchNearbyData} defaultLocation={userLocation || undefined} />
      <AddCreativeLocationDialog open={showAddLocation} onOpenChange={setShowAddLocation} onCreated={fetchNearbyData} defaultLocation={userLocation || undefined} />
      {userLocation && <SeedLocationsDialog open={showSeedDialog} onOpenChange={setShowSeedDialog} userLocation={userLocation} onSeeded={fetchNearbyData} />}
      <SessionDetailDialog session={selectedSession} open={!!selectedSession} onOpenChange={(open) => { if (!open) setSelectedSession(null); }} onRefresh={fetchNearbyData} />
      <LocationDetailDialog location={selectedLocation} open={!!selectedLocation} onOpenChange={(open) => { if (!open) setSelectedLocation(null); }}
        isBookmarked={selectedLocation ? bookmarkedIds.has(selectedLocation.id) : false} onToggleBookmark={selectedLocation ? () => toggleBookmark(selectedLocation.id) : undefined} />
      <InviteDialog open={showInviteDialog} onOpenChange={setShowInviteDialog} />
    </div>
  );
};

export default NearbyCreators;
