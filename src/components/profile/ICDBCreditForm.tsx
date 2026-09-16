import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Search, Loader2, MapPin, Calendar, Link2, Users, Building2, Sparkles, ChevronRight, Wand2, ChevronDown, Mail, Database, ShieldCheck, UserPlus, Upload, Image as ImageIcon, Video, Music } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { parseMediaUrl } from "@/lib/mediaUtils";

const PROJECT_TYPES = [
  { label: "Film & TV", value: "film_tv", items: [
    { value: "film", label: "Film / Movie" },
    { value: "tv", label: "TV Show / Series" },
    { value: "short_film", label: "Short Film" },
    { value: "documentary", label: "Documentary" },
    { value: "music_video", label: "Music Video" },
    { value: "web_series", label: "Web Series" },
  ]},
  { label: "Music & Audio", value: "music", items: [
    { value: "album", label: "Album" },
    { value: "single", label: "Single / Track" },
    { value: "ep", label: "EP" },
    { value: "podcast", label: "Podcast" },
    { value: "audiobook", label: "Audiobook" },
    { value: "soca", label: "Soca Release" },
    { value: "dancehall", label: "Dancehall Release" },
    { value: "afrobeats", label: "Afrobeats Release" },
    { value: "gospel_concert", label: "Gospel Concert / Album" },
  ]},
  { label: "Performing Arts", value: "performing", items: [
    { value: "theatre", label: "Theatre / Play" },
    { value: "musical", label: "Musical Theatre" },
    { value: "dance", label: "Dance Performance" },
    { value: "choreography", label: "Choreography" },
    { value: "backup_dancer", label: "Backup Dancer / Tour" },
    { value: "comedy", label: "Stand-up / Comedy" },
    { value: "spoken_word", label: "Spoken Word" },
    { value: "opera", label: "Opera" },
  ]},
  { label: "Events & Productions", value: "events", items: [
    { value: "live_event", label: "Live Event" },
    { value: "concert", label: "Concert" },
    { value: "tour", label: "Tour" },
    { value: "festival", label: "Festival" },
    { value: "carnival", label: "Carnival / Mas" },
    { value: "pageant", label: "Pageant" },
    { value: "fashion_show", label: "Fashion Show" },
    { value: "awards_show", label: "Awards Ceremony" },
    { value: "exhibition", label: "Exhibition / Gallery" },
    { value: "conference", label: "Conference / Summit" },
    { value: "dj_set", label: "DJ Set" },
    { value: "mc_hosting", label: "MC / Hosting" },
  ]},
  { label: "Content & Digital", value: "digital", items: [
    { value: "youtube_series", label: "YouTube Series" },
    { value: "ugc_campaign", label: "UGC Campaign" },
    { value: "livestream", label: "Livestream" },
    { value: "online_course", label: "Online Course" },
    { value: "workshop", label: "Workshop" },
  ]},
  { label: "Commercial", value: "commercial", items: [
    { value: "commercial", label: "TV / Radio Ad" },
    { value: "brand_campaign", label: "Brand Campaign" },
    { value: "corporate", label: "Corporate" },
    { value: "voiceover", label: "Voiceover" },
    { value: "influencer_campaign", label: "Influencer Campaign" },
  ]},
  { label: "Art & Design", value: "art", items: [
    { value: "art_exhibition", label: "Art Exhibition" },
    { value: "mural", label: "Mural / Installation" },
    { value: "graphic_design", label: "Graphic Design Project" },
    { value: "photography", label: "Photography Project" },
    { value: "animation", label: "Animation" },
  ]},
  { label: "Fashion & Beauty", value: "fashion", items: [
    { value: "fashion_collection", label: "Fashion Collection" },
    { value: "editorial_shoot", label: "Editorial Shoot" },
    { value: "runway", label: "Runway Show" },
    { value: "beauty_campaign", label: "Beauty Campaign" },
    { value: "styling", label: "Styling Project" },
  ]},
  { label: "Business & Industry", value: "business", items: [
    { value: "talent_management", label: "Talent Management" },
    { value: "booking", label: "Booking / Representation" },
    { value: "label_release", label: "Label Release" },
    { value: "publishing", label: "Publishing Deal" },
    { value: "curation", label: "Curation / Programming" },
  ]},
];

interface CollaboratorResult {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

interface ExternalCollaborator {
  name: string;
  email: string;
}

interface WebCreditResult {
  title: string;
  type: string;
  role_suggestion: string | null;
  year: number | null;
  platform: string | null;
  description: string | null;
  url: string | null;
  image_url: string | null;
  location: string | null;
  client_brand: string | null;
}

interface ICDBCreditFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
}

type FormStep = "search" | "details";

export function ICDBCreditForm({ open, onOpenChange, onSuccess, userId }: ICDBCreditFormProps) {
  const [step, setStep] = useState<FormStep>("search");
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; type: string; name: string } | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [webResults, setWebResults] = useState<WebCreditResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // ICDB canonical project matches
  const [icdbMatches, setIcdbMatches] = useState<any[]>([]);
  const [icdbSuggestions, setIcdbSuggestions] = useState<any[]>([]);

  // Collaborator state
  const [collabSearch, setCollabSearch] = useState("");
  const [collabResults, setCollabResults] = useState<CollaboratorResult[]>([]);
  const [searchingCollabs, setSearchingCollabs] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<CollaboratorResult[]>([]);
  
  // External collaborators (Credit Chains)
  const [externalCollabs, setExternalCollabs] = useState<ExternalCollaborator[]>([]);
  const [extName, setExtName] = useState("");
  const [extEmail, setExtEmail] = useState("");

  const [form, setForm] = useState({
    project_name: "",
    project_type: "",
    role: "",
    description: "",
    start_date: "",
    end_date: "",
    location: "",
    platform: "",
    url: "",
    client_brand: "",
    credit_category: "",
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Handle file upload → AI analysis → auto-fill
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast.error("File too large (max 20MB)");
      return;
    }

    setUploading(true);
    try {
      // Determine media type
      let mediaType = 'image';
      if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';

      // Upload to storage
      const ext = file.name.split('.').pop();
      const path = `${userId}/credits/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(path);

      setUploadedFile({ url: publicUrl, type: mediaType, name: file.name });

      // AI analysis of the uploaded file name to pre-populate
      const { data: aiData } = await supabase.functions.invoke('ai-credit-import', {
        body: { type: 'text', content: file.name, userId },
      });

      if (aiData) {
        setForm(prev => ({
          ...prev,
          project_name: aiData.project_name || prev.project_name || file.name.replace(/\.[^/.]+$/, ''),
          role: aiData.role || prev.role,
          project_type: aiData.project_type || prev.project_type,
          credit_category: aiData.project_type || prev.credit_category,
          platform: aiData.platform || prev.platform,
          description: aiData.description || prev.description,
          start_date: aiData.year ? `${aiData.year}-01-01` : prev.start_date,
        }));
      } else {
        // Fallback: use filename as project name
        setForm(prev => ({
          ...prev,
          project_name: prev.project_name || file.name.replace(/\.[^/.]+$/, ''),
        }));
      }

      setStep("details");
      toast.success("Media uploaded! Confirm your credit details.");
    } catch (err) {
      console.error('Upload error:', err);
      toast.error("Upload failed — try again");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Detect if input is a URL
  const isUrl = (str: string) => {
    try { new URL(str); return true; } catch { return false; }
  };

  // Detect platform from URL
  const detectPlatformFromUrl = (url: string): { platform: string; type: string } => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return { platform: 'YouTube', type: 'youtube_series' };
    if (url.includes('spotify.com')) return { platform: 'Spotify', type: 'single' };
    if (url.includes('soundcloud.com')) return { platform: 'SoundCloud', type: 'single' };
    if (url.includes('vimeo.com')) return { platform: 'Vimeo', type: 'film' };
    if (url.includes('imdb.com')) return { platform: 'IMDb', type: 'film' };
    if (url.includes('behance.net')) return { platform: 'Behance', type: 'graphic_design' };
    if (url.includes('tiktok.com')) return { platform: 'TikTok', type: 'ugc_campaign' };
    if (url.includes('instagram.com')) return { platform: 'Instagram', type: 'ugc_campaign' };
    return { platform: '', type: '' };
  };

  // Search ICDB canonical database
  const searchIcdb = useCallback(async (q: string) => {
    if (q.length < 2) { setIcdbMatches([]); return; }
    try {
      const { data, error } = await supabase.functions.invoke('search-icdb', {
        body: { query: q },
      });
      if (!error && data) {
        setIcdbMatches(data.projects || []);
        setIcdbSuggestions(data.suggestions || []);
      }
    } catch { /* ignore */ }
  }, []);

  // Claim an ICDB canonical project role
  const claimIcdbRole = async (project: any, role: any) => {
    try {
      // Claim the role in ICDB
      if (role?.id) {
        await supabase.from('icdb_project_roles').update({
          claimed_by: userId,
          is_claimed: true,
        }).eq('id', role.id);
      }

      // Auto-fill the form with project details
      setForm(prev => ({
        ...prev,
        project_name: project.title,
        project_type: project.type || '',
        role: role?.role_title || '',
        description: project.description || '',
        start_date: project.year ? `${project.year}-01-01` : '',
        location: project.location || '',
        platform: project.platform || '',
        url: project.external_url || '',
        client_brand: project.client_brand || '',
        credit_category: project.type || '',
      }));
      setStep("details");
      toast.success("Project found in Kretopia Credits! Confirm your details.");
    } catch {
      toast.error("Failed to claim — try manual entry");
    }
  };

  // AI-powered web search (works for both text queries and URLs)
  const handleSearch = useCallback(async (query?: string) => {
    const q = query || searchQuery;
    if (!q.trim() || q.length < 2) return;
    setSearching(true);
    setHasSearched(true);

    // Search Kretopia Credits canonical database in parallel with web search
    searchIcdb(q);

    try {
      const { data, error } = await supabase.functions.invoke('search-credits-web', {
        body: { query: q },
      });
      if (error) throw error;
      setWebResults(data?.results || []);
    } catch (err) {
      console.error('AI search error:', err);
      toast.error('Search temporarily unavailable');
      setWebResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchIcdb]);

  // Handle link paste — detect platform, auto-search, auto-fill URL
  const handleLinkPaste = useCallback(async (url: string) => {
    setLinkInput(url);
    if (!isUrl(url)) return;
    
    const { platform, type } = detectPlatformFromUrl(url);
    update("url", url);
    if (platform) update("platform", platform);
    if (type) update("project_type", type);
    
    // Search AI with the URL
    setSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-credits-web', {
        body: { query: url },
      });
      if (error) throw error;
      const results = data?.results || [];
      setWebResults(results);
      
      // If exactly one result, auto-claim it
      if (results.length === 1) {
        claimResult(results[0]);
        toast.success("Project detected! Review the details below.");
      }
    } catch {
      toast.error('Could not analyze this link');
    } finally {
      setSearching(false);
    }
  }, []);

  // Claim a web result — auto-fill form
  const claimResult = (result: WebCreditResult) => {
    setForm(prev => ({
      ...prev,
      project_name: result.title,
      project_type: result.type || prev.project_type || "",
      role: result.role_suggestion || prev.role || "",
      description: result.description || "",
      start_date: result.year ? `${result.year}-01-01` : "",
      end_date: "",
      location: result.location || "",
      platform: result.platform || prev.platform || "",
      url: result.url || prev.url || "",
      client_brand: result.client_brand || "",
      credit_category: result.type || "",
    }));
    setStep("details");
  };

  // Go to manual entry
  const goManual = () => {
    setForm(prev => ({ ...prev, project_name: searchQuery || prev.project_name }));
    setStep("details");
  };

  const searchCollaborators = async (query: string) => {
    if (query.length < 2) { setCollabResults([]); return; }
    setSearchingCollabs(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role')
        .ilike('full_name', `%${query}%`)
        .neq('user_id', userId)
        .limit(5);
      setCollabResults((data || []).filter(p => !selectedCollaborators.find(s => s.user_id === p.user_id)));
    } catch { /* ignore */ }
    setSearchingCollabs(false);
  };

  const addExternalCollab = () => {
    if (!extName.trim() || !extEmail.trim()) return;
    if (!/\S+@\S+\.\S+/.test(extEmail)) { toast.error("Enter a valid email"); return; }
    setExternalCollabs(prev => [...prev, { name: extName.trim(), email: extEmail.trim() }]);
    setExtName("");
    setExtEmail("");
  };

  const handleSubmit = async () => {
    if (!form.project_name || !form.role) {
      toast.error("Project name and role are required");
      return;
    }

    setSaving(true);
    try {
      const year = form.start_date ? new Date(form.start_date).getFullYear() : new Date().getFullYear();
      const collaboratorIds = selectedCollaborators.map(c => c.user_id);

      const insertData: any = {
        user_id: userId,
        project_name: form.project_name,
        role: form.role,
        year,
        description: form.description || null,
        project_type: form.project_type || null,
        credit_category: form.project_type || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        location: form.location || null,
        platform: form.platform || null,
        url: form.url || null,
        client_brand: form.client_brand || null,
        collaborator_user_ids: collaboratorIds.length > 0 ? collaboratorIds : null,
        source: uploadedFile ? 'upload' : 'manual',
        media_type: uploadedFile?.type || null,
        primary_media_url: uploadedFile?.url || null,
        thumbnail_url: uploadedFile?.type === 'image' ? uploadedFile.url : null,
      };

      const { data: insertedData, error } = await supabase
        .from("credits")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      if (insertedData) {
        // AI verification
        supabase.functions.invoke('verify-credit', {
          body: {
            credit_id: insertedData.id,
            project_name: form.project_name,
            role: form.role,
            year,
            platform: form.platform,
          },
        }).catch(err => console.log('AI verification queued:', err));

        // Platform collaborator endorsements
        for (const collab of selectedCollaborators) {
          await supabase.from('credit_endorsements').insert({
            credit_id: insertedData.id,
            requested_by: userId,
            endorser_id: collab.user_id,
            endorser_name: collab.full_name,
            status: 'pending',
            relationship: 'collaborator',
          });
        }

        // Credit Chains — invite external collaborators
        if (externalCollabs.length > 0) {
          for (const ext of externalCollabs) {
            // Create endorsement with email (no endorser_id since they're external)
            await supabase.from('credit_endorsements').insert({
              credit_id: insertedData.id,
              requested_by: userId,
              endorser_name: ext.name,
              endorser_email: ext.email,
              status: 'pending',
              relationship: 'collaborator',
            });
          }
          
          // Send invite emails via edge function
          supabase.functions.invoke('send-credit-invite', {
            body: {
              credit_id: insertedData.id,
              project_name: form.project_name,
              role: form.role,
              external_collaborators: externalCollabs,
            },
          }).catch(err => console.log('Credit chain invites queued:', err));
        }
      }

      toast.success("Credit added — verification in progress");
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error adding credit:", error);
      const msg = error?.message || error?.error_description || error?.details || "Unknown error";
      toast.error(`Failed to add credit: ${msg}`);
      try {
        const { logClientError } = await import("@/lib/errorLogger");
        await logClientError(error instanceof Error ? error : new Error(String(msg)), "ICDBCreditForm.addCredit", {
          code: error?.code, hint: error?.hint, details: error?.details,
        });
      } catch {}
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep("search");
    setSearchQuery("");
    setLinkInput("");
    setWebResults([]);
    setIcdbMatches([]);
    setIcdbSuggestions([]);
    setHasSearched(false);
    setShowMore(false);
    setUploadedFile(null);
    setForm({
      project_name: "", project_type: "", role: "", description: "",
      start_date: "", end_date: "", location: "", platform: "",
      url: "", client_brand: "", credit_category: "",
    });
    setSelectedCollaborators([]);
    setExternalCollabs([]);
    setCollabSearch("");
    setCollabResults([]);
    setExtName("");
    setExtEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg flex items-center gap-2">
            {step === "search" ? (
              <>
                <Wand2 className="h-5 w-5 text-primary" />
                Add Work
              </>
            ) : (
              "Credit Details"
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "search"
              ? "Upload, paste a link, or search — Thrive fills in the rest"
              : "Confirm your role and details"
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          {step === "search" ? (
            <div className="space-y-4">
              {/* Upload media */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 text-muted-foreground hover:border-[#FF2DA1]/50 hover:text-white transition-colors"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-medium">Uploading & analyzing...</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      <ImageIcon className="h-4 w-4" />
                      <Video className="h-4 w-4" />
                      <Music className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium">Upload photo, video, or audio</span>
                    <span className="text-[10px]">AI will auto-detect project details</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or paste a link</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Paste a Link */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Paste a link
                </Label>
                <Input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (isUrl(pasted)) {
                      e.preventDefault();
                      handleLinkPaste(pasted);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isUrl(linkInput)) handleLinkPaste(linkInput);
                  }}
                  placeholder="YouTube, Spotify, IMDb, Behance URL..."
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or search</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* AI Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search any project, song, film, event..."
                  className="pl-9 pr-20 h-10 text-sm"
                />
                <Button
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 text-xs gap-1"
                  onClick={() => handleSearch()}
                  disabled={searching || searchQuery.length < 2}
                >
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Search
                </Button>
              </div>

              {/* ICDB Canonical Matches */}
              {!searching && icdbMatches.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <Database className="h-3 w-3 text-primary" />
                    Kretopia Credits Verified Projects
                  </p>
                  {icdbMatches.slice(0, 5).map((project: any) => (
                    <Card
                      key={project.id}
                      className="p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all border-primary/20"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold flex-1">{project.title}</p>
                          <Badge variant="outline" className="text-[9px] h-4 gap-0.5 border-primary/30 text-primary shrink-0">
                            <ShieldCheck className="h-2 w-2" /> Verified
                          </Badge>
                        </div>
                        {project.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{project.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[9px] h-4 capitalize">
                            {project.type?.replace(/_/g, ' ')}
                          </Badge>
                          {project.year && <span className="text-[10px] text-muted-foreground">{project.year}</span>}
                          {project.client_brand && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Building2 className="h-2.5 w-2.5" /> {project.client_brand}
                            </span>
                          )}
                        </div>
                        {/* Claimable roles */}
                        {project.icdb_project_roles?.filter((r: any) => !r.is_claimed).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {project.icdb_project_roles.filter((r: any) => !r.is_claimed).map((role: any) => (
                              <Button
                                key={role.id}
                                variant="outline"
                                size="sm"
                                className="h-5 text-[9px] gap-0.5 px-2"
                                onClick={() => claimIcdbRole(project, role)}
                              >
                                <UserPlus className="h-2.5 w-2.5" /> {role.role_title}
                              </Button>
                            ))}
                          </div>
                        )}
                        {/* If no unclaimed roles, allow claiming with custom role */}
                        {(!project.icdb_project_roles || project.icdb_project_roles.filter((r: any) => !r.is_claimed).length === 0) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] gap-1 mt-1"
                            onClick={() => claimIcdbRole(project, { role_title: '' })}
                          >
                            <Plus className="h-3 w-3" /> Add my role on this project
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Results */}
              {searching && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Searching ICDB & platforms...</span>
                </div>
              )}

              {!searching && webResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {webResults.length} result{webResults.length !== 1 ? 's' : ''} — tap to claim
                  </p>
                  {webResults.map((result, i) => {
                    const platformLabel = result.platform || result.url?.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/)?.[1] || '';
                    const typeLabel = result.type?.replace(/_/g, ' ') || '';
                    
                    return (
                      <Card
                        key={i}
                        className="p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                        onClick={() => claimResult(result)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Thumbnail */}
                          {result.image_url ? (
                            <img 
                              src={result.image_url} 
                              alt={result.title}
                              className="w-12 h-12 rounded-lg object-cover shrink-0 bg-muted"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                              <Database className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-semibold">{result.title}</p>
                            
                            {/* Description */}
                            {result.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2">{result.description}</p>
                            )}
                            
                            {/* Platform + Type + Year badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {platformLabel && (
                                <Badge variant="secondary" className="text-[9px] h-4 gap-0.5">
                                  {platformLabel}
                                </Badge>
                              )}
                              {typeLabel && (
                                <Badge variant="outline" className="text-[9px] h-4 capitalize">
                                  {typeLabel}
                                </Badge>
                              )}
                              {result.year && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {result.year}
                                </span>
                              )}
                              {result.location && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {result.location}
                                </span>
                              )}
                            </div>
                            
                            {result.role_suggestion && (
                              <p className="text-[11px] text-primary font-medium">
                                Suggested role: {result.role_suggestion}
                              </p>
                            )}
                            {result.client_brand && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Building2 className="h-2.5 w-2.5" />
                                {result.client_brand}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {!searching && hasSearched && webResults.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No results found — add it manually</p>
                </div>
              )}

              {/* Manual entry */}
              <Button variant="outline" className="w-full text-sm gap-2" onClick={goManual}>
                <Plus className="h-4 w-4" />
                {searchQuery ? `Add "${searchQuery}" manually` : "Add credit manually"}
              </Button>
            </div>
          ) : (
            /* DETAILS STEP — simplified */
            <div className="space-y-4">
              <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" onClick={() => setStep("search")}>
                ← Back
              </Button>

              {/* Uploaded media preview */}
              {uploadedFile && (
                <div className="relative rounded-lg overflow-hidden bg-muted/30 border">
                  {uploadedFile.type === 'image' ? (
                    <img src={uploadedFile.url} alt="Upload" className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-20 flex items-center justify-center gap-2 text-muted-foreground">
                      {uploadedFile.type === 'video' ? <Video className="h-6 w-6" /> : <Music className="h-6 w-6" />}
                      <span className="text-xs font-medium">{uploadedFile.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 text-white p-1 hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Essential fields only */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Project Title *</Label>
                <Input value={form.project_name} onChange={(e) => update("project_name", e.target.value)} placeholder="e.g., Carnival 2025 Main Stage" className="h-9 text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Your Role *</Label>
                <Input value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="e.g., Stage Manager, Director, Producer" className="h-9 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Project Type</Label>
                  <Select value={form.project_type} onValueChange={(v) => update("project_type", v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map(group => (
                        <SelectGroup key={group.value}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.items.map(item => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Year / Date
                  </Label>
                  <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              {/* Expandable additional fields */}
              <Collapsible open={showMore} onOpenChange={setShowMore}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                    {showMore ? 'Less details' : 'More details (optional)'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Description</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      placeholder="Brief description of your contribution..."
                      className="min-h-[50px] text-sm resize-none"
                      maxLength={500}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</Label>
                      <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g., Port of Spain" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Platform / Venue</Label>
                      <Input value={form.platform} onChange={(e) => update("platform", e.target.value)} placeholder="e.g., Netflix, Queen's Hall" className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1"><Building2 className="h-3 w-3" /> Client / Brand</Label>
                      <Input value={form.client_brand} onChange={(e) => update("client_brand", e.target.value)} placeholder="e.g., Coca-Cola" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1"><Link2 className="h-3 w-3" /> Link</Label>
                      <Input value={form.url} onChange={(e) => update("url", e.target.value)} placeholder="https://..." className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> End Date</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className="h-9 text-sm" />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Collaborators — platform users */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Users className="h-3 w-3" /> Tag Collaborators
                </Label>
                
                {selectedCollaborators.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCollaborators.map(c => (
                      <Badge key={c.user_id} variant="secondary" className="gap-1 pr-1 text-xs">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={c.avatar_url || ''} />
                          <AvatarFallback className="text-[8px]">{c.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        {c.full_name?.split(' ')[0]}
                        <button onClick={() => setSelectedCollaborators(prev => prev.filter(s => s.user_id !== c.user_id))} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={collabSearch}
                    onChange={(e) => { setCollabSearch(e.target.value); searchCollaborators(e.target.value); }}
                    placeholder="Search platform users..."
                    className="h-9 text-sm pl-8"
                  />
                  {searchingCollabs && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" />}
                </div>

                {collabResults.length > 0 && (
                  <div className="border rounded-md divide-y max-h-28 overflow-y-auto">
                    {collabResults.map(p => (
                      <button
                        key={p.user_id}
                        className="flex items-center gap-2 w-full p-2 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedCollaborators(prev => [...prev, p]);
                          setCollabResults(prev => prev.filter(r => r.user_id !== p.user_id));
                          setCollabSearch("");
                        }}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={p.avatar_url || ''} />
                          <AvatarFallback className="text-[10px]">{p.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{p.full_name}</p>
                          {p.role && <p className="text-[10px] text-muted-foreground truncate">{p.role}</p>}
                        </div>
                        <Plus className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Credit Chains — invite external collaborators */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    Invite someone not on Kretopia
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {externalCollabs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {externalCollabs.map((ext, i) => (
                        <Badge key={i} variant="outline" className="gap-1 pr-1 text-xs">
                          <Mail className="h-3 w-3" />
                          {ext.name}
                          <button onClick={() => setExternalCollabs(prev => prev.filter((_, idx) => idx !== i))} className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-5 gap-2">
                    <Input value={extName} onChange={(e) => setExtName(e.target.value)} placeholder="Name" className="h-8 text-xs col-span-2" />
                    <Input value={extEmail} onChange={(e) => setExtEmail(e.target.value)} placeholder="Email" className="h-8 text-xs col-span-2" />
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addExternalCollab} disabled={!extName || !extEmail}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    They'll receive an email + WhatsApp invite to claim their credit on Kretopia
                  </p>
                </CollapsibleContent>
              </Collapsible>

              {/* Submit */}
              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Credit
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
