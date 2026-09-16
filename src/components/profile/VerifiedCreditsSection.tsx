import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Film, Tv, Music, Disc3, Video, ExternalLink, CheckCircle2,
  ChevronLeft, ChevronRight, Loader2, Trash2, Mic2, Drama,
  PersonStanding, CalendarDays, Sparkles, Crown, Shirt,
  Megaphone, Briefcase,
} from "lucide-react";
import { CreditCoverPlaceholder } from "./CreditCoverPlaceholder";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { cn } from "@/lib/utils";

interface VerifiedCredit {
  id: string;
  source: string;
  source_id: string;
  credit_type: string;
  title: string;
  role: string;
  year: number | null;
  metadata: any;
  verification_url: string;
  verified_at: string;
  thumbnail_url?: string | null;
  primary_media_url?: string | null;
  url?: string | null;
}

interface VerifiedCreditsSectionProps {
  userId: string;
  isOwnProfile?: boolean;
  onCreditsChanged?: () => void;
}

const CREDIT_TYPE_ICONS: Record<string, any> = {
  film: Film, movie: Film, short_film: Film, documentary: Film,
  tv: Tv, album: Disc3, single: Music, ep: Music, mixtape: Music,
  music_video: Video, web_series: Video, podcast: Mic2, episode: Mic2,
  audiobook: Mic2, theatre: Drama, theater: Drama, stage: Drama,
  play: Drama, musical: Drama, pantomime: Drama, opera: Drama,
  spoken_word: Mic2, comedy: Drama, dance: PersonStanding,
  recital: PersonStanding, live_event: CalendarDays, concert: Music,
  festival: CalendarDays, carnival: Sparkles, pageant: Crown,
  fashion_show: Shirt, awards_show: Crown, exhibition: Sparkles,
  conference: Briefcase, launch_event: CalendarDays,
  youtube_series: Video, ugc_campaign: Video, livestream: Video,
  online_course: Briefcase, workshop: Briefcase, newsletter: Briefcase,
  commercial: Megaphone, ad: Megaphone, corporate: Briefcase,
  hosting: Mic2, mc: Mic2, brand_campaign: Megaphone, voiceover: Mic2,
  influencer_campaign: Megaphone, ar_project: Briefcase,
  talent_management: Briefcase, booking: Briefcase, label_release: Disc3,
  publishing: Briefcase, curation: Sparkles,
};

const SOURCE_COLORS: Record<string, string> = {
  spotify: 'bg-green-500',
  youtube: 'bg-red-500',
  tmdb: 'bg-primary',
  imdb: 'bg-yellow-500',
  discogs: 'bg-orange-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  film: 'Film & TV',
  movie: 'Film & TV',
  short_film: 'Film & TV',
  documentary: 'Film & TV',
  tv: 'Film & TV',
  album: 'Music',
  single: 'Music',
  ep: 'Music',
  mixtape: 'Music',
  music_video: 'Music',
  concert: 'Music',
  label_release: 'Music',
  podcast: '🎙Audio',
  episode: '🎙Audio',
  audiobook: '🎙Audio',
  voiceover: '🎙Audio',
  theatre: 'Performing Arts',
  theater: 'Performing Arts',
  stage: 'Performing Arts',
  play: 'Performing Arts',
  musical: 'Performing Arts',
  comedy: 'Performing Arts',
  dance: 'Performing Arts',
  live_event: 'Events',
  festival: 'Events',
  carnival: 'Events',
  awards_show: 'Events',
  fashion_show: '👗 Fashion',
  commercial: 'Commercial',
  ad: 'Commercial',
  brand_campaign: 'Commercial',
  influencer_campaign: 'Commercial',
  ugc_campaign: 'Commercial',
  youtube_series: '📹 Digital',
  web_series: '📹 Digital',
  livestream: '📹 Digital',
};

function getCategoryLabel(type: string): string {
  return CATEGORY_LABELS[type] || 'Other';
}

// Netflix-style horizontal scroll row
function CreditRow({ 
  category, credits, isOwnProfile, onDelete, deletingId 
}: { 
  category: string; 
  credits: VerifiedCredit[];
  isOwnProfile?: boolean;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    return () => el?.removeEventListener('scroll', checkScroll);
  }, [credits]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{category}</h3>
        <span className="text-xs text-muted-foreground">{credits.length} credit{credits.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="relative group">
        {canScrollLeft && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth pb-2"
        >
          {credits.map((credit) => (
            <CreditCard
              key={credit.id}
              credit={credit}
              isOwnProfile={isOwnProfile}
              onDelete={() => onDelete(credit.id)}
              isDeleting={deletingId === credit.id}
            />
          ))}
        </div>
        {canScrollRight && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Individual credit card (poster-style)
function CreditCard({ credit, isOwnProfile, onDelete, isDeleting }: {
  credit: VerifiedCredit;
  isOwnProfile?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  const Icon = CREDIT_TYPE_ICONS[credit.credit_type] || Film;
  const sourceColor = SOURCE_COLORS[credit.source] || 'bg-gray-500';
  const thumbnailUrl = resolveCreditThumbnail(
    credit.thumbnail_url, 
    credit.primary_media_url, 
    credit.url
  ) || credit.metadata?.posterUrl || credit.metadata?.imageUrl || credit.metadata?.thumbUrl || credit.metadata?.thumbnailUrl;

  return (
    <div className="flex-shrink-0 w-[160px] group/card">
      <div className="relative rounded-lg overflow-hidden bg-muted border border-border/50 hover:border-primary/30 transition-all hover:shadow-md">
        {/* Poster / Thumbnail */}
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={credit.title}
            loading="lazy"
            className="w-full h-[220px] object-cover"
          />
        ) : (
          <CreditCoverPlaceholder
            category={credit.credit_type}
            title={credit.title}
            role={credit.role}
          />
        )}

        {/* Source badge */}
        <Badge 
          variant="outline" 
          className={cn(
            "absolute top-2 left-2 text-[8px] h-4 px-1.5 backdrop-blur-sm bg-background/70",
            sourceColor, "bg-opacity-10"
          )}
        >
          {credit.source.toUpperCase()}
        </Badge>

        {/* Actions overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
          {credit.verification_url && (
            <a href={credit.verification_url} target="_blank" rel="noopener noreferrer"
              className="h-6 w-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {isOwnProfile && onDelete && (
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="h-6 w-6 rounded-full bg-destructive/80 backdrop-blur-sm flex items-center justify-center hover:bg-destructive transition-colors text-destructive-foreground"
            >
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Info below poster */}
      <div className="pt-2 px-0.5">
        <h4 className="text-xs font-semibold truncate leading-tight">{credit.title}</h4>
        <p className="text-[10px] text-muted-foreground truncate">
          {credit.role}
          {credit.year && <span> • {credit.year}</span>}
        </p>
      </div>
    </div>
  );
}

export function VerifiedCreditsSection({ userId, isOwnProfile, onCreditsChanged }: VerifiedCreditsSectionProps) {
  const [credits, setCredits] = useState<VerifiedCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCredits();
  }, [userId]);

  const handleDeleteCredit = async (creditId: string) => {
    setDeletingId(creditId);
    try {
      const { error } = await supabase
        .from('credits')
        .delete()
        .eq('id', creditId)
        .eq('user_id', userId);

      if (error) throw error;

      setCredits(prev => prev.filter(c => c.id !== creditId));
      onCreditsChanged?.();
      toast({
        title: "Credit removed",
        description: "The credit has been removed from your profile",
      });
    } catch (error: any) {
      console.error('Error deleting credit:', error);
      toast({
        title: "Error",
        description: "Failed to remove credit",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const fetchCredits = async () => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', userId)
        .not('source', 'eq', 'manual')
        .order('year', { ascending: false, nullsFirst: false });

      if (error) throw error;
      const mapped: VerifiedCredit[] = (data || []).map((c: any) => ({
        id: c.id,
        source: c.source || c.platform || 'import',
        source_id: c.source_id || '',
        credit_type: c.credit_category || c.project_type || 'Other',
        title: c.project_name,
        role: c.role,
        year: c.year,
        metadata: c.metadata,
        verification_url: c.verification_url || c.url || '',
        verified_at: c.metadata?.verified_at || c.created_at,
        thumbnail_url: c.thumbnail_url,
        primary_media_url: c.primary_media_url,
        url: c.url,
      }));
      setCredits(mapped);
    } catch (error) {
      console.error('Error fetching verified credits:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card aria-busy="true" aria-label="Loading verified credits">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading credits...</p>
        </CardContent>
      </Card>
    );
  }

  if (credits.length === 0) {
    if (!isOwnProfile) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Kretopia Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No verified credits yet. Connect Spotify, YouTube, IMDB, or Discogs to import your work.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by category label for Netflix rows
  const grouped = credits.reduce((acc, credit) => {
    const cat = getCategoryLabel(credit.credit_type);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(credit);
    return acc;
  }, {} as Record<string, VerifiedCredit[]>);

  const categories = Object.keys(grouped);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Kretopia Credits
          <Badge variant="secondary" className="ml-2">
            {credits.length} verified
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {categories.map((cat) => (
          <CreditRow
            key={cat}
            category={cat}
            credits={grouped[cat]}
            isOwnProfile={isOwnProfile}
            onDelete={handleDeleteCredit}
            deletingId={deletingId}
          />
        ))}
      </CardContent>
    </Card>
  );
}
