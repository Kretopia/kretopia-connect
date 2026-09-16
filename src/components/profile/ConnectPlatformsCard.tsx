import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { 
  Music, 
  Youtube, 
  Instagram, 
  Film, 
  Disc3, 
  CheckCircle2, 
  ExternalLink,
  Loader2,
  RefreshCw,
  Unlink,
  Search,
  AlertCircle,
  Video,
  Link
} from "lucide-react";

interface ConnectedPlatform {
  id: string;
  platform: string;
  platform_username: string;
  platform_data: any;
  verified_at: string;
  last_synced_at: string;
}

// Generate a cryptographically secure random state for CSRF protection
const generateOAuthState = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

const PLATFORMS = [
  {
    id: 'spotify',
    name: 'Spotify',
    icon: Music,
    color: 'bg-green-500',
    description: 'Paste your Spotify artist URL to add an embedded player',
    requiresOAuth: false,
    urlEmbed: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'bg-red-500',
    description: 'Connect to verify subscriber count and import videos',
    requiresOAuth: true,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-primary to-primary',
    description: 'Connect to verify follower count',
    requiresOAuth: true,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Video,
    color: 'bg-gradient-to-r from-[#00f2ea] to-[#ff0050]',
    description: 'Connect to verify follower count and import videos',
    requiresOAuth: true,
  },
  {
    id: 'imdb',
    name: 'IMDB / TMDB',
    icon: Film,
    color: 'bg-yellow-500',
    description: 'Search and import your film/TV credits',
    requiresOAuth: false,
  },
  {
    id: 'discogs',
    name: 'Discogs',
    icon: Disc3,
    color: 'bg-orange-500',
    description: 'Search and import your music production credits',
    requiresOAuth: false,
  },
];

export function ConnectPlatformsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectedPlatforms, setConnectedPlatforms] = useState<ConnectedPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searching, setSearching] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);
  const [urlEmbedDialogOpen, setUrlEmbedDialogOpen] = useState<string | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [spotifyMode, setSpotifyMode] = useState<'url' | 'manual'>('url');
  const [manualStats, setManualStats] = useState({ monthlyListeners: '', artistName: '' });

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async (code: string, platform: string, state: string) => {
    // Validate state to prevent CSRF attacks - use localStorage for cross-window access
    const storedState = localStorage.getItem(`oauth_state_${platform}`);
    if (!storedState || storedState !== state) {
      console.error('OAuth state mismatch - stored:', storedState, 'received:', state);
      toast({
        title: "Security Error",
        description: "OAuth state validation failed. Please try connecting again.",
        variant: "destructive",
      });
      return;
    }

    // Clear the stored state
    localStorage.removeItem(`oauth_state_${platform}`);

    setProcessingCallback(true);
    setConnecting(platform);

    try {
      const redirectUri = `${window.location.origin}/profile?oauth_callback=${platform}`;
      
      const { data, error } = await supabase.functions.invoke('connect-platform', {
        body: {
          action: 'exchangeCode',
          platform,
          code,
          redirectUri,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Connected!",
          description: `${platform.charAt(0).toUpperCase() + platform.slice(1)} has been connected successfully`,
        });
        fetchConnectedPlatforms();
      } else {
        throw new Error(data.error || 'Failed to exchange code');
      }
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to complete OAuth connection",
        variant: "destructive",
      });
    } finally {
      setProcessingCallback(false);
      setConnecting(null);
      // Clear URL parameters
      setSearchParams({});
    }
  }, [toast, setSearchParams]);

  useEffect(() => {
    if (user) {
      fetchConnectedPlatforms();
      
      // Check for OAuth callback parameters
      const oauthCallback = searchParams.get('oauth_callback');
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        toast({
          title: "Connection Denied",
          description: errorDescription || `${oauthCallback || 'Platform'} authorization was denied`,
          variant: "destructive",
        });
        setSearchParams({});
        return;
      }

      if (oauthCallback && code && state && !processingCallback) {
        handleOAuthCallback(code, oauthCallback, state);
      }
    }
  }, [user, searchParams, handleOAuthCallback, processingCallback]);

  const fetchConnectedPlatforms = async () => {
    try {
      const { data, error } = await supabase
        .from('connected_platforms')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setConnectedPlatforms(data || []);
    } catch (error) {
      console.error('Error fetching connected platforms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      // Generate and store state for CSRF protection - use localStorage for cross-window access
      const state = generateOAuthState();
      localStorage.setItem(`oauth_state_${platform}`, state);
      
      const redirectUri = `${window.location.origin}/profile?oauth_callback=${platform}`;
      
      const { data, error } = await supabase.functions.invoke('connect-platform', {
        body: {
          action: 'getAuthUrl',
          platform,
          redirectUri,
          state,
        },
      });

      if (error) throw error;

      if (data.authUrl) {
        // Use full page redirect instead of popup for better OAuth compatibility
        window.location.href = data.authUrl;
      } else if (data.error) {
        localStorage.removeItem(`oauth_state_${platform}`);
        toast({
          title: "Not Available",
          description: data.details || `${platform} integration is not configured yet`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('OAuth connect error:', error);
      localStorage.removeItem(`oauth_state_${platform}`);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start connection",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleSearchConnect = async (platform: string) => {
    if (!searchName.trim()) return;
    
    setSearching(true);
    try {
      const functionName = platform === 'imdb' ? 'fetch-imdb-credits' : 'fetch-discogs-credits';
      const body = platform === 'imdb' 
        ? { personName: searchName }
        : { artistName: searchName };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) throw error;

      console.log('Search result:', data);

      if (data.success && data.creditsImported > 0) {
        toast({
          title: "Credits Imported!",
          description: `Found ${data.creditsImported} credits for "${data.personData?.name || searchName}"`,
        });
        setSearchDialogOpen(null);
        setSearchName('');
        fetchConnectedPlatforms();
      } else if (data.personFound && data.creditsImported === 0) {
        toast({
          title: "No Credits Found",
          description: `Found "${data.personData?.name}" but they have no film/TV credits on TMDB.`,
          variant: "destructive",
        });
      } else if (data.searchResults && data.searchResults.length > 0) {
        const names = data.searchResults.map((r: any) => r.name).join(', ');
        toast({
          title: "Did you mean?",
          description: `Similar names found: ${names}. Try searching with the exact name.`,
        });
      } else {
        toast({
          title: "Not Found",
          description: data.message || `No results found for "${searchName}".`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Search connect error:', error);
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search for credits",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = async (platform: string) => {
    setConnecting(platform);
    try {
      const { data, error } = await supabase.functions.invoke('connect-platform', {
        body: {
          action: 'refresh',
          platform,
        },
      });

      if (error) throw error;

      toast({
        title: "Refreshed!",
        description: `${platform} data has been updated`,
      });
      fetchConnectedPlatforms();
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      const { error } = await supabase.functions.invoke('connect-platform', {
        body: {
          action: 'disconnect',
          platform,
        },
      });

      if (error) throw error;

      toast({
        title: "Disconnected",
        description: `${platform} has been disconnected`,
      });
      fetchConnectedPlatforms();
    } catch (error: any) {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSpotifyUrlSave = async () => {
    if (!spotifyUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please paste your Spotify artist URL",
        variant: "destructive",
      });
      return;
    }

    // Validate Spotify URL format
    const spotifyArtistMatch = spotifyUrl.match(/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)/);
    if (!spotifyArtistMatch) {
      toast({
        title: "Invalid URL",
        description: "Please paste a valid Spotify artist URL (e.g., https://open.spotify.com/artist/...)",
        variant: "destructive",
      });
      return;
    }

    const artistId = spotifyArtistMatch[1];
    setSearching(true);
    
    try {
      // Fetch oEmbed data from Spotify
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
      const response = await fetch(oembedUrl);
      
      if (!response.ok) {
        throw new Error('Could not fetch Spotify data. Make sure the URL is public.');
      }
      
      const oembedData = await response.json();
      
      // Save to connected_platforms with embed data
      const { error } = await supabase
        .from('connected_platforms')
        .upsert({
          user_id: user?.id,
          platform: 'spotify',
          platform_username: oembedData.title || 'Unknown Artist',
          platform_data: {
            artistId,
            spotifyUrl: spotifyUrl,
            thumbnailUrl: oembedData.thumbnail_url,
            embedHtml: oembedData.html,
            embedWidth: oembedData.width,
            embedHeight: oembedData.height,
            providerName: oembedData.provider_name,
          },
          verified_at: null,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform',
        });

      if (error) throw error;

      toast({
        title: "Spotify Connected!",
        description: `Added ${oembedData.title} to your profile`,
      });
      setUrlEmbedDialogOpen(null);
      setSpotifyUrl('');
      fetchConnectedPlatforms();
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to fetch Spotify data",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSpotifyManualSave = async () => {
    if (!manualStats.artistName.trim()) {
      toast({
        title: "Artist name required",
        description: "Please enter your Spotify artist name",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const { error } = await supabase
        .from('connected_platforms')
        .upsert({
          user_id: user?.id,
          platform: 'spotify',
          platform_username: manualStats.artistName,
          platform_data: {
            monthlyListeners: manualStats.monthlyListeners ? parseInt(manualStats.monthlyListeners.replace(/,/g, '')) : null,
            manualEntry: true,
          },
          verified_at: null,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform',
        });

      if (error) throw error;

      toast({
        title: "Spotify Added!",
        description: `Added ${manualStats.artistName} to your profile`,
      });
      setUrlEmbedDialogOpen(null);
      setManualStats({ monthlyListeners: '', artistName: '' });
      fetchConnectedPlatforms();
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Spotify data",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const isConnected = (platformId: string) => {
    return connectedPlatforms.some(p => p.platform === platformId);
  };

  const getConnectionData = (platformId: string) => {
    return connectedPlatforms.find(p => p.platform === platformId);
  };

  const formatMetric = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Connect & Verify Platforms
        </CardTitle>
        <CardDescription>
          Connect your accounts to auto-verify credentials and import your work credits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PLATFORMS.map((platform) => {
          const connected = isConnected(platform.id);
          const connectionData = getConnectionData(platform.id);
          const Icon = platform.icon;

          return (
            <div
              key={platform.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                connected ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{platform.name}</span>
                    {connected && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                    {connected && connectionData ? (
                    <div className="text-sm text-muted-foreground">
                      {connectionData.platform_username}
                      {connectionData.platform_data?.thumbnailUrl && (
                        <span className="ml-2">• Embed ready</span>
                      )}
                      {connectionData.platform_data?.monthlyListeners && (
                        <span className="ml-2">
                          • {formatMetric(connectionData.platform_data.monthlyListeners)} monthly listeners
                        </span>
                      )}
                      {connectionData.platform_data?.manualEntry && (
                        <Badge variant="outline" className="ml-2 text-xs">Manual</Badge>
                      )}
                      {connectionData.platform_data?.followers && (
                        <span className="ml-2">
                          • {formatMetric(connectionData.platform_data.followers)} followers
                        </span>
                      )}
                      {connectionData.platform_data?.subscribers && (
                        <span className="ml-2">
                          • {formatMetric(connectionData.platform_data.subscribers)} subscribers
                        </span>
                      )}
                      {connectionData.platform_data?.totalCredits && (
                        <span className="ml-2">
                          • {connectionData.platform_data.totalCredits} credits
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{platform.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {connected ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRefresh(platform.id)}
                      disabled={connecting === platform.id}
                    >
                      {connecting === platform.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(platform.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  </>
                ) : (platform as any).urlEmbed ? (
                  // URL-based embed OR manual entry (Spotify)
                  <Dialog open={urlEmbedDialogOpen === platform.id} onOpenChange={(open) => {
                    setUrlEmbedDialogOpen(open ? platform.id : null);
                    if (!open) {
                      setSpotifyMode('url');
                      setSpotifyUrl('');
                      setManualStats({ monthlyListeners: '', artistName: '' });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Link className="h-4 w-4 mr-2" />
                        Add Profile
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Spotify Artist</DialogTitle>
                        <DialogDescription>
                          Add your Spotify profile with URL embed or manual entry
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        {/* Mode Toggle */}
                        <div className="flex rounded-lg border p-1 gap-1">
                          <Button
                            variant={spotifyMode === 'url' ? 'default' : 'ghost'}
                            size="sm"
                            className="flex-1"
                            onClick={() => setSpotifyMode('url')}
                          >
                            <Link className="h-4 w-4 mr-2" />
                            Embed URL
                          </Button>
                          <Button
                            variant={spotifyMode === 'manual' ? 'default' : 'ghost'}
                            size="sm"
                            className="flex-1"
                            onClick={() => setSpotifyMode('manual')}
                          >
                            <Music className="h-4 w-4 mr-2" />
                            Manual Entry
                          </Button>
                        </div>

                        {spotifyMode === 'url' ? (
                          <>
                            <div className="space-y-2">
                              <Label>Spotify Artist URL *</Label>
                              <Input
                                placeholder="https://open.spotify.com/artist/..."
                                value={spotifyUrl}
                                onChange={(e) => setSpotifyUrl(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                Go to your Spotify artist page → Click "..." → Share → Copy link
                              </p>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                              <Music className="h-4 w-4 text-green-500 mt-0.5" />
                              <p className="text-sm text-muted-foreground">
                                We'll fetch your artist info and add an embedded player to your profile.
                              </p>
                            </div>
                            <Button
                              onClick={handleSpotifyUrlSave}
                              disabled={searching || !spotifyUrl.trim()}
                              className="w-full bg-green-500 hover:bg-green-600"
                            >
                              {searching ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Fetching...
                                </>
                              ) : (
                                <>
                                  <Music className="h-4 w-4 mr-2" />
                                  Add Spotify
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label>Artist Name *</Label>
                              <Input
                                placeholder="Your Spotify artist name"
                                value={manualStats.artistName}
                                onChange={(e) => setManualStats(prev => ({ ...prev, artistName: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Monthly Listeners (optional)</Label>
                              <Input
                                placeholder="e.g., 50,000"
                                value={manualStats.monthlyListeners}
                                onChange={(e) => setManualStats(prev => ({ ...prev, monthlyListeners: e.target.value }))}
                              />
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <p className="text-sm text-muted-foreground">
                                Manual stats will be shown on your profile but won't include an embed player.
                              </p>
                            </div>
                            <Button
                              onClick={handleSpotifyManualSave}
                              disabled={searching || !manualStats.artistName.trim()}
                              className="w-full bg-green-500 hover:bg-green-600"
                            >
                              {searching ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Music className="h-4 w-4 mr-2" />
                                  Save Spotify
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : platform.requiresOAuth ? (
                  <Button
                    onClick={() => handleOAuthConnect(platform.id)}
                    disabled={connecting === platform.id}
                    size="sm"
                  >
                    {connecting === platform.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connect
                  </Button>
                ) : (
                  <Dialog open={searchDialogOpen === platform.id} onOpenChange={(open) => setSearchDialogOpen(open ? platform.id : null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Search className="h-4 w-4 mr-2" />
                        Search & Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import {platform.name} Credits</DialogTitle>
                        <DialogDescription>
                          Enter your name as it appears on {platform.name} to search and import your credits
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>
                            {platform.id === 'imdb' ? 'Your Name (as on IMDB)' : 'Artist Name'}
                          </Label>
                          <Input
                            placeholder={platform.id === 'imdb' ? 'e.g., Christopher Nolan' : 'e.g., Daft Punk'}
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchConnect(platform.id)}
                          />
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm text-muted-foreground">
                            We'll search {platform.name} for your credits and import them to your profile.
                          </p>
                        </div>
                        <Button
                          onClick={() => handleSearchConnect(platform.id)}
                          disabled={searching || !searchName.trim()}
                          className="w-full"
                        >
                          {searching ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Search & Import Credits
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            Connected platforms display on your profile.
            <br />
            <span className="text-primary">More platforms coming soon:</span> AllMusic, Grammy, SoundCloud, LinkedIn
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
