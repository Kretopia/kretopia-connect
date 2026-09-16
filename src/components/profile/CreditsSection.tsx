import { useState, useEffect } from "react";
import { extractThumbnailForStorage } from "@/lib/thumbnailExtractor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AchievementCard } from "./AchievementCard";
import { CreditEndorsementDialog } from "./CreditEndorsementDialog";
import { MediaPlayerModal } from "./MediaPlayerModal";
import { getBestPlayableMediaUrl, getModalMediaType } from "@/lib/mediaUtils";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Credit {
  id: string;
  project_name: string;
  role: string;
  year: number;
  platform?: string;
  url?: string;
  primary_media_url?: string | null;
  media_type?: string | null;
  thumbnail_url?: string;
  verification_status?: "unverified" | "pending" | "verified";
  endorsement_count?: number;
  source?: string | null;
  verified_by_name?: string | null;
  is_featured?: boolean;
  credit_category?: string;
  project_type?: string;
}

interface CreditsSectionProps {
  userId: string;
  isOwnProfile: boolean;
  onRefresh: () => void;
}

export const CreditsSection = ({ userId, isOwnProfile, onRefresh }: CreditsSectionProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const navigate = useNavigate();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [endorsementCredit, setEndorsementCredit] = useState<Credit | null>(null);
  const [mediaCredit, setMediaCredit] = useState<Credit | null>(null);
  const [newCredit, setNewCredit] = useState({
    project_name: "",
    role: "",
    year: new Date().getFullYear(),
    platform: "",
    url: "",
    credit_type: "",
  });
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    fetchCredits();
  }, [userId]);

  const fetchCredits = async () => {
    try {
      const { data, error } = await supabase
        .from("credits")
        .select("*")
        .eq("user_id", userId)
        .order("year", { ascending: false });

      if (error) throw error;
      setCredits((data || []) as Credit[]);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast.error("Failed to load credits");
    } finally {
      setLoading(false);
    }
  };

  const addCredit = async () => {
    if (!newCredit.project_name || !newCredit.role || !newCredit.year) {
      toast.error("Please fill in project name, role, and year");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const extractedThumb = extractThumbnailForStorage(newCredit.url || null);
      const { data: insertedData, error } = await supabase.from("credits").insert({
        user_id: user.id,
        ...newCredit,
        thumbnail_url: extractedThumb,
      }).select().single();

      if (error) throw error;

      toast.success("Credit added successfully");

      // Trigger AI verification in background
      if (insertedData) {
        supabase.functions.invoke('verify-credit', {
          body: {
            credit_id: insertedData.id,
            project_name: newCredit.project_name,
            role: newCredit.role,
            year: newCredit.year,
            platform: newCredit.platform,
          },
        }).catch(err => console.log('AI verification queued:', err));
      }

      setNewCredit({
        project_name: "",
        role: "",
        year: new Date().getFullYear(),
        platform: "",
        url: "",
        credit_type: "",
      });
      fetchCredits();
      onRefresh();
    } catch (error) {
      console.error("Error adding credit:", error);
      toast.error("Failed to add credit");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("credits").delete().eq("id", id);
      if (error) throw error;

      toast.success("Credit deleted");
      fetchCredits();
      onRefresh();
    } catch (error) {
      console.error("Error deleting credit:", error);
      toast.error("Failed to delete credit");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading credits...</div>;
  }

  if (credits.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Credits</h3>
        {isOwnProfile && (
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Credit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Credit</DialogTitle>
                <DialogDescription>Add your project credits and professional work</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">Project Name *</Label>
                    <Input
                      id="project"
                      value={newCredit.project_name}
                      onChange={(e) => setNewCredit({ ...newCredit, project_name: e.target.value })}
                      placeholder="e.g., Romeo & Juliet, Coca-Cola Ad"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creditType">Type</Label>
                    <Select value={newCredit.credit_type} onValueChange={(v) => setNewCredit({ ...newCredit, credit_type: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Film & TV</SelectLabel>
                          <SelectItem value="film">Film / Movie</SelectItem>
                          <SelectItem value="tv">TV Show / Series</SelectItem>
                          <SelectItem value="short_film">Short Film</SelectItem>
                          <SelectItem value="documentary">Documentary</SelectItem>
                          <SelectItem value="music_video">Music Video</SelectItem>
                          <SelectItem value="web_series">Web Series</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Music & Audio</SelectLabel>
                          <SelectItem value="album">Album</SelectItem>
                          <SelectItem value="single">Single / Track</SelectItem>
                          <SelectItem value="ep">EP</SelectItem>
                          <SelectItem value="mixtape">Mixtape</SelectItem>
                          <SelectItem value="podcast">Podcast</SelectItem>
                          <SelectItem value="audiobook">Audiobook</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Performing Arts</SelectLabel>
                          <SelectItem value="theatre">Theatre / Play</SelectItem>
                          <SelectItem value="musical">Musical Theatre</SelectItem>
                          <SelectItem value="dance">Dance Performance</SelectItem>
                          <SelectItem value="comedy">Stand-up / Comedy</SelectItem>
                          <SelectItem value="spoken_word">Spoken Word / Poetry</SelectItem>
                          <SelectItem value="pantomime">Pantomime</SelectItem>
                          <SelectItem value="recital">Recital</SelectItem>
                          <SelectItem value="opera">Opera</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Events & Productions</SelectLabel>
                          <SelectItem value="live_event">Live Event</SelectItem>
                          <SelectItem value="concert">Concert</SelectItem>
                          <SelectItem value="festival">Festival</SelectItem>
                          <SelectItem value="carnival">Carnival / Mas</SelectItem>
                          <SelectItem value="pageant">Pageant</SelectItem>
                          <SelectItem value="fashion_show">Fashion Show</SelectItem>
                          <SelectItem value="awards_show">Awards Show / Ceremony</SelectItem>
                          <SelectItem value="exhibition">Exhibition / Gallery Show</SelectItem>
                          <SelectItem value="conference">Conference / Summit</SelectItem>
                          <SelectItem value="launch_event">Launch Event</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Content & Digital</SelectLabel>
                          <SelectItem value="youtube_series">YouTube Series</SelectItem>
                          <SelectItem value="ugc_campaign">UGC Campaign</SelectItem>
                          <SelectItem value="livestream">Livestream</SelectItem>
                          <SelectItem value="online_course">Online Course</SelectItem>
                          <SelectItem value="workshop">Workshop / Masterclass</SelectItem>
                          <SelectItem value="newsletter">Newsletter / Publication</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Commercial & Corporate</SelectLabel>
                          <SelectItem value="commercial">TV / Radio Ad</SelectItem>
                          <SelectItem value="brand_campaign">Brand Campaign</SelectItem>
                          <SelectItem value="corporate">Corporate Event / Video</SelectItem>
                          <SelectItem value="hosting">MC / Hosting</SelectItem>
                          <SelectItem value="voiceover">Voiceover</SelectItem>
                          <SelectItem value="influencer_campaign">Influencer Campaign</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Business & Industry</SelectLabel>
                          <SelectItem value="ar_project">A&R Project</SelectItem>
                          <SelectItem value="talent_management">Talent Management</SelectItem>
                          <SelectItem value="booking">Booking / Representation</SelectItem>
                          <SelectItem value="label_release">Label Release</SelectItem>
                          <SelectItem value="publishing">Publishing Deal</SelectItem>
                          <SelectItem value="curation">Curation / Programming</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Input
                      id="role"
                      value={newCredit.role}
                      onChange={(e) => setNewCredit({ ...newCredit, role: e.target.value })}
                      placeholder="e.g., Lead Actor, Director, MC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      value={newCredit.year}
                      onChange={(e) => setNewCredit({ ...newCredit, year: parseInt(e.target.value) })}
                      placeholder="e.g., 2023"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform">Venue / Platform</Label>
                    <Input
                      id="platform"
                      value={newCredit.platform}
                      onChange={(e) => setNewCredit({ ...newCredit, platform: e.target.value })}
                      placeholder="e.g., Queen's Hall, Netflix, NAPA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={newCredit.url}
                      onChange={(e) => setNewCredit({ ...newCredit, url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                
                <Button onClick={addCredit} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Credit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {credits.length === 0 ? (
        isOwnProfile ? (
          <EmptyState
            icon={Film}
            eyebrow="Your creative CV"
            title="Your creative CV starts here"
            description="Add your first credit and start building your verified record."
            action={{ label: "Add Credit", icon: Plus, onClick: () => setIsEditOpen(true) }}
          />
        ) : (
          <EmptyState
            icon={Film}
            title="No public credits"
            description="This creator hasn't published any verified work yet."
          />
        )
      ) : (
        <div className="relative">
          <Carousel
            setApi={setCarouselApi}
            opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }}
            className="w-full"
            aria-label="Stamps"
          >
            <CarouselContent className="-ml-4">
              {credits.map((credit) => {
                const playableUrl = getBestPlayableMediaUrl(credit);
                return (
                  <CarouselItem key={credit.id} className="pl-4 basis-auto">
                    <div className="w-72">
                      <AchievementCard
                        variant="credit"
                        title={credit.project_name}
                        subtitle={credit.role}
                        year={credit.year}
                        url={credit.url}
                        imageUrl={credit.thumbnail_url}
                        verificationStatus={credit.verification_status}
                        endorsementCount={credit.endorsement_count || 0}
                        source={credit.source}
                        verifiedByName={credit.verified_by_name}
                        isFeatured={credit.is_featured}
                        isOwnProfile={isOwnProfile}
                        onDelete={() => handleDelete(credit.id)}
                        onRequestEndorsement={() => setEndorsementCredit(credit)}
                        onCardClick={playableUrl ? () => setMediaCredit(credit) : undefined}
                        icon={<Film className="h-16 w-16" />}
                        metadata={credit.platform ? { Platform: credit.platform } : undefined}
                        category={credit.credit_category || credit.project_type}
                      />
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            {credits.length > 2 && (
              <>
                <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label="Previous — stamps" />
                <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label="Next — stamps" />
              </>
            )}
          </Carousel>
          {credits.length > 1 && <CarouselPositionDots api={carouselApi} label="Stamps" className="mt-2" />}
        </div>
      )}

      {endorsementCredit && (
        <CreditEndorsementDialog
          open={!!endorsementCredit}
          onOpenChange={(open) => !open && setEndorsementCredit(null)}
          credit={endorsementCredit}
          userId={userId}
        />
      )}

      <MediaPlayerModal
        isOpen={!!mediaCredit}
        onClose={() => setMediaCredit(null)}
        item={mediaCredit && getBestPlayableMediaUrl(mediaCredit) ? (() => {
          const mediaUrl = getBestPlayableMediaUrl(mediaCredit)!;
          return {
            title: mediaCredit.project_name,
            description: mediaCredit.role,
            media_type: getModalMediaType(mediaUrl, mediaCredit.media_type),
            media_url: mediaUrl,
            thumbnail_url: mediaCredit.thumbnail_url,
          };
        })() : null}
      />
    </div>
  );
};
