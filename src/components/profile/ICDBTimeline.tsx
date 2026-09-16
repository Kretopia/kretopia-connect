import { useState, useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Film, Tv, Music, Disc3, Video, Mic2, CalendarDays, Sparkles, Crown,
  Shirt, Megaphone, Briefcase, ShieldCheck, Loader2,
  Plus, Trash2, Play, UserPlus, ChevronLeft, ChevronRight, Pencil,
  Youtube, Headphones, Image as ImageIcon, Upload, CheckSquare, Square, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ICDBCreditForm } from "./ICDBCreditForm";
import { CreditEndorsementDialog } from "./CreditEndorsementDialog";
import { getBestPlayableMediaUrl, getModalMediaType, parseMediaUrl } from "@/lib/mediaUtils";
import { MediaPlayerModal } from "./MediaPlayerModal";
import { extractThumbnailFromUrl } from "@/lib/thumbnailExtractor";

interface ICDBCredit {
  id: string;
  project_name: string;
  role: string;
  year: number | null;
  project_type: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  platform: string | null;
  url: string | null;
  client_brand: string | null;
  thumbnail_url: string | null;
  verification_status: string | null;
  endorsement_count: number;
  collaborator_user_ids: string[] | null;
  ai_confidence: number | null;
  credit_category: string | null;
  is_featured: boolean | null;
  source: string;
  media_type: string | null;
  primary_media_url: string | null;
  tags: string[] | null;
}

interface CollaboratorProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

const TYPE_ICONS: Record<string, any> = {
  film: Film, movie: Film, short_film: Film, documentary: Film, tv: Tv, web_series: Tv,
  album: Disc3, single: Music, ep: Music, music_video: Video, podcast: Mic2,
  soca: Music, dancehall: Music, afrobeats: Music, gospel_concert: Music, audiobook: Mic2,
  theatre: Film, musical: Film, dance: Film, comedy: Film, opera: Film,
  choreography: Film, backup_dancer: Film, spoken_word: Mic2,
  live_event: CalendarDays, concert: Music, festival: CalendarDays, tour: Music,
  carnival: Sparkles, pageant: Crown, fashion_show: Shirt, awards_show: Crown,
  exhibition: Sparkles, conference: Briefcase, dj_set: Headphones, mc_hosting: Mic2,
  youtube_series: Video, ugc_campaign: Video, livestream: Video,
  commercial: Megaphone, brand_campaign: Megaphone, corporate: Briefcase,
  voiceover: Mic2, influencer_campaign: Video, talent_management: Briefcase,
  booking: Briefcase, label_release: Disc3, publishing: Briefcase, curation: Sparkles,
  art_exhibition: Sparkles, photography: Film, animation: Video,
  fashion_collection: Shirt, editorial_shoot: Film, runway: Shirt,
  styling: Shirt, beauty_campaign: Megaphone, mural: Sparkles,
  graphic_design: Sparkles, online_course: Briefcase, workshop: Briefcase,
};

const CATEGORY_META: Record<string, { label: string; icon: any }> = {
  film_tv: { label: "Film & TV", icon: Film },
  music: { label: "Music", icon: Music },
  events: { label: "Events & Productions", icon: CalendarDays },
  performing: { label: "Performing Arts", icon: Mic2 },
  digital: { label: "Content & Digital", icon: Video },
  commercial: { label: "Commercial", icon: Megaphone },
  fashion: { label: "Fashion & Beauty", icon: Shirt },
  art: { label: "Art & Design", icon: Sparkles },
  business: { label: "Business", icon: Briefcase },
  other: { label: "Other Work", icon: Film },
};

const TYPE_TO_CATEGORY: Record<string, string> = {
  film: "film_tv", movie: "film_tv", tv: "film_tv", short_film: "film_tv", documentary: "film_tv", music_video: "film_tv", web_series: "film_tv",
  album: "music", single: "music", ep: "music", soca: "music", dancehall: "music", afrobeats: "music", gospel_concert: "music", audiobook: "music",
  theatre: "performing", musical: "performing", dance: "performing", comedy: "performing", spoken_word: "performing", opera: "performing", choreography: "performing", backup_dancer: "performing",
  live_event: "events", concert: "events", festival: "events", carnival: "events", pageant: "events", fashion_show: "events", awards_show: "events", exhibition: "events", conference: "events", tour: "events", dj_set: "events", mc_hosting: "events", event: "events", promo: "events", after_movie: "events",
  podcast: "digital", youtube_series: "digital", ugc_campaign: "digital", livestream: "digital", online_course: "digital", workshop: "digital",
  commercial: "commercial", brand_campaign: "commercial", corporate: "commercial", voiceover: "commercial", influencer_campaign: "commercial",
  art_exhibition: "art", mural: "art", graphic_design: "art", photography: "art", animation: "art",
  fashion_collection: "fashion", editorial_shoot: "fashion", runway: "fashion", beauty_campaign: "fashion", styling: "fashion",
  talent_management: "business", booking: "business", label_release: "business", publishing: "business", curation: "business",
  // Direct category keys (for manual overrides)
  film_tv: "film_tv", music: "music", events: "events", performing: "performing", digital: "digital",
  art: "art", fashion: "fashion", business: "business", other: "other",
};

// Source-based category inference when type is missing
const SOURCE_TO_CATEGORY: Record<string, string> = {
  spotify: "music", musicbrainz: "music", discogs: "music", soundcloud: "music",
  tmdb: "film_tv", imdb: "film_tv",
  youtube: "digital", vimeo: "digital", tiktok: "digital",
  behance: "art", dribbble: "art",
};

function resolveCategory(credit: { project_type: string | null; credit_category: string | null; source: string; role?: string; project_name?: string }): string {
  // Manual override: if credit_category is a direct group key, use it
  if (credit.credit_category && Object.keys(CATEGORY_META).includes(credit.credit_category)) return credit.credit_category;
  // Try credit_category as a type
  if (credit.credit_category && TYPE_TO_CATEGORY[credit.credit_category]) return TYPE_TO_CATEGORY[credit.credit_category];
  // Try project_type
  if (credit.project_type && TYPE_TO_CATEGORY[credit.project_type]) return TYPE_TO_CATEGORY[credit.project_type];
  // Infer from role keywords before falling back to source
  const roleLower = (credit.role || '').toLowerCase();
  const nameLower = (credit.project_name || '').toLowerCase();
  if (roleLower.includes('podcast') || nameLower.includes('podcast')) return "digital";
  if (roleLower.includes('host') && nameLower.includes('podcast')) return "digital";
  if (roleLower.includes('dancer') || roleLower.includes('choreograph')) return "performing";
  if (roleLower.includes('fashion') || roleLower.includes('model') || roleLower.includes('stylist')) return "fashion";
  if (roleLower.includes('theatre') || roleLower.includes('theater') || roleLower.includes('actor') || roleLower.includes('actress')) return "performing";
  // Infer from source
  if (credit.source && SOURCE_TO_CATEGORY[credit.source]) return SOURCE_TO_CATEGORY[credit.source];
  return "other";
}

// Edit form project types for the select dropdown
const EDIT_PROJECT_TYPES = [
  { group: "Film & TV", items: [
    { value: "film", label: "Film / Movie" }, { value: "tv", label: "TV Show / Series" },
    { value: "documentary", label: "Documentary" }, { value: "music_video", label: "Music Video" },
  ]},
  { group: "Music & Audio", items: [
    { value: "album", label: "Album" }, { value: "single", label: "Single / Track" },
    { value: "ep", label: "EP" }, { value: "podcast", label: "Podcast" },
  ]},
  { group: "Events & Productions", items: [
    { value: "live_event", label: "Live Event" }, { value: "concert", label: "Concert" },
    { value: "festival", label: "Festival" }, { value: "carnival", label: "Carnival / Mas" },
    { value: "fashion_show", label: "Fashion Show" },
  ]},
  { group: "Content & Digital", items: [
    { value: "youtube_series", label: "YouTube Series" }, { value: "livestream", label: "Livestream" },
  ]},
  { group: "Commercial", items: [
    { value: "commercial", label: "TV / Radio Ad" }, { value: "brand_campaign", label: "Brand Campaign" },
  ]},
  { group: "Art & Design", items: [
    { value: "photography", label: "Photography" }, { value: "animation", label: "Animation" },
  ]},
  { group: "Fashion & Beauty", items: [
    { value: "editorial_shoot", label: "Editorial Shoot" }, { value: "runway", label: "Runway Show" },
  ]},
  { group: "Performing Arts", items: [
    { value: "theatre", label: "Theatre / Play" }, { value: "dance", label: "Dance Performance" },
  ]},
];

const POSTER_GRADIENTS = [
  "from-rose-950 via-rose-900/70 to-black",
  "from-primary via-primary/70 to-black",
  "from-amber-950 via-amber-900/70 to-black",
  "from-emerald-950 via-teal-900/70 to-black",
  "from-primary via-primary/70 to-black",
  "from-primary via-primary/70 to-black",
  "from-pink-950 via-fuchsia-900/70 to-black",
  "from-slate-900 via-zinc-800/70 to-black",
];

const getMediaType = (credit: ICDBCredit): 'video' | 'audio' | 'image' | 'link' | null => {
  if (credit.media_type) {
    if (['video', 'audio', 'image'].includes(credit.media_type)) return credit.media_type as any;
  }
  if (!credit.url) return null;
  const mediaInfo = parseMediaUrl(credit.url);
  if (mediaInfo) {
    if (['youtube', 'vimeo', 'tiktok', 'instagram'].includes(mediaInfo.platform)) return 'video';
    if (['spotify', 'soundcloud'].includes(mediaInfo.platform)) return 'audio';
  }
  const type = credit.project_type || credit.credit_category || '';
  if (['album', 'single', 'ep', 'podcast'].includes(type)) return 'audio';
  if (['film', 'tv', 'short_film', 'documentary', 'music_video', 'youtube_series'].includes(type)) return 'video';
  if (['photography', 'art_exhibition', 'graphic_design', 'editorial_shoot'].includes(type)) return 'image';
  return credit.url ? 'link' : null;
};

const getPlatformIcon = (platform: string | null) => {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes('youtube')) return <Youtube className="h-3 w-3 text-red-500" />;
  if (p.includes('spotify')) return <Headphones className="h-3 w-3 text-green-500" />;
  if (p.includes('vimeo')) return <Video className="h-3 w-3 text-primary" />;
  if (p.includes('soundcloud')) return <Music className="h-3 w-3 text-orange-500" />;
  if (p.includes('behance')) return <ImageIcon className="h-3 w-3 text-primary" />;
  if (p.includes('imdb')) return <Film className="h-3 w-3 text-amber-500" />;
  if (p.includes('tiktok')) return <Video className="h-3 w-3 text-foreground" />;
  if (p.includes('netflix')) return <Tv className="h-3 w-3 text-red-600" />;
  return null;
};

// Horizontal scroll row component
function CategoryRow({ 
  category, credits, isOwnProfile, onDelete, onEndorse, onPlay, onEdit, collaboratorProfiles, deletingId,
  bulkSelectMode, selectedIds, onToggleSelect,
}: {
  category: string;
  credits: ICDBCredit[];
  isOwnProfile: boolean;
  onDelete: (id: string, source: string) => void;
  onEndorse: (credit: any) => void;
  onPlay: (credit: ICDBCredit) => void;
  onEdit: (credit: ICDBCredit) => void;
  collaboratorProfiles: Map<string, CollaboratorProfile>;
  deletingId: string | null;
  bulkSelectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const navigate = useNavigate();

  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  const CatIcon = meta.icon;

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el?.removeEventListener('scroll', checkScroll);
  }, [credits]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  const getCreditThumbnail = (credit: ICDBCredit): string | null => {
    if (credit.thumbnail_url) return credit.thumbnail_url;
    if (credit.primary_media_url) {
      // Check if it's a direct image or extractable URL
      const extracted = extractThumbnailFromUrl(credit.primary_media_url);
      if (extracted) return extracted;
      // If it looks like an image URL, use it directly
      if (/\.(jpg|jpeg|png|webp|gif)/i.test(credit.primary_media_url)) return credit.primary_media_url;
    }
    if (credit.url) {
      const extracted = extractThumbnailFromUrl(credit.url);
      if (extracted) return extracted;
      const mediaInfo = parseMediaUrl(credit.url);
      if (mediaInfo?.thumbnailUrl) return mediaInfo.thumbnailUrl;
    }
    return null;
  };

  const getVerificationBadge = (credit: ICDBCredit) => {
    if (credit.verification_status === 'verified') {
      return (
        <Badge variant="outline" className="text-[9px] gap-0.5 border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/5 h-4 px-1">
          <ShieldCheck className="h-2.5 w-2.5" />
          Verified
        </Badge>
      );
    }
    if ((credit.ai_confidence || 0) >= 0.7) {
      // This is Kreto's background plausibility guess (verify-credit), not a
      // real verification — no human, co-sign, or authoritative source has
      // confirmed it. Labeling it "Verified" here directly contradicted the
      // policy already correctly enforced elsewhere (DiscoveriesInbox.tsx,
      // CreatorEPK.tsx's "AI" tier): AI must never silently verify a
      // contribution. Match the "AI" label used by CreatorEPK.tsx instead.
      return (
        <Badge variant="outline" className="text-[9px] gap-0.5 border-primary/30 text-primary dark:text-primary bg-primary/5 h-4 px-1">
          <Sparkles className="h-2.5 w-2.5" />
          AI
        </Badge>
      );
    }
    if (credit.endorsement_count > 0) {
      return (
        <Badge variant="outline" className="text-[9px] gap-0.5 border-accent/40 text-accent-foreground bg-accent/10 h-4 px-1">
          {credit.endorsement_count} vouched
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-2">
      {/* Category header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <CatIcon className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{meta.label}</h4>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{credits.length}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {canScrollLeft && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll('left')}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          {canScrollRight && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => scroll('right')}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {credits.map((credit, idx) => {
          const Icon = TYPE_ICONS[credit.project_type || credit.credit_category || ''] || Film;
          const collabs = credit.collaborator_user_ids?.map(id => collaboratorProfiles.get(id)).filter(Boolean) as CollaboratorProfile[] | undefined;
          const thumbnail = getCreditThumbnail(credit);
          const gradientIdx = idx % POSTER_GRADIENTS.length;
          const platformIcon = getPlatformIcon(credit.platform);
          const mediaType = getMediaType(credit);
          const playableUrl = getBestPlayableMediaUrl(credit);

          return (
            <div
              key={credit.id}
              className={cn(
                "group relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.03] hover:shadow-xl shrink-0",
                bulkSelectMode && selectedIds?.has(credit.id) && "ring-2 ring-primary"
              )}
              style={{ width: "140px", aspectRatio: "2/3" }}
              onClick={() => {
                if (bulkSelectMode && onToggleSelect) {
                  onToggleSelect(credit.id);
                } else {
                  if (playableUrl) onPlay(credit);
                  else navigate(`/production?name=${encodeURIComponent(credit.project_name)}`);
                }
              }}
            >
              {/* Bulk select checkbox */}
              {bulkSelectMode && (
                <div className="absolute top-1.5 right-1.5 z-20">
                  <div className={cn(
                    "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                    selectedIds?.has(credit.id) ? "bg-primary border-primary text-primary-foreground" : "border-white/70 bg-black/40"
                  )}>
                    {selectedIds?.has(credit.id) && <CheckSquare className="h-3.5 w-3.5" />}
                  </div>
                </div>
              )}
              {/* Poster background */}
              {thumbnail ? (
                <img src={thumbnail} alt={credit.project_name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className={cn("absolute inset-0 bg-gradient-to-b", POSTER_GRADIENTS[gradientIdx])}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                    <Icon className="h-6 w-6 text-white/15 mb-1" />
                    <h3 className="text-white/70 font-black text-[11px] leading-tight tracking-tight line-clamp-3 uppercase">
                      {credit.project_name}
                    </h3>
                  </div>
                </div>
              )}

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

              {/* Top badges */}
              <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-0.5">
                {getVerificationBadge(credit)}
                {platformIcon && (
                  <div className="rounded-full bg-black/60 p-1">
                    {platformIcon}
                  </div>
                )}
              </div>

              {/* Play button */}
              {(playableUrl || mediaType === 'video' || mediaType === 'audio') && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <Play className="h-5 w-5 text-foreground ml-0.5" />
                  </div>
                </div>
              )}

              {/* Type icon for no-thumbnail */}
              {!thumbnail && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Icon className="h-8 w-8 text-white/25" />
                </div>
              )}

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-2 space-y-0.5">
                <h4 className="font-bold text-white text-xs leading-tight line-clamp-2 drop-shadow-md">
                  {credit.project_name}
                </h4>
                <p className="text-white/80 text-[10px] font-medium truncate">
                  {credit.role}
                </p>
                <div className="flex items-center gap-1 text-white/50 text-[9px]">
                  {credit.year && <span>{credit.year}</span>}
                  {credit.client_brand && (
                    <>
                      <span>·</span>
                      <span className="truncate">{credit.client_brand}</span>
                    </>
                  )}
                </div>

                {/* Collaborator avatars */}
                {collabs && collabs.length > 0 && (
                  <div className="flex -space-x-1.5 pt-0.5">
                    {collabs.slice(0, 3).map(c => (
                      <Avatar
                        key={c.user_id}
                        className="h-4 w-4 border border-black/50"
                        onClick={(e) => { e.stopPropagation(); navigate(`/profile/${c.user_id}`); }}
                      >
                        <AvatarImage src={c.avatar_url || ''} />
                        <AvatarFallback className="text-[6px] bg-muted">{c.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                    ))}
                    {collabs.length > 3 && (
                      <span className="text-white/40 text-[8px] pl-1">+{collabs.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Owner actions - always visible on mobile, hover on desktop */}
              {isOwnProfile && !bulkSelectMode && (
                <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary" size="icon"
                    className="h-6 w-6 bg-black/60 text-white border-0 hover:bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); onEdit(credit); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {credit.source !== 'verified' && (
                    <Button
                      variant="secondary" size="icon"
                      className="h-6 w-6 bg-black/50 text-white border-0 backdrop-blur-sm hover:bg-destructive/80"
                      disabled={deletingId === credit.id}
                      onClick={(e) => { e.stopPropagation(); onDelete(credit.id, credit.source); }}
                    >
                      {deletingId === credit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ICDBTimelineProps {
  userId: string;
  isOwnProfile: boolean;
  onRefresh?: () => void;
}

export function ICDBTimeline({ userId, isOwnProfile, onRefresh }: ICDBTimelineProps) {
  const navigate = useNavigate();
  const [credits, setCredits] = useState<ICDBCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [endorsementCredit, setEndorsementCredit] = useState<any>(null);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<Map<string, CollaboratorProfile>>(new Map());
  const [activeMedia, setActiveMedia] = useState<ICDBCredit | null>(null);
  const [editingCredit, setEditingCredit] = useState<ICDBCredit | null>(null);
  const [editForm, setEditForm] = useState({ project_name: "", role: "", year: new Date().getFullYear(), platform: "", url: "", project_type: "", section_override: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [fetchingArt, setFetchingArt] = useState(false);

  useEffect(() => { fetchData(); }, [userId]);

  const handleFetchCoverArt = async () => {
    setFetchingArt(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }

      const missingCount = credits.filter(c => !c.thumbnail_url && !c.primary_media_url).length;
      if (missingCount === 0) { toast.info("All credits already have cover art!"); return; }

      const { data, error } = await supabase.functions.invoke('backfill-credit-media', {
        body: { user_id: userId, batch_size: 50 },
      });

      if (error) throw error;
      if (data?.updated > 0) {
        toast.success(`Found cover art for ${data.updated} credits!`);
        fetchData();
      } else {
        toast.info("No additional cover art found from external sources");
      }
    } catch (err) {
      console.error("Cover art fetch error:", err);
      toast.error("Failed to fetch cover art");
    } finally {
      setFetchingArt(false);
    }
  };

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', userId)
        .order('year', { ascending: false });

      if (error) throw error;

      // Hide pending_review (auto-imported, unconfirmed) from the public timeline
      // Owners review them via the ImportReviewBanner before they appear publicly.
      const visible = (data || []).filter((c: any) => c.verification_status !== 'pending_review');

      const allCredits: ICDBCredit[] = visible.map((c: any) => ({
        ...c,
        endorsement_count: c.endorsement_count || 0,
        source: c.source || 'manual',
      }));

      // Sort: featured first, then by year
      allCredits.sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return (b.year || 0) - (a.year || 0);
      });

      setCredits(allCredits);

      // Fetch collaborator profiles
      const allCollabIds = new Set<string>();
      allCredits.forEach(c => c.collaborator_user_ids?.forEach(id => allCollabIds.add(id)));
      if (allCollabIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', [...allCollabIds]);
        const map = new Map<string, CollaboratorProfile>();
        profiles?.forEach(p => map.set(p.user_id, p));
        setCollaboratorProfiles(map);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, source: string) => {
    setDeletingId(id);
    try {
      // Record deletion so AI enricher won't re-add it
      const creditToDelete = credits.find(c => c.id === id);
      if (creditToDelete) {
        await supabase.from('deleted_credits').upsert({
          user_id: userId,
          project_name_lower: creditToDelete.project_name.toLowerCase(),
          role_lower: creditToDelete.role.toLowerCase(),
        }, { onConflict: 'user_id,project_name_lower,role_lower', ignoreDuplicates: true });
      }
      const { error } = await supabase.from('credits').delete().eq("id", id);
      if (error) throw error;
      setCredits(prev => prev.filter(c => c.id !== id));
      toast.success("Credit removed");
      onRefresh?.();
    } catch { toast.error("Failed to remove"); }
    finally { setDeletingId(null); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      // Record deletions so AI enricher won't re-add them
      const creditsToDelete = credits.filter(c => selectedIds.has(c.id));
      const deletedRecords = creditsToDelete.map(c => ({
        user_id: userId,
        project_name_lower: c.project_name.toLowerCase(),
        role_lower: c.role.toLowerCase(),
      }));
      
      // Insert into deleted_credits (ignore conflicts for already-tracked ones)
      if (deletedRecords.length > 0) {
        await supabase.from('deleted_credits').upsert(deletedRecords, { 
          onConflict: 'user_id,project_name_lower,role_lower',
          ignoreDuplicates: true 
        });
      }

      const { error } = await supabase.from('credits').delete().in('id', [...selectedIds]);
      if (error) throw error;
      setCredits(prev => prev.filter(c => !selectedIds.has(c.id)));
      toast.success(`${selectedIds.size} credit${selectedIds.size > 1 ? 's' : ''} removed`);
      setSelectedIds(new Set());
      setBulkSelectMode(false);
      onRefresh?.();
    } catch { toast.error("Failed to remove credits"); }
    finally { setBulkDeleting(false); }
  };

  const categoryGroups = useMemo(() => {
    const groups: Record<string, ICDBCredit[]> = {};
    credits.forEach(c => {
      const cat = resolveCategory(c);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    });
    const featured = credits.filter(c => c.is_featured);
    if (featured.length > 0) groups['featured'] = featured;
    return groups;
  }, [credits]);

  const openEdit = (credit: ICDBCredit) => {
    setEditForm({
      project_name: credit.project_name,
      role: credit.role,
      year: credit.year || new Date().getFullYear(),
      platform: credit.platform || '',
      url: credit.url || '',
      project_type: credit.project_type || '',
      section_override: resolveCategory(credit),
    });
    setEditingCredit(credit);
  };

  const saveEdit = async () => {
    if (!editingCredit || !editForm.project_name || !editForm.role) {
      toast.error("Project name and role are required");
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('credits').update({
        project_name: editForm.project_name,
        role: editForm.role,
        year: editForm.year,
        platform: editForm.platform || null,
        url: editForm.url || null,
        project_type: editForm.project_type || null,
        credit_category: editForm.section_override || editForm.project_type || null,
      }).eq('id', editingCredit.id);
      if (error) throw error;
      toast.success("Credit updated");
      setEditingCredit(null);
      fetchData();
      onRefresh?.();
    } catch (error) {
      console.error("Error updating credit:", error);
      toast.error("Failed to update credit");
    } finally {
      setSavingEdit(false);
    }
  };

  // Group credits by category for Netflix-style rows
  const categoryRows = useMemo(() => {
    const sortedKeys = Object.keys(categoryGroups)
      .filter(k => k !== 'featured')
      .sort((a, b) => (categoryGroups[b]?.length || 0) - (categoryGroups[a]?.length || 0));

    return categoryGroups['featured'] ? ['featured', ...sortedKeys] : sortedKeys;
  }, [categoryGroups]);

  const verifiedCount = credits.filter(c => c.verification_status === 'verified').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold leading-tight">Stamps</h3>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Verified credits · Creative Passport</p>
          </div>
          <Badge variant="secondary" className="text-xs gap-1">
            {credits.length}
          </Badge>
          {verifiedCount > 0 && (
            <Badge variant="secondary" className="text-xs gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
              <ShieldCheck className="h-3 w-3" />
              {verifiedCount} verified
            </Badge>
          )}
        </div>
        {isOwnProfile && (
          <div className="flex gap-2">
            {bulkSelectMode ? (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                  if (selectedIds.size === credits.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(credits.map(c => c.id)));
                }}>
                  {selectedIds.size === credits.length ? <Square className="h-3.5 w-3.5 mr-1" /> : <CheckSquare className="h-3.5 w-3.5 mr-1" />}
                  {selectedIds.size === credits.length ? 'Deselect All' : 'Select All'}
                </Button>
                {selectedIds.size > 0 && (
                  <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBulkDelete} disabled={bulkDeleting}>
                    {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                    Delete {selectedIds.size}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setBulkSelectMode(false); setSelectedIds(new Set()); }}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </>
            ) : (
              <>
                {credits.length > 1 && (
                  <Button variant="outline" size="sm" onClick={() => setBulkSelectMode(true)} className="h-8 text-xs">
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    Select
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)} className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Credit
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Netflix-style category rows */}
      {credits.length > 0 ? (
        <div className="space-y-5">
          {categoryRows.map(cat => {
            const rowCredits = categoryGroups[cat];
            if (!rowCredits || rowCredits.length === 0) return null;

            if (cat === 'featured') {
              return (
                <div key="featured" className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <h4 className="text-sm font-semibold">Featured</h4>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                    {rowCredits.map((credit, idx) => {
                      const thumbnail = credit.thumbnail_url
                        || extractThumbnailFromUrl(credit.primary_media_url)
                        || extractThumbnailFromUrl(credit.url);
                      const gradientIdx = idx % POSTER_GRADIENTS.length;
                      const playableUrl = getBestPlayableMediaUrl(credit);
                      return (
                        <div
                          key={credit.id}
                          className="group relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.03] hover:shadow-xl shrink-0"
                          style={{ width: "160px", aspectRatio: "2/3" }}
                          onClick={() => playableUrl ? setActiveMedia(credit) : navigate(`/production?name=${encodeURIComponent(credit.project_name)}`)}
                        >
                          {thumbnail ? (
                            <img src={thumbnail} alt={credit.project_name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className={cn("absolute inset-0 bg-gradient-to-b", POSTER_GRADIENTS[gradientIdx])} />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                          {playableUrl && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                <Play className="h-5 w-5 text-foreground ml-0.5" />
                              </div>
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-500/40 text-amber-400 bg-amber-500/10 h-4 px-1">
                              <Crown className="h-2.5 w-2.5" /> Featured
                            </Badge>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2.5 space-y-0.5">
                            <h4 className="font-bold text-white text-sm leading-tight line-clamp-2">{credit.project_name}</h4>
                            <p className="text-white/80 text-[10px] font-medium truncate">{credit.role}</p>
                            {credit.year && <span className="text-white/50 text-[9px]">{credit.year}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <CategoryRow
                key={cat}
                category={cat}
                credits={rowCredits}
                isOwnProfile={isOwnProfile}
                onDelete={handleDelete}
                onEndorse={(credit) => setEndorsementCredit({
                  id: credit.id, project_name: credit.project_name,
                  role: credit.role, year: credit.year,
                })}
                onPlay={(credit) => setActiveMedia(credit)}
                onEdit={openEdit}
                collaboratorProfiles={collaboratorProfiles}
                deletingId={deletingId}
                bulkSelectMode={bulkSelectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <Film className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <h3 className="mb-1 text-base font-semibold">No work added yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isOwnProfile
              ? "Add your credits and portfolio to build your creative resume"
              : "No work to display"}
          </p>
          {isOwnProfile && (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Your First Credit
            </Button>
          )}
        </div>
      )}

      {/* Media Player Modal */}
      {activeMedia && (
        <MediaPlayerModal
          isOpen={!!activeMedia}
          onClose={() => setActiveMedia(null)}
          item={getBestPlayableMediaUrl(activeMedia) ? (() => {
            const mediaUrl = getBestPlayableMediaUrl(activeMedia)!;
            return {
              title: activeMedia.project_name,
              description: activeMedia.description,
              media_type: getModalMediaType(mediaUrl, activeMedia.media_type || getMediaType(activeMedia)),
              media_url: mediaUrl,
              thumbnail_url: activeMedia.thumbnail_url,
            };
          })() : null}
        />
      )}

      {/* Form Dialog */}
      <ICDBCreditForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={() => { fetchData(); onRefresh?.(); }}
        userId={userId}
      />

      {/* Endorsement Dialog */}
      {endorsementCredit && (
        <CreditEndorsementDialog
          open={!!endorsementCredit}
          onOpenChange={(open) => !open && setEndorsementCredit(null)}
          credit={endorsementCredit}
          userId={userId}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCredit} onOpenChange={open => !open && setEditingCredit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Credit</DialogTitle>
            <DialogDescription>Update the details of this work credit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Project Name *</Label>
                <Input value={editForm.project_name} onChange={e => setEditForm(f => ({ ...f, project_name: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Your Role *</Label>
                <Input value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Year</Label>
                <Input type="number" value={editForm.year} onChange={e => setEditForm(f => ({ ...f, year: parseInt(e.target.value) || new Date().getFullYear() }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={editForm.project_type} onValueChange={v => {
                  const newSection = TYPE_TO_CATEGORY[v] || editForm.section_override;
                  setEditForm(f => ({ ...f, project_type: v, section_override: newSection }));
                }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {EDIT_PROJECT_TYPES.map(g => (
                      <SelectGroup key={g.group}>
                        <SelectLabel>{g.group}</SelectLabel>
                        {g.items.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Platform</Label>
                <Input value={editForm.platform} onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))} placeholder="e.g., Netflix, IMDb" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Move to Section</Label>
              <Select value={editForm.section_override} onValueChange={v => setEditForm(f => ({ ...f, section_override: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).filter(([k]) => k !== 'other').map(([key, meta]) => (
                    <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                  ))}
                  <SelectItem value="other">Other Work</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Choose which row this credit appears in</p>
            </div>
            <Button onClick={saveEdit} disabled={savingEdit} className="w-full">
              {savingEdit && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
