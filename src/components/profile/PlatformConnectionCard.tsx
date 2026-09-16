import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Music, 
  Film, 
  Disc3, 
  CheckCircle2, 
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  Search,
  AlertCircle,
  Edit,
  Sparkles,
  User,
  Mic2,
  Radio,
  Youtube,
  Library,
  Globe,
  Wand2,
  Palette,
  Camera,
  Gamepad2,
  BookOpen
} from "lucide-react";

interface ConnectedPlatform {
  id: string;
  platform: string;
  platform_username: string;
  platform_data: any;
  verified_at: string;
  last_synced_at: string;
}

interface SearchResult {
  id: string;
  name: string;
  image?: string;
  details?: string;
  url?: string;
  type?: string; // 'artist', 'show', 'episode' for Spotify
  showName?: string;
  confidence?: string;
}

// Only platforms that work without OAuth
const PLATFORMS = [
  {
    id: 'spotify',
    name: 'Spotify',
    icon: Music,
    color: 'bg-green-500',
    description: 'Import podcasts, music, and episode appearances',
    searchPlaceholder: 'Search your name or podcast/show name',
    searchType: 'spotify' as const,
    hasGuestSearch: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'bg-red-500',
    description: 'Import your YouTube channel and video credits',
    searchPlaceholder: 'Your channel name or paste YouTube URL',
    searchType: 'youtube' as const,
  },
  {
    id: 'imdb',
    name: 'IMDB / TMDB',
    icon: Film,
    color: 'bg-yellow-500',
    description: 'Import film & TV credits (search name or paste IMDB ID like nm1234567)',
    searchPlaceholder: 'Your name or IMDB ID (e.g., nm5890122)',
    searchType: 'imdb' as const,
  },
  {
    id: 'musicbrainz',
    name: 'MusicBrainz',
    icon: Library,
    color: 'bg-primary',
    description: 'Import songwriting, session work & music credits (100% free)',
    searchPlaceholder: 'Your artist or producer name',
    searchType: 'musicbrainz' as const,
  },
  {
    id: 'discogs',
    name: 'Discogs',
    icon: Disc3,
    color: 'bg-orange-500',
    description: 'Import music production & engineering credits',
    searchPlaceholder: 'Your artist/producer name',
    searchType: 'discogs' as const,
  },
];

interface PlatformConnectionCardProps {
  onCreditsImported?: () => void;
}

export function PlatformConnectionCard({ onCreditsImported }: PlatformConnectionCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connectedPlatforms, setConnectedPlatforms] = useState<ConnectedPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDialogOpen, setSearchDialogOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [searchTab, setSearchTab] = useState<'search' | 'guest'>('search');
  const [guestAppearances, setGuestAppearances] = useState<SearchResult[]>([]);
  const [searchingGuest, setSearchingGuest] = useState(false);
  
  // AI Import from URL state
  const [urlImportDialogOpen, setUrlImportDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const [urlImportResult, setUrlImportResult] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchConnectedPlatforms();
    }
  }, [user]);

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

  const handleSearch = async (platform: string) => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setSearchResults([]);
    
    try {
      if (platform === 'spotify') {
        // Search Spotify via our backend (uses Spotify API with client credentials)
        const { data, error } = await supabase.functions.invoke('connect-platform', {
          body: {
            action: 'searchArtist',
            platform: 'spotify',
            query: searchQuery,
          },
        });

        if (error) throw error;
        
        if (data?.results) {
          setSearchResults(data.results.map((r: any) => ({
            id: r.id,
            name: r.name,
            image: r.image,
            details: r.details || r.type,
            url: r.url,
            type: r.type, // 'artist', 'show', or 'episode'
          })));
        } else {
          toast({
            title: "No results found",
            description: "Try a different search term",
          });
        }
      } else if (platform === 'imdb') {
        // Check if the query is an IMDB ID (starts with nm followed by numbers)
        const imdbIdMatch = searchQuery.match(/nm(\d+)/i);
        
        if (imdbIdMatch) {
          // Direct IMDB ID lookup
          const imdbId = `nm${imdbIdMatch[1]}`;
          const { data, error } = await supabase.functions.invoke('fetch-imdb-credits', {
            body: { 
              imdbId,
              searchOnly: true // Let user confirm before importing
            },
          });

          if (error) throw error;
          
          // Check for search results from fallback name search
          if (data?.searchResults && data.searchResults.length > 0) {
            setSearchResults(data.searchResults.map((r: any) => ({
              id: String(r.id || ''),
              name: r.name || 'Unknown',
              image: r.profile_path ? `https://image.tmdb.org/t/p/w92${r.profile_path}` : undefined,
              details: `${r.known_for_department || 'Person'}${r.known_for ? ` • ${r.known_for}` : ''}`,
              url: `https://www.imdb.com/name/${imdbId}`,
            })));
            toast({
              title: "Multiple Results",
              description: "Please select your correct profile below",
            });
          } else if (data?.personFound && data?.personData) {
            // Single person found directly
            setSearchResults([{
              id: String(data.personData.id || ''),
              name: data.personData.name || 'Unknown',
              image: data.personData.profilePath || undefined,
              details: `${data.personData.knownFor || 'Person'}`,
              url: `https://www.imdb.com/name/${imdbId}`,
            }]);
          } else {
            toast({
              title: "Not Found",
              description: `IMDB ID ${imdbId} not found in TMDB. Try searching by name instead.`,
              variant: "destructive",
            });
          }
        } else {
          // Name search
          const { data, error } = await supabase.functions.invoke('fetch-imdb-credits', {
            body: { 
              personName: searchQuery,
              searchOnly: true 
            },
          });

          if (error) throw error;
          
          if (data?.searchResults && data.searchResults.length > 0) {
            setSearchResults(data.searchResults.map((r: any) => ({
              id: String(r.id || ''),
              name: r.name || 'Unknown',
              image: r.profile_path ? `https://image.tmdb.org/t/p/w92${r.profile_path}` : undefined,
              details: `${r.known_for_department || 'Person'}${r.known_for ? ` • ${r.known_for}` : ''}`,
              url: `https://www.themoviedb.org/person/${r.id}`,
            })));
          } else {
            toast({
              title: "No Results",
              description: "Try your IMDB ID instead (e.g., nm5890122)",
            });
          }
        }
      } else if (platform === 'discogs') {
        const { data, error } = await supabase.functions.invoke('fetch-discogs-credits', {
          body: { 
            artistName: searchQuery,
            searchOnly: true 
          },
        });

        if (error) throw error;
        
        if (data?.searchResults) {
          setSearchResults(data.searchResults.map((r: any) => ({
            id: r.id?.toString(),
            name: r.title || r.name,
            image: r.thumb || r.cover_image,
            details: r.type || 'Artist',
            url: r.resource_url,
          })));
        }
      } else if (platform === 'youtube') {
        // YouTube search
        const isUrl = searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be');
        const { data, error } = await supabase.functions.invoke('fetch-youtube-credits', {
          body: isUrl 
            ? { channelUrl: searchQuery, searchOnly: true }
            : { channelName: searchQuery, searchOnly: true },
        });

        if (error) throw error;
        
        if (data?.searchResults) {
          setSearchResults(data.searchResults.map((r: any) => ({
            id: r.id,
            name: r.name,
            image: r.thumb,
            details: r.details || 'YouTube Channel',
          })));
        }
      } else if (platform === 'musicbrainz') {
        // MusicBrainz search (100% free, no API key needed)
        const { data, error } = await supabase.functions.invoke('fetch-musicbrainz-credits', {
          body: { artistName: searchQuery, searchOnly: true },
        });

        if (error) throw error;
        
        if (data?.searchResults) {
          setSearchResults(data.searchResults.map((r: any) => ({
            id: r.id,
            name: r.name,
            details: [r.type, r.details].filter(Boolean).join(' • ') || 'Artist',
          })));
        }
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: error.message || "Unable to search. Try entering the URL directly.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleFindGuestAppearances = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Enter your name",
        description: "Please enter your name to find podcast appearances",
      });
      return;
    }
    
    setSearchingGuest(true);
    setGuestAppearances([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('connect-platform', {
        body: {
          action: 'findGuestAppearances',
          platform: 'spotify',
          guestName: searchQuery,
        },
      });

      if (error) throw error;
      
      if (data?.guestAppearances && data.guestAppearances.length > 0) {
        setGuestAppearances(data.guestAppearances);
        toast({
          title: `Found ${data.guestAppearances.length} potential appearances`,
          description: "Select episodes to add to your profile",
        });
      } else {
        toast({
          title: "No appearances found",
          description: "Try different variations of your name",
        });
      }
    } catch (error: any) {
      console.error('Guest search error:', error);
      toast({
        title: "Search Failed",
        description: error.message || "Unable to search for guest appearances",
        variant: "destructive",
      });
    } finally {
      setSearchingGuest(false);
    }
  };

  const handleSelectAndImport = async (platform: string, result: SearchResult & { type?: string }) => {
    setSelectedResult(result);
    setImporting(true);
    
    try {
      if (platform === 'spotify') {
        // Determine content type
        const spotifyType = result.type || 'artist';
        const spotifyUrl = result.url || `https://open.spotify.com/${spotifyType}/${result.id}`;
        
        // Try to fetch via Spotify oEmbed
        let oembedData: any = {};
        try {
          const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            oembedData = await response.json();
          }
        } catch (e) {
          console.log('oEmbed fetch failed, continuing without embed data');
        }
        
        // Save to connected_platforms
        const { error } = await supabase
          .from('connected_platforms')
          .upsert({
            user_id: user?.id,
            platform: 'spotify',
            platform_username: result.name,
            platform_user_id: result.id,
            platform_data: {
              contentId: result.id,
              contentType: spotifyType,
              spotifyUrl: spotifyUrl,
              thumbnailUrl: oembedData.thumbnail_url || result.image,
              embedHtml: oembedData.html,
              details: result.details,
            },
            verified_at: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,platform',
          });

        if (error) throw error;

        // Import verified credits based on content type
        await importSpotifyCredits(result.id, result.name, spotifyType);
        
        const typeLabel = spotifyType === 'show' ? 'podcast' : spotifyType === 'episode' ? 'episode' : 'music';
        toast({
          title: "Spotify Connected!",
          description: `Added ${result.name} to your profile with ${typeLabel} credits`,
        });
      } else if (platform === 'imdb') {
        const { data, error } = await supabase.functions.invoke('fetch-imdb-credits', {
          body: { 
            personId: result.id,
            personName: result.name 
          },
        });

        if (error) throw error;
        
        toast({
          title: "IMDB Credits Imported!",
          description: `Found ${data?.creditsImported || 0} credits for ${result.name}`,
        });
      } else if (platform === 'discogs') {
        const { data, error } = await supabase.functions.invoke('fetch-discogs-credits', {
          body: { 
            artistId: result.id,
            artistName: result.name 
          },
        });

        if (error) throw error;
        
        toast({
          title: "Discogs Credits Imported!",
          description: `Found ${data?.creditsImported || 0} credits for ${result.name}`,
        });
      } else if (platform === 'youtube') {
        const { data, error } = await supabase.functions.invoke('fetch-youtube-credits', {
          body: { 
            channelId: result.id,
            channelName: result.name 
          },
        });

        if (error) throw error;
        
        toast({
          title: "YouTube Credits Imported!",
          description: `Found ${data?.creditsImported || 0} videos for ${result.name}`,
        });
      } else if (platform === 'musicbrainz') {
        const { data, error } = await supabase.functions.invoke('fetch-musicbrainz-credits', {
          body: { 
            artistId: result.id,
            artistName: result.name 
          },
        });

        if (error) throw error;
        
        toast({
          title: "MusicBrainz Credits Imported!",
          description: `Found ${data?.creditsImported || 0} credits for ${result.name}`,
        });
      }

      setSearchDialogOpen(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedResult(null);
      setGuestAppearances([]);
      fetchConnectedPlatforms();
      onCreditsImported?.();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import credits",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const importSpotifyCredits = async (contentId: string, contentName: string, spotifyType: string = 'artist') => {
    try {
      // Get Spotify credits via our edge function
      const { data, error } = await supabase.functions.invoke('connect-platform', {
        body: {
          action: 'importSpotifyCredits',
          platform: 'spotify',
          artistId: contentId,
          artistName: contentName,
          spotifyType, // 'artist', 'show', or 'episode'
        },
      });

      if (error) {
        console.error('Spotify credits import error:', error);
      } else {
        console.log(`Imported ${data?.creditsImported || 0} credits from Spotify`);
      }
    } catch (e) {
      console.error('Spotify import error:', e);
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      // Remove from connected_platforms
      const { error: platformError } = await supabase
        .from('connected_platforms')
        .delete()
        .eq('user_id', user?.id)
        .eq('platform', platform);

      if (platformError) throw platformError;

      // Remove verified credits from this platform
      const { error: creditsError } = await supabase
        .from('credits')
        .delete()
        .eq('user_id', user?.id)
        .eq('source', platform);

      toast({
        title: "Disconnected",
        description: `${platform} has been removed from your profile`,
      });
      fetchConnectedPlatforms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (platformId: string) => {
    // Open search dialog to select a new profile
    setSearchDialogOpen(platformId);
    const connection = connectedPlatforms.find(p => p.platform === platformId);
    if (connection) {
      setSearchQuery(connection.platform_username);
    }
  };

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a website or portfolio URL",
        variant: "destructive",
      });
      return;
    }

    setImportingUrl(true);
    setUrlImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-profile-url', {
        body: { url: importUrl }
      });

      if (data?.isLinkedInBlock) {
        toast({
          title: "LinkedIn Access Restricted",
          description: "LinkedIn blocks automated imports. Please copy-paste your info manually.",
          variant: "destructive",
          duration: 6000,
        });
        return;
      }

      if (error) throw error;

      if (data?.success && data.data) {
        setUrlImportResult(data.data);
        toast({
          title: "Profile Analyzed!",
          description: `Found: ${[
            data.data.skills?.length ? `${data.data.skills.length} skills` : '',
            data.data.credits?.length ? `${data.data.credits.length} credits` : '',
            data.data.awards?.length ? `${data.data.awards.length} awards` : '',
          ].filter(Boolean).join(', ') || 'profile data'}`,
        });
      } else {
        throw new Error(data?.error || "Could not extract data from this URL");
      }
    } catch (error: any) {
      console.error("URL import error:", error);
      toast({
        title: "Import Failed",
        description: error.message || "Could not extract data. Try a different URL.",
        variant: "destructive",
      });
    } finally {
      setImportingUrl(false);
    }
  };

  const applyUrlImportData = async () => {
    if (!urlImportResult || !user) return;
    
    setImportingUrl(true);
    try {
      const parts: string[] = [];

      // Import portfolio items if found
      if (urlImportResult.portfolio_items?.length > 0) {
        const portfolioInserts = urlImportResult.portfolio_items
          .filter((item: any) => item.title && item.media_url)
          .map((item: any) => ({
            user_id: user.id,
            project_name: item.title,
            role: 'Creator',
            source: 'portfolio',
            description: item.description || null,
            primary_media_url: item.media_url,
            media_type: item.media_type || 'image',
            thumbnail_url: item.thumbnail_url || null,
            tags: item.tags || null,
            credit_category: 'imported',
          }));

        if (portfolioInserts.length > 0) {
          const { error: portfolioError } = await supabase
            .from('credits')
            .insert(portfolioInserts);

          if (portfolioError) {
            console.error('Error importing portfolio items:', portfolioError);
          } else {
            parts.push(`${portfolioInserts.length} portfolio items`);
          }
        }
      }

      // Import credits if found
      if (urlImportResult.credits?.length > 0) {
        const creditInserts = urlImportResult.credits.slice(0, 20).map((credit: any) => ({
          user_id: user.id,
          project_name: credit.title || credit.project_name,
          role: credit.role || 'Contributor',
          year: credit.year || null,
          url: credit.url,
          verification_status: 'pending',
        }));
        const { error } = await supabase.from('credits').insert(creditInserts);
        if (!error) parts.push(`${creditInserts.length} credits`);
      }

      // Import awards if found
      if (urlImportResult.awards?.length > 0) {
        const awardInserts = urlImportResult.awards.slice(0, 10).map((award: any) => ({
          user_id: user.id,
          title: award.title || award.name,
          organization: award.organization || award.issuer || 'Unknown',
          year: award.year || null,
          verification_status: 'pending',
        }));
        const { error } = await supabase.from('awards').insert(awardInserts);
        if (!error) parts.push(`${awardInserts.length} awards`);
      }

      // Import skills if found
      if (urlImportResult.skills?.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('professional_skills')
          .eq('user_id', user.id)
          .single();

        const existingSkills = (profileData?.professional_skills as any[]) || [];
        const existingNames = existingSkills.map((s: any) => typeof s === 'string' ? s : s.skill || s.name || '');
        const newSkills = urlImportResult.skills
          .map((s: any) => typeof s === 'string' ? s : s.skill || s)
          .filter((s: string) => !existingNames.includes(s));

        if (newSkills.length > 0) {
          const merged = [
            ...existingSkills,
            ...newSkills.map((s: string) => ({ skill: s, level: 3, category: 'General' }))
          ];
          await supabase
            .from('profiles')
            .update({ professional_skills: merged as any })
            .eq('user_id', user.id);
          parts.push(`${newSkills.length} skills`);
        }
      }

      toast({
        title: "Import Complete!",
        description: parts.length > 0 ? `Added ${parts.join(", ")}` : "No new data to import",
      });

      setUrlImportDialogOpen(false);
      setImportUrl('');
      setUrlImportResult(null);
      onCreditsImported?.();
    } catch (error: any) {
      console.error("Apply import error:", error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to save imported data",
        variant: "destructive",
      });
    } finally {
      setImportingUrl(false);
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
          <Sparkles className="h-5 w-5 text-primary" />
          Import & Verify Credits
        </CardTitle>
        <CardDescription>
          Search your name on major platforms to auto-import and verify your work credits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI-Powered URL Import - Featured */}
        <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 p-4">
          <div className="absolute top-0 right-0 opacity-10">
            <Wand2 className="h-24 w-24 text-primary -mr-6 -mt-6" />
          </div>
          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shrink-0">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Import from Any URL</span>
                  <Badge className="bg-primary/20 text-primary text-xs border-0">
                    <Wand2 className="h-3 w-3 mr-1" />
                    AI Powered
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Paste any portfolio, website, or profile URL — AI extracts your credits, skills & awards
                </p>
                
                <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                  {[
                    { icon: Palette, label: 'Behance' },
                    { icon: Camera, label: 'ArtStation' },
                    { icon: BookOpen, label: 'Goodreads' },
                    { icon: Gamepad2, label: 'IGDB' },
                    { icon: Globe, label: 'Personal Sites' },
                  ].map(({ icon: Icon, label }) => (
                    <Badge key={label} variant="outline" className="text-xs bg-background/50">
                      <Icon className="h-3 w-3 mr-1" />
                      {label}
                    </Badge>
                  ))}
                </div>

                <Dialog open={urlImportDialogOpen} onOpenChange={setUrlImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Wand2 className="h-4 w-4" />
                      Import with AI
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Import from Any URL
                      </DialogTitle>
                      <DialogDescription>
                        Paste your portfolio, personal website, or any profile URL to extract credits and achievements
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="import-url">Website or Portfolio URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="import-url"
                            placeholder="https://behance.net/yourname or any portfolio URL"
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
                            disabled={importingUrl}
                          />
                          <Button onClick={handleImportFromUrl} disabled={importingUrl || !importUrl.trim()}>
                            {importingUrl ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Works with Behance, ArtStation, Dribbble, personal websites, and most portfolio platforms
                        </p>
                      </div>

                      {urlImportResult && (
                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="font-medium">Data extracted successfully!</span>
                          </div>
                          
                          {urlImportResult.full_name && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Name:</span> {urlImportResult.full_name}
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
                            {urlImportResult.skills?.length > 0 && (
                              <Badge variant="secondary">
                                {urlImportResult.skills.length} skills
                              </Badge>
                            )}
                            {urlImportResult.credits?.length > 0 && (
                              <Badge variant="secondary">
                                {urlImportResult.credits.length} credits
                              </Badge>
                            )}
                            {urlImportResult.awards?.length > 0 && (
                              <Badge variant="secondary">
                                {urlImportResult.awards.length} awards
                              </Badge>
                            )}
                            {urlImportResult.portfolio_items?.length > 0 && (
                              <Badge variant="secondary">
                                {urlImportResult.portfolio_items.length} portfolio items
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setUrlImportDialogOpen(false);
                        setImportUrl('');
                        setUrlImportResult(null);
                      }}>
                        Cancel
                      </Button>
                      {urlImportResult && (
                        <Button onClick={applyUrlImportData} disabled={importingUrl}>
                          {importingUrl ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Add to Profile
                            </>
                          )}
                        </Button>
                      )}
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-muted-foreground/20" />
          <span className="px-3 text-xs text-muted-foreground uppercase tracking-wider">Or search by platform</span>
          <div className="flex-grow border-t border-muted-foreground/20" />
        </div>

        {PLATFORMS.map((platform) => {
          const connected = isConnected(platform.id);
          const connectionData = getConnectionData(platform.id);
          const Icon = platform.icon;

          return (
            <div
              key={platform.id}
              className={`p-4 rounded-lg border transition-colors ${
                connected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${platform.color} text-white shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium">{platform.name}</span>
                    {connected && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  {connected && connectionData ? (
                    <p className="text-sm text-muted-foreground">
                      {connectionData.platform_username}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {platform.description}
                    </p>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    {connected ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSearchDialogOpen(platform.id)}
                          className="gap-1.5"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnect(platform.id)}
                          className="text-destructive hover:text-destructive gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="gap-2"
                        onClick={() => setSearchDialogOpen(platform.id)}
                      >
                        <Search className="h-4 w-4" />
                        Search & Import
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Search Dialog - rendered separately for both connected and non-connected */}
              <Dialog 
                open={searchDialogOpen === platform.id} 
                onOpenChange={(open) => {
                  setSearchDialogOpen(open ? platform.id : null);
                  if (!open) {
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedResult(null);
                    setSearchTab('search');
                    setGuestAppearances([]);
                  }
                }}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${platform.color.replace('bg-', 'text-').replace('-500', '-600')}`} />
                      Search {platform.name}
                    </DialogTitle>
                    <DialogDescription>
                      {platform.id === 'spotify' 
                        ? 'Find your music, podcasts, or episode appearances'
                        : 'Search for your profile, then select the correct one to import credits'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {/* Show tabs for Spotify to enable guest appearance search */}
                  {platform.id === 'spotify' ? (
                    <Tabs value={searchTab} onValueChange={(v) => setSearchTab(v as 'search' | 'guest')} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="search" className="gap-1.5">
                          <Search className="h-3.5 w-3.5" />
                          Search
                        </TabsTrigger>
                        <TabsTrigger value="guest" className="gap-1.5">
                          <Mic2 className="h-3.5 w-3.5" />
                          Find My Appearances
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="search" className="space-y-4 pt-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Search artist, podcast, or episode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(platform.id)}
                            className="flex-1"
                          />
                          <Button 
                            onClick={() => handleSearch(platform.id)}
                            disabled={searching || !searchQuery.trim()}
                          >
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </Button>
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Select to import:</Label>
                            <ScrollArea className="h-[260px] rounded-md border">
                              <div className="p-2 space-y-2">
                                {searchResults.map((result) => (
                                  <div
                                    key={result.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                      selectedResult?.id === result.id 
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                        : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() => setSelectedResult(result)}
                                  >
                                    {result.image ? (
                                      <img src={result.image} alt={result.name || ''} className="w-12 h-12 rounded-lg object-cover" />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                        {result.type === 'show' ? <Radio className="h-5 w-5 text-muted-foreground" /> :
                                         result.type === 'episode' ? <Mic2 className="h-5 w-5 text-muted-foreground" /> :
                                         <Music className="h-5 w-5 text-muted-foreground" />}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium truncate text-sm">{result.name}</p>
                                        {result.type && (
                                          <Badge variant="secondary" className="text-[10px] shrink-0">
                                            {result.type === 'show' ? '🎙Podcast' : 
                                             result.type === 'episode' ? 'Episode' : 'Artist'}
                                          </Badge>
                                        )}
                                      </div>
                                      {result.details && <p className="text-xs text-muted-foreground truncate">{result.details}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {searching && (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="guest" className="space-y-4 pt-2">
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">Find Podcast Guest Appearances</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Enter your name to find episodes where you were mentioned as a guest
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Input
                            placeholder="Your full name (e.g., John Smith)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFindGuestAppearances()}
                            className="flex-1"
                          />
                          <Button 
                            onClick={handleFindGuestAppearances}
                            disabled={searchingGuest || !searchQuery.trim()}
                            variant="default"
                          >
                            {searchingGuest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic2 className="h-4 w-4" />}
                          </Button>
                        </div>

                        {/* Guest Appearances Results */}
                        {guestAppearances.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">
                              Found {guestAppearances.length} potential appearances:
                            </Label>
                            <ScrollArea className="h-[240px] rounded-md border">
                              <div className="p-2 space-y-2">
                                {guestAppearances.map((episode) => (
                                  <div
                                    key={episode.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                      selectedResult?.id === episode.id 
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                        : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() => setSelectedResult({ ...episode, type: 'episode' })}
                                  >
                                    {episode.image ? (
                                      <img src={episode.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <Mic2 className="h-5 w-5 text-green-600" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium truncate text-sm">{episode.name}</p>
                                        {episode.confidence === 'high' && (
                                          <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 shrink-0">
                                            High match
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground truncate">{episode.details}</p>
                                    </div>
                                    {episode.url && (
                                      <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                                        <a href={episode.url} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}

                        {searchingGuest && (
                          <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                            <p className="text-xs text-muted-foreground">Searching podcasts for "{searchQuery}"...</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : (
                    /* Standard search for non-Spotify platforms */
                    <div className="space-y-4 pt-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder={platform.searchPlaceholder}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch(platform.id)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => handleSearch(platform.id)}
                          disabled={searching || !searchQuery.trim()}
                        >
                          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Select your profile:</Label>
                          <ScrollArea className="h-[280px] rounded-md border">
                            <div className="p-2 space-y-2">
                              {searchResults.map((result) => (
                                <div
                                  key={result.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    selectedResult?.id === result.id 
                                      ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                      : 'hover:bg-muted/50'
                                  }`}
                                  onClick={() => setSelectedResult(result)}
                                >
                                  {result.image ? (
                                    <img src={result.image} alt={result.name || ''} className="w-12 h-12 rounded-lg object-cover" />
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                      <User className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{result.name}</p>
                                    {result.details && <p className="text-sm text-muted-foreground truncate">{result.details}</p>}
                                  </div>
                                  {result.url && (
                                    <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {searching && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {!searching && searchQuery && searchResults.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
                          <p className="text-xs text-muted-foreground mt-1">Try a different spelling or your full name</p>
                        </div>
                      )}
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      onClick={() => selectedResult && handleSelectAndImport(platform.id, selectedResult)}
                      disabled={!selectedResult || importing}
                      className="w-full"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Importing Credits...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Import {selectedResult?.name ? `"${selectedResult.name.substring(0, 30)}${selectedResult.name.length > 30 ? '...' : ''}"` : 'Selected'}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Imported credits appear in your <strong>Work</strong> section and boost your verification score.
              You can edit or remove connections anytime.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
