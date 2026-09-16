import { useState, useEffect } from "react";
import { extractThumbnailForStorage } from "@/lib/thumbnailExtractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  Film, Tv, Music, Disc3, Video, ExternalLink, CheckCircle2,
  Plus, Loader2, ShieldCheck, Trash2, Mic2, Play, Pencil,
  Drama, PersonStanding, CalendarDays, Sparkles, Crown, Shirt,
  Megaphone, Briefcase, UserPlus, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MediaPlayerModal } from "./MediaPlayerModal";
import { getBestPlayableMediaUrl, getModalMediaType } from "@/lib/mediaUtils";
import { CreditEndorsementDialog } from "./CreditEndorsementDialog";

// ── Category taxonomy (mirrors ICDBCreditForm) ──────────────────────
const CATEGORY_GROUPS = [
  { label: "Film & TV", key: "film_tv", emoji: "", types: ["film", "tv", "short_film", "documentary", "music_video", "web_series", "movie"] },
  { label: "Music & Audio", key: "music", emoji: "", types: ["album", "single", "ep", "podcast", "audiobook", "soca", "dancehall", "afrobeats", "gospel_concert"] },
  { label: "Performing Arts", key: "performing", emoji: "", types: ["theatre", "theater", "musical", "dance", "choreography", "backup_dancer", "comedy", "spoken_word", "opera", "stage", "play", "recital", "pantomime"] },
  { label: "Events & Productions", key: "events", emoji: "📅", types: ["live_event", "concert", "tour", "festival", "carnival", "pageant", "fashion_show", "awards_show", "exhibition", "conference", "dj_set", "mc_hosting", "event", "promo", "after_movie"] },
  { label: "Content & Digital", key: "digital", emoji: "", types: ["youtube_series", "ugc_campaign", "livestream", "online_course", "workshop", "video"] },
  { label: "Commercial", key: "commercial", emoji: "", types: ["commercial", "brand_campaign", "corporate", "voiceover", "influencer_campaign", "ad", "hosting", "mc"] },
  { label: "Art & Design", key: "art", emoji: "", types: ["art_exhibition", "mural", "graphic_design", "photography", "animation"] },
  { label: "Fashion & Beauty", key: "fashion", emoji: "👗", types: ["fashion_collection", "editorial_shoot", "runway", "beauty_campaign", "styling"] },
  { label: "Business & Industry", key: "business", emoji: "", types: ["talent_management", "booking", "label_release", "publishing", "curation"] },
];

// Build a flat lookup: type → category key
const TYPE_TO_CATEGORY: Record<string, string> = {};
CATEGORY_GROUPS.forEach(g => g.types.forEach(t => { TYPE_TO_CATEGORY[t] = g.key; }));

function resolveCategory(creditCategory?: string, projectType?: string, source?: string): string {
  // Try credit_category first
  if (creditCategory) {
    if (TYPE_TO_CATEGORY[creditCategory]) return TYPE_TO_CATEGORY[creditCategory];
    // Maybe it's already a group key
    if (CATEGORY_GROUPS.some(g => g.key === creditCategory)) return creditCategory;
  }
  if (projectType && TYPE_TO_CATEGORY[projectType]) return TYPE_TO_CATEGORY[projectType];
  // Infer from source
  if (source === 'spotify' || source === 'musicbrainz' || source === 'discogs') return 'music';
  if (source === 'tmdb' || source === 'imdb') return 'film_tv';
  if (source === 'youtube') return 'digital';
  return 'other';
}

// Flat PROJECT_TYPES for edit select
const ALL_PROJECT_TYPES = [
  { group: "Film & TV", items: [
    { value: "film", label: "Film / Movie" }, { value: "tv", label: "TV Show / Series" },
    { value: "short_film", label: "Short Film" }, { value: "documentary", label: "Documentary" },
    { value: "music_video", label: "Music Video" }, { value: "web_series", label: "Web Series" },
  ]},
  { group: "Music & Audio", items: [
    { value: "album", label: "Album" }, { value: "single", label: "Single / Track" },
    { value: "ep", label: "EP" }, { value: "podcast", label: "Podcast" },
    { value: "soca", label: "Soca Release" }, { value: "afrobeats", label: "Afrobeats Release" },
  ]},
  { group: "Events & Productions", items: [
    { value: "live_event", label: "Live Event" }, { value: "concert", label: "Concert" },
    { value: "festival", label: "Festival" }, { value: "carnival", label: "Carnival / Mas" },
    { value: "fashion_show", label: "Fashion Show" }, { value: "conference", label: "Conference / Summit" },
  ]},
  { group: "Content & Digital", items: [
    { value: "youtube_series", label: "YouTube Series" }, { value: "ugc_campaign", label: "UGC Campaign" },
    { value: "livestream", label: "Livestream" }, { value: "workshop", label: "Workshop" },
  ]},
  { group: "Commercial", items: [
    { value: "commercial", label: "TV / Radio Ad" }, { value: "brand_campaign", label: "Brand Campaign" },
    { value: "voiceover", label: "Voiceover" },
  ]},
  { group: "Art & Design", items: [
    { value: "photography", label: "Photography Project" }, { value: "animation", label: "Animation" },
    { value: "graphic_design", label: "Graphic Design" },
  ]},
  { group: "Fashion & Beauty", items: [
    { value: "editorial_shoot", label: "Editorial Shoot" }, { value: "runway", label: "Runway Show" },
    { value: "styling", label: "Styling Project" },
  ]},
  { group: "Performing Arts", items: [
    { value: "theatre", label: "Theatre / Play" }, { value: "dance", label: "Dance Performance" },
    { value: "comedy", label: "Stand-up / Comedy" },
  ]},
];

interface UnifiedCredit {
  id: string;
  title: string;
  role: string;
  year: number | null;
  platform?: string;
  url?: string;
  primaryMediaUrl?: string | null;
  mediaType?: string | null;
  thumbnailUrl?: string;
  isVerified: boolean;
  source?: string;
  creditType?: string;
  categoryKey: string;
  projectType?: string;
  creditCategory?: string;
}

interface UnifiedWorkHistoryProps {
  userId: string;
  isOwnProfile: boolean;
  onRefresh?: () => void;
}

const CREDIT_TYPE_ICONS: Record<string, any> = {
  film: Film, movie: Film, tv: Tv, album: Disc3, single: Music, music_video: Video,
  podcast: Mic2, episode: Mic2, video: Video, theatre: Drama, theater: Drama,
  stage: Drama, play: Drama, musical: Drama, comedy: Drama, dance: PersonStanding,
  live_event: CalendarDays, concert: Music, festival: CalendarDays, carnival: Sparkles,
  pageant: Crown, fashion_show: Shirt, commercial: Megaphone, ad: Megaphone,
  corporate: Briefcase, hosting: Mic2, mc: Mic2, brand_campaign: Megaphone,
  voiceover: Mic2, credit: Film,
};

const SOURCE_LABELS: Record<string, string> = {
  spotify: 'Spotify', youtube: 'YouTube', tmdb: 'TMDB', imdb: 'IMDb',
  discogs: 'Discogs', musicbrainz: 'MusicBrainz', project: 'Project', manual: '',
  search_claim: '',
};

export function UnifiedWorkHistory({ userId, isOwnProfile, onRefresh }: UnifiedWorkHistoryProps) {
  const [credits, setCredits] = useState<UnifiedCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCredit, setEditingCredit] = useState<UnifiedCredit | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCredit, setSelectedCredit] = useState<UnifiedCredit | null>(null);
  const [endorsementCredit, setEndorsementCredit] = useState<{id: string; project_name: string; role: string; year?: number} | null>(null);
  const [saving, setSaving] = useState(false);
  const INITIAL_PER_CAT = 4;

  const [newCredit, setNewCredit] = useState({
    project_name: "", role: "", year: new Date().getFullYear(),
    platform: "", url: "", project_type: "",
  });

  const [editForm, setEditForm] = useState({
    project_name: "", role: "", year: new Date().getFullYear(),
    platform: "", url: "", project_type: "",
  });

  useEffect(() => { fetchAllCredits(); }, [userId]);

  // Auto-trigger media backfill for credits missing thumbnails
  const triggerBackfill = async (creditsList: UnifiedCredit[]) => {
    const missingCount = creditsList.filter(c => !c.thumbnailUrl).length;
    if (missingCount === 0 || !isOwnProfile) return;
    
    // Throttle: only once per hour per user
    const key = `backfill_last_${userId}`;
    const last = localStorage.getItem(key);
    if (last && Date.now() - parseInt(last) < 3600000) return;
    localStorage.setItem(key, Date.now().toString());

    try {
      console.log(`[Backfill] Triggering for ${missingCount} credits missing thumbnails`);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      supabase.functions.invoke('backfill-credit-media', {
        body: { user_id: userId, batch_size: 20 },
      }).then(({ data }) => {
        if (data?.updated > 0) {
          console.log(`[Backfill] Updated ${data.updated} credits with media`);
          // Silently refresh credits to show new thumbnails
          fetchAllCredits();
        }
      }).catch(e => console.error('[Backfill] Error:', e));
    } catch (e) {
      console.error('[Backfill] Trigger error:', e);
    }
  };

  const fetchAllCredits = async () => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', userId)
        .order('year', { ascending: false });
      if (error) throw error;

      const allCredits: UnifiedCredit[] = (data || []).map((c: any) => {
        const catKey = resolveCategory(c.credit_category, c.project_type, c.source);
        return {
          id: c.id,
          title: c.project_name,
          role: c.role,
          year: c.year,
          platform: c.platform || c.source,
          url: c.url || c.verification_url,
          primaryMediaUrl: c.primary_media_url,
          mediaType: c.media_type,
          thumbnailUrl: c.thumbnail_url,
          isVerified: c.verification_status === 'verified',
          source: c.source || 'manual',
          creditType: c.credit_category || c.project_type || 'credit',
          categoryKey: catKey,
          projectType: c.project_type,
          creditCategory: c.credit_category,
        };
      });
      setCredits(allCredits);
      
      // Trigger backfill in background if needed
      triggerBackfill(allCredits);
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
    }
  };

  const addManualCredit = async () => {
    if (!newCredit.project_name || !newCredit.role) {
      toast.error("Please fill in project name and role");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const extractedThumb = extractThumbnailForStorage(newCredit.url || null);
      const { data: insertedData, error } = await supabase.from("credits").insert({
        user_id: user.id,
        project_name: newCredit.project_name,
        role: newCredit.role,
        year: newCredit.year,
        platform: newCredit.platform || null,
        url: newCredit.url || null,
        project_type: newCredit.project_type || null,
        credit_category: newCredit.project_type || null,
        thumbnail_url: extractedThumb,
      }).select().single();
      if (error) throw error;

      if (insertedData) {
        supabase.functions.invoke('verify-credit', {
          body: { credit_id: insertedData.id, project_name: newCredit.project_name, role: newCredit.role, year: newCredit.year, platform: newCredit.platform },
        }).catch(err => console.log('AI verification queued:', err));
      }

      toast.success("Credit added successfully");
      setNewCredit({ project_name: "", role: "", year: new Date().getFullYear(), platform: "", url: "", project_type: "" });
      setIsAddDialogOpen(false);
      fetchAllCredits();
      onRefresh?.();
    } catch (error: any) {
      console.error("Error adding credit:", error);
      const msg = error?.message || error?.details || error?.hint || "Unknown error";
      toast.error(`Failed to add credit: ${msg}`);
      try {
        const { logClientError } = await import("@/lib/errorLogger");
        await logClientError(error instanceof Error ? error : new Error(String(msg)), "UnifiedWorkHistory.addCredit", {
          code: error?.code, hint: error?.hint, details: error?.details,
        });
      } catch {}
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (credit: UnifiedCredit) => {
    setEditForm({
      project_name: credit.title,
      role: credit.role,
      year: credit.year || new Date().getFullYear(),
      platform: credit.platform || '',
      url: credit.url || '',
      project_type: credit.creditType || '',
    });
    setEditingCredit(credit);
  };

  const saveEdit = async () => {
    if (!editingCredit) return;
    if (!editForm.project_name || !editForm.role) {
      toast.error("Project name and role are required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('credits').update({
        project_name: editForm.project_name,
        role: editForm.role,
        year: editForm.year,
        platform: editForm.platform || null,
        url: editForm.url || null,
        project_type: editForm.project_type || null,
        credit_category: editForm.project_type || null,
      }).eq('id', editingCredit.id);
      if (error) throw error;

      toast.success("Credit updated");
      setEditingCredit(null);
      fetchAllCredits();
      onRefresh?.();
    } catch (error) {
      console.error("Error updating credit:", error);
      toast.error("Failed to update credit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('credits').delete().eq("id", id);
      if (error) throw error;
      setCredits(prev => prev.filter(c => c.id !== id));
      toast.success("Credit removed");
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting credit:", error);
      toast.error("Failed to remove credit");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const verifiedCount = credits.filter(c => c.isVerified).length;

  // Group credits by resolved category
  const grouped: Record<string, UnifiedCredit[]> = {};
  credits.forEach(c => {
    if (!grouped[c.categoryKey]) grouped[c.categoryKey] = [];
    grouped[c.categoryKey].push(c);
  });

  // Sort category groups by the taxonomy order, with populated ones first
  const orderedGroups = CATEGORY_GROUPS
    .filter(g => grouped[g.key]?.length)
    .map(g => ({ ...g, credits: grouped[g.key] }));

  // Add "Other" if there are uncategorized
  if (grouped['other']?.length) {
    orderedGroups.push({ label: "Other", key: "other", emoji: "", types: [], credits: grouped['other'] });
  }

  // ── Shared credit form fields ────────────────────────────
  const CreditFormFields = ({ form, setForm }: { form: typeof newCredit; setForm: (f: any) => void }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Project Name *</Label>
          <Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} placeholder="e.g., The Matrix" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Your Role *</Label>
          <Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g., Director" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Year</Label>
          <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={form.project_type} onValueChange={v => setForm({ ...form, project_type: v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type..." /></SelectTrigger>
            <SelectContent>
              {ALL_PROJECT_TYPES.map(g => (
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
          <Input value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} placeholder="e.g., Netflix" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="h-9 text-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Work History</h3>
          {verifiedCount > 0 && (
            <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
              <ShieldCheck className="h-3 w-3" /> {verifiedCount} verified
            </Badge>
          )}
        </div>
        {isOwnProfile && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1.5" /> Add Credit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Credit</DialogTitle>
                <DialogDescription>Add a new work credit to your profile.</DialogDescription>
              </DialogHeader>
              <CreditFormFields form={newCredit} setForm={setNewCredit} />
              <Button onClick={addManualCredit} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Add Credit
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {credits.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <Film className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No work history yet</h3>
          <p className="text-sm text-muted-foreground">
            {isOwnProfile ? "Connect your platforms to auto-import, or add credits manually" : "No credits to display"}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {orderedGroups.map(group => {
            const isExpanded = expandedCategories.has(group.key);
            const displayCredits = isExpanded ? group.credits : group.credits.slice(0, INITIAL_PER_CAT);
            const hasMore = group.credits.length > INITIAL_PER_CAT;

            return (
              <div key={group.key} className="space-y-2">
                {/* Category header */}
                <div className="flex items-center gap-2">
                  <span className="text-base">{group.emoji}</span>
                  <h4 className="font-semibold text-sm">{group.label}</h4>
                  <Badge variant="outline" className="text-xs text-muted-foreground">{group.credits.length}</Badge>
                </div>

                {/* Credit cards */}
                {displayCredits.map(credit => {
                  const Icon = CREDIT_TYPE_ICONS[credit.creditType || 'credit'] || Film;
                  const playableUrl = getBestPlayableMediaUrl({ url: credit.url, primary_media_url: credit.primaryMediaUrl });
                  const isPlayable = !!playableUrl;
                  const sourceLabel = SOURCE_LABELS[credit.source || ''] || credit.source;

                  return (
                    <div
                      key={credit.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-colors group",
                        credit.isVerified
                          ? "bg-green-500/5 border border-green-500/20 hover:bg-green-500/10"
                          : "bg-muted/30 hover:bg-muted/50",
                        isPlayable && "cursor-pointer"
                      )}
                      onClick={() => isPlayable && setSelectedCredit(credit)}
                    >
                      {/* Thumbnail */}
                      <div className="relative shrink-0">
                        {credit.thumbnailUrl ? (
                          <img
                            src={credit.thumbnailUrl}
                            alt={credit.title}
                            loading="lazy"
                            className="w-14 h-14 rounded-lg object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                          />
                        ) : null}
                        <div className={cn(
                          "w-14 h-14 rounded-lg flex items-center justify-center",
                          credit.thumbnailUrl && "hidden",
                          credit.categoryKey === "film_tv" ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20" :
                          credit.categoryKey === "music" ? "bg-gradient-to-br from-primary/20 to-pink-500/20" :
                          credit.categoryKey === "events" ? "bg-gradient-to-br from-primary/20 to-primary/20" :
                          credit.categoryKey === "digital" ? "bg-gradient-to-br from-red-500/20 to-rose-500/20" :
                          credit.categoryKey === "fashion" ? "bg-gradient-to-br from-pink-500/20 to-fuchsia-500/20" :
                          "bg-muted"
                        )}>
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        {isPlayable && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                            <Play className="h-5 w-5 text-white" fill="currentColor" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-medium text-sm truncate">{credit.title}</h4>
                          {(() => {
                            const now = new Date().getFullYear();
                            if (!credit.year) return null;
                            const isFuture = credit.year > now;
                            const isCurrent = credit.year === now;
                            const label = isFuture ? "In Production" : isCurrent ? "Post-Prod" : "Released";
                            const cls = isFuture
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : isCurrent
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
                            return (
                              <span className={cn("shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border", cls)}>
                                {label}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {credit.role}
                          {credit.year && <span> · {credit.year}</span>}
                          {sourceLabel && <span> · {sourceLabel}</span>}
                        </p>
                        {credit.isVerified && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            <span className="text-[10px] text-green-600 dark:text-green-400">Verified</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {credit.url && !isPlayable && (
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); window.open(credit.url, '_blank'); }}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isOwnProfile && (
                          <>
                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openEditDialog(credit); }} className="text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!credit.isVerified && (
                              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEndorsementCredit({ id: credit.id, project_name: credit.title, role: credit.role, year: credit.year || undefined }); }} className="text-primary hover:text-primary hover:bg-primary/10">
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleDelete(credit.id); }} disabled={deletingId === credit.id} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              {deletingId === credit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Show more */}
                {hasMore && (
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => toggleCategory(group.key)}>
                    {isExpanded ? <><ChevronUp className="h-3 w-3 mr-1" /> Show less</> : <><ChevronDown className="h-3 w-3 mr-1" /> Show {group.credits.length - INITIAL_PER_CAT} more</>}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCredit} onOpenChange={open => !open && setEditingCredit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Credit</DialogTitle>
            <DialogDescription>Update the details of this work credit.</DialogDescription>
          </DialogHeader>
          <CreditFormFields form={editForm} setForm={setEditForm} />
          <Button onClick={saveEdit} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Changes
          </Button>
        </DialogContent>
      </Dialog>

      {/* Media Player Modal */}
      <MediaPlayerModal
        isOpen={!!selectedCredit}
        onClose={() => setSelectedCredit(null)}
        item={selectedCredit && getBestPlayableMediaUrl({ url: selectedCredit.url, primary_media_url: selectedCredit.primaryMediaUrl }) ? (() => {
          const mediaUrl = getBestPlayableMediaUrl({ url: selectedCredit.url, primary_media_url: selectedCredit.primaryMediaUrl })!;
          return {
            title: selectedCredit.title,
            description: `${selectedCredit.role}${selectedCredit.year ? ` · ${selectedCredit.year}` : ''}`,
            media_type: getModalMediaType(mediaUrl, selectedCredit.mediaType),
            media_url: mediaUrl,
            thumbnail_url: selectedCredit.thumbnailUrl,
          };
        })() : null}
      />

      {/* Endorsement Dialog */}
      {endorsementCredit && (
        <CreditEndorsementDialog
          open={!!endorsementCredit}
          onOpenChange={open => !open && setEndorsementCredit(null)}
          credit={endorsementCredit}
          userId={userId}
        />
      )}
    </div>
  );
}
