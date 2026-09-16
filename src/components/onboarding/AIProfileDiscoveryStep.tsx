import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, Search, Loader2, CheckCircle2, Music, Film, 
  Palette, Award, Newspaper, Link2, ExternalLink, User,
  AlertCircle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

interface DiscoveredProfile {
  name: string;
  role: string;
  bio?: string;
  location?: string;
  sourceUrl: string;
  skills?: string[];
  imageUrl?: string;
  confidence: number;
  credits?: Array<{ project: string; role: string; year?: number }>;
  awards?: Array<{ title: string; organization: string; year?: number }>;
  pressLinks?: Array<{ title: string; url: string; source: string }>;
}

interface UnclaimedProfile {
  user_id: string;
  full_name: string;
  role: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
}

interface AIProfileDiscoveryStepProps {
  userName: string;
  userId: string;
  onComplete: (importedData?: any) => void;
  onSkip: () => void;
}

export const AIProfileDiscoveryStep = ({ 
  userName, 
  userId,
  onComplete, 
  onSkip 
}: AIProfileDiscoveryStepProps) => {
  const [searchName, setSearchName] = useState(userName);
  const [platformUrl, setPlatformUrl] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [discoveredProfiles, setDiscoveredProfiles] = useState<DiscoveredProfile[]>([]);
  const [unclaimedMatch, setUnclaimedMatch] = useState<UnclaimedProfile | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<DiscoveredProfile | null>(null);
  const [searchComplete, setSearchComplete] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  const handleSearch = async () => {
    if (!searchName.trim() && !platformUrl.trim()) {
      toast.error("Enter your name or a platform URL to search");
      return;
    }

    setIsSearching(true);
    setDiscoveredProfiles([]);
    setUnclaimedMatch(null);
    setSearchComplete(false);
    setShowRetry(false);

    try {
      // First check for existing unclaimed profile match
      const { data: existingProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, role, bio, avatar_url, location")
        .eq("is_claimed", false)
        .ilike("full_name", `%${searchName.trim()}%`)
        .limit(5);

      if (existingProfiles && existingProfiles.length > 0) {
        // Find best match
        const exactMatch = existingProfiles.find(
          p => p.full_name.toLowerCase() === searchName.toLowerCase()
        );
        if (exactMatch) {
          setUnclaimedMatch(exactMatch);
        }
      }

      // Search the web for professional data
      const { data, error } = await supabase.functions.invoke("onboarding-discover", {
        body: { 
          name: searchName.trim(),
          platformUrl: platformUrl.trim() || undefined
        }
      });

      if (error) throw error;

      if (data?.profiles && data.profiles.length > 0) {
        setDiscoveredProfiles(data.profiles);
        toast.success(`Found ${data.profiles.length} professional profile(s)!`);
      } else {
        setShowRetry(true);
        toast.info("No profiles found. Try adding a platform URL.");
      }

    } catch (error) {
      console.error("Discovery error:", error);
      setShowRetry(true);
      toast.error("Search failed. Try adding a direct platform URL.");
    } finally {
      setIsSearching(false);
      setSearchComplete(true);
    }
  };

  const handleSelectProfile = (profile: DiscoveredProfile) => {
    setSelectedProfile(profile);
  };

  const handleImportSelected = async () => {
    if (!selectedProfile) return;

    setIsImporting(true);
    try {
      // Import discovered profile data directly to user's profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          bio: selectedProfile.bio || undefined,
          location: selectedProfile.location || undefined,
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      let creditsImported = 0;
      let awardsImported = 0;

      // Import credits if available
      if (selectedProfile.credits && selectedProfile.credits.length > 0) {
        const creditsToInsert = selectedProfile.credits.map(c => ({
          user_id: userId,
          project_name: c.project,
          role: c.role,
          year: c.year || null,
          verification_status: "ai_imported"
        }));
        
        const { error } = await supabase.from("credits").insert(creditsToInsert);
        if (!error) creditsImported = creditsToInsert.length;
      }

      // Import awards if available
      if (selectedProfile.awards && selectedProfile.awards.length > 0) {
        const awardsToInsert = selectedProfile.awards.map(a => ({
          user_id: userId,
          title: a.title,
          organization: a.organization,
          year: a.year || null,
          verification_status: "ai_imported"
        }));
        
        const { error } = await supabase.from("awards").insert(awardsToInsert);
        if (!error) awardsImported = awardsToInsert.length;
      }

      // Determine if we have enough data to fast-track
      const hasSufficientBio = (selectedProfile.bio?.length || 0) >= 20;
      const hasWorkContent = creditsImported > 0 || awardsImported > 0;
      const canFastTrack = hasSufficientBio && hasWorkContent;

      toast.success(`Profile imported! ${creditsImported} credits, ${awardsImported} awards added.`);
      
      onComplete({
        ...selectedProfile,
        name: selectedProfile.name,
        role: selectedProfile.role,
        imported: true,
        creditsImported,
        awardsImported,
        canFastTrack,
        skills: selectedProfile.skills || []
      });

    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed. Your data has been saved.");
      // Still complete with partial data
      onComplete(selectedProfile);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClaimProfile = async () => {
    if (!unclaimedMatch) return;

    setIsImporting(true);
    try {
      // Directly merge the unclaimed profile data
      const { data: unclaimedData } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", unclaimedMatch.user_id)
        .single();

      let creditsImported = 0;
      let awardsImported = 0;
      let bio = "";

      if (unclaimedData) {
        bio = unclaimedData.bio || "";
        
        // Get credits, awards, press from unclaimed profile
        const [creditsRes, awardsRes, pressRes] = await Promise.all([
          supabase.from("credits").select("*").eq("user_id", unclaimedMatch.user_id),
          supabase.from("awards").select("*").eq("user_id", unclaimedMatch.user_id),
          supabase.from("press_links").select("*").eq("user_id", unclaimedMatch.user_id)
        ]);

        // Transfer credits to current user (create new entries)
        if (creditsRes.data && creditsRes.data.length > 0) {
          const creditsToInsert = creditsRes.data.map(c => ({
            user_id: userId,
            project_name: c.project_name,
            role: c.role,
            year: c.year,
            platform: c.platform,
            url: c.url,
            verification_status: c.verification_status
          }));
          const { error } = await supabase.from("credits").insert(creditsToInsert);
          if (!error) creditsImported = creditsToInsert.length;
        }
        
        // Transfer awards to current user
        if (awardsRes.data && awardsRes.data.length > 0) {
          const awardsToInsert = awardsRes.data.map(a => ({
            user_id: userId,
            title: a.title,
            organization: a.organization,
            year: a.year,
            category: a.category,
            description: a.description,
            verification_status: a.verification_status
          }));
          const { error } = await supabase.from("awards").insert(awardsToInsert);
          if (!error) awardsImported = awardsToInsert.length;
        }
        
        // Transfer press links to current user
        if (pressRes.data && pressRes.data.length > 0) {
          const pressToInsert = pressRes.data.map(p => ({
            user_id: userId,
            title: p.title,
            url: p.url,
            publication: p.publication,
            published_date: p.published_date
          }));
          await supabase.from("press_links").insert(pressToInsert);
        }

        // Update user's profile with unclaimed data
        await supabase
          .from("profiles")
          .update({
            bio: unclaimedData.bio || undefined,
            avatar_url: unclaimedData.avatar_url || undefined,
            location: unclaimedData.location || undefined,
            professional_skills: unclaimedData.professional_skills || undefined,
          })
          .eq("user_id", userId);

        // Mark unclaimed as claimed + set industry tier (server-side)
        await supabase.rpc("finalize_unclaimed_profile_claim" as any, {
          p_unclaimed_user_id: unclaimedMatch.user_id,
        });
      }

      // Determine if we have enough data to fast-track
      const hasSufficientBio = bio.length >= 20;
      const hasWorkContent = creditsImported > 0 || awardsImported > 0;
      const canFastTrack = hasSufficientBio && hasWorkContent;

      toast.success(`Profile claimed! ${creditsImported} credits, ${awardsImported} awards merged.`);
      onComplete({ 
        claimed: true, 
        unclaimedProfile: unclaimedMatch,
        creditsImported,
        awardsImported,
        canFastTrack,
        bio
      });

    } catch (error) {
      console.error("Claim error:", error);
      toast.error("Claim failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const getPlatformIcon = (url: string) => {
    if (url.includes("spotify") || url.includes("discogs") || url.includes("musicbrainz")) {
      return <Music className="h-4 w-4" />;
    }
    if (url.includes("imdb") || url.includes("youtube")) {
      return <Film className="h-4 w-4" />;
    }
    if (url.includes("behance") || url.includes("dribbble") || url.includes("artstation")) {
      return <Palette className="h-4 w-4" />;
    }
    return <Link2 className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Let AI Find Your Work</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          We'll search the web to auto-import your credits, awards, and press. 
          This is a Pro feature - free during your trial!
        </p>
      </div>

      {/* Search Form */}
      <Card className="p-4 space-y-4 bg-card/50 border-border/50">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Professional Name</label>
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Enter your name as it appears professionally"
            className="text-lg"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Platform URL (Optional - helps us find you)
          </label>
          <Input
            value={platformUrl}
            onChange={(e) => setPlatformUrl(e.target.value)}
            placeholder="e.g., spotify.com/artist/..., imdb.com/name/..."
          />
          <p className="text-xs text-muted-foreground">
            Paste your Spotify, IMDb, Behance, SoundCloud, or YouTube URL
          </p>
        </div>

        <Button 
          onClick={handleSearch} 
          disabled={isSearching}
          className="w-full"
          size="lg"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Searching the web...
            </>
          ) : (
            <>
              <Search className="mr-2 h-5 w-5" />
              Find My Professional Work
            </>
          )}
        </Button>
      </Card>

      {/* Unclaimed Profile Match */}
      {unclaimedMatch && (
        <Card className="p-4 border-primary/50 bg-primary/5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 border-2 border-primary">
              <AvatarImage src={unclaimedMatch.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10">
                {unclaimedMatch.full_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{unclaimedMatch.full_name}</h3>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Pre-seeded Profile
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{unclaimedMatch.role}</p>
              {unclaimedMatch.bio && (
                <p className="text-sm mt-1 line-clamp-2">{unclaimedMatch.bio}</p>
              )}
            </div>
            <Button 
              onClick={handleClaimProfile}
              disabled={isImporting}
              className="shrink-0"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim This Profile"}
            </Button>
          </div>
        </Card>
      )}

      {/* Discovered Profiles */}
      {discoveredProfiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Found Professional Profiles
          </h3>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {discoveredProfiles.map((profile, idx) => (
                <Card 
                  key={idx}
                  className={`p-4 cursor-pointer transition-all hover:border-primary/50 ${
                    selectedProfile === profile ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => handleSelectProfile(profile)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={profile.imageUrl || ""} />
                      <AvatarFallback>
                        <User className="h-6 w-6 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{profile.name}</h4>
                        {profile.confidence >= 80 && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
                            High Match
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.role}</p>
                      {profile.bio && (
                        <p className="text-sm mt-1 line-clamp-2">{profile.bio}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getPlatformIcon(profile.sourceUrl)}
                          Source
                        </span>
                        {profile.credits && profile.credits.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Film className="h-3 w-3" />
                            {profile.credits.length} credits
                          </span>
                        )}
                        {profile.awards && profile.awards.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Award className="h-3 w-3" />
                            {profile.awards.length} awards
                          </span>
                        )}
                        {profile.skills && profile.skills.length > 0 && (
                          <span>{profile.skills.length} skills</span>
                        )}
                      </div>
                    </div>
                    {selectedProfile === profile && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* No Results + Retry */}
      {showRetry && (
        <Card className="p-6 text-center space-y-4 border-dashed">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-medium">No professional profiles found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adding a direct link to your Spotify, IMDb, Behance, or YouTube profile
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setShowRetry(false)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Skip for Now
            </Button>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      {(selectedProfile || searchComplete) && (
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          {selectedProfile && (
            <Button 
              className="flex-1 order-1 sm:order-2"
              onClick={handleImportSelected}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Import This Profile
                </>
              )}
            </Button>
          )}
          <Button 
            variant="outline" 
            className="flex-1 order-2 sm:order-1"
            onClick={onSkip}
          >
            Skip & Add Manually Later
          </Button>
        </div>
      )}

      {/* Initial Skip Option */}
      {!searchComplete && (
        <div className="text-center">
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            Skip - I'll add my work manually
          </Button>
        </div>
      )}
    </div>
  );
};
