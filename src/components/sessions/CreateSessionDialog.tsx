import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, MapPin, Clock, Users, Loader2, Ticket, X, ScanLine, Sparkles, Zap, MessageSquare, Plus, Trash2 } from "lucide-react";
import { PayoutsConnectWarning } from "./PayoutsConnectWarning";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { LocationSearchInput } from "./LocationSearchInput";
import { Switch } from "@/components/ui/switch";
import { EventCoverPicker } from "./EventCoverPicker";
import { ScanFlyerDialog, type ScannedEventDetails } from "./ScanFlyerDialog";
import { EventModeFormatPicker, type EventFormatValue } from "./EventModeFormatPicker";
import { EventArchetypePicker } from "./EventArchetypePicker";
import type { EventArchetypeId } from "@/lib/eventArchetypes";
import { findArchetype } from "@/lib/eventArchetypes";
import { createEventStudio } from "@/lib/createEventStudio";
import { useNavigate } from "react-router-dom";


interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  defaultLocation?: { lat: number; lng: number };
  defaultCircleId?: string;
  /** Prefill from an AI extraction (e.g. the "Host an event" describe-it card). */
  initialDetails?: ScannedEventDetails | null;
}


const EVENT_CATEGORIES = [
  { value: 'music', label: 'Music Jam / Concert' },
  { value: 'film', label: 'Film Shoot / Screening' },
  { value: 'photo', label: 'Photo Walk / Shoot' },
  { value: 'art', label: 'Art Collab / Exhibition' },
  { value: 'podcast', label: '🎙Podcast / Live Recording' },
  { value: 'content', label: 'Content Creation' },
  { value: 'workshop', label: 'Workshop / Masterclass' },
  { value: 'networking', label: 'Networking / Meetup' },
  { value: 'festival', label: 'Festival / Fair' },
  { value: 'showcase', label: 'Showcase / Open Mic' },
  { value: 'general', label: 'General Creative' },
];

export const CreateSessionDialog = ({ 
  open, 
  onOpenChange, 
  onCreated,
  defaultLocation,
  defaultCircleId,
  initialDetails,

}: CreateSessionDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("14:00");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  // userCircles removed
  const [scanOpen, setScanOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"quick" | "workspace">("quick");
  const [archetype, setArchetype] = useState<EventArchetypeId | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    venue_name: '',
    venue_address: '',
    max_participants: 10,
    latitude: defaultLocation?.lat || null,
    longitude: defaultLocation?.lng || null,
    is_ticketed: false,
    ticket_price: 0,
    ticket_currency: 'USD',
    event_type: 'session' as 'session' | 'event',
    external_ticket_url: '',
    circle_id: defaultCircleId || '',
  });

  const [formatValue, setFormatValue] = useState<EventFormatValue>({
    event_mode: 'irl',
    online_format: null,
    online_max_attendees: null,
    watch_party_video_url: '',
    recording_enabled: false,
  });

  // Guest experience: account-required RSVP + Smart Guest Matching
  const [requireAccount, setRequireAccount] = useState(false);
  const [guestMatching, setGuestMatching] = useState(true);

  // Custom RSVP questions captured at creation time (saved after event insert)
  const [rsvpQuestions, setRsvpQuestions] = useState<Array<{ question: string; required: boolean }>>([]);
  const [newRsvpQ, setNewRsvpQ] = useState("");
  const [newRsvpReq, setNewRsvpReq] = useState(false);

  const addRsvpQuestion = () => {
    const q = newRsvpQ.trim();
    if (!q || rsvpQuestions.length >= 5) return;
    setRsvpQuestions(prev => [...prev, { question: q, required: newRsvpReq }]);
    setNewRsvpQ("");
    setNewRsvpReq(false);
  };
  const removeRsvpQuestion = (idx: number) =>
    setRsvpQuestions(prev => prev.filter((_, i) => i !== idx));

  // (Circle linking removed — Circles are not part of the active product surface.)

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
  };

  const applyScannedDetails = (
    details: ScannedEventDetails,
    flyerFile: File,
    flyerPreview: string,
  ) => {
    // Use flyer as cover image
    setCoverFile(flyerFile);
    setCoverPreview(flyerPreview);

    // Apply date/time
    if (details.start_date) {
      const parsed = new Date(`${details.start_date}T${details.start_time || "12:00"}:00`);
      if (!isNaN(parsed.getTime())) setDate(parsed);
    }
    if (details.start_time && /^\d{2}:\d{2}$/.test(details.start_time)) {
      setTime(details.start_time);
    }

    setFormData(prev => ({
      ...prev,
      title: details.title || prev.title,
      description: details.description || prev.description,
      category: details.category || prev.category,
      venue_name: details.venue_name || prev.venue_name,
      venue_address: details.venue_address || prev.venue_address,
      max_participants: details.max_participants ?? prev.max_participants,
      is_ticketed: details.is_ticketed ?? prev.is_ticketed,
      ticket_price: details.ticket_price ?? prev.ticket_price,
      ticket_currency: details.ticket_currency || prev.ticket_currency,
      external_ticket_url: details.external_ticket_url || prev.external_ticket_url,
      event_type: 'event',
    }));
  };

  // Prefill from an AI extraction handed in by the parent (no flyer image involved).
  useEffect(() => {
    if (!open || !initialDetails) return;
    const d = initialDetails;
    if (d.start_date) {
      const parsed = new Date(`${d.start_date}T${d.start_time || "12:00"}:00`);
      if (!isNaN(parsed.getTime())) setDate(parsed);
    }
    if (d.start_time && /^\d{2}:\d{2}$/.test(d.start_time)) setTime(d.start_time);
    setFormData(prev => ({
      ...prev,
      title: d.title || prev.title,
      description: d.description || prev.description,
      category: d.category || prev.category,
      venue_name: d.venue_name || prev.venue_name,
      venue_address: d.venue_address || prev.venue_address,
      max_participants: d.max_participants ?? prev.max_participants,
      is_ticketed: d.is_ticketed ?? prev.is_ticketed,
      ticket_price: d.ticket_price ?? prev.ticket_price,
      ticket_currency: d.ticket_currency || prev.ticket_currency,
      external_ticket_url: d.external_ticket_url || prev.external_ticket_url,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDetails]);



  const uploadCover = async (): Promise<string | null> => {
    if (!coverFile || !user) return null;
    const ext = coverFile.name.split('.').pop();
    const path = `${user.id}/events/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('portfolio').upload(path, coverFile);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(path);
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !date) return;

    setLoading(true);
    try {
      // Upload cover image if selected
      const coverUrl = await uploadCover();

      // Combine date and time
      const [hours, minutes] = time.split(':').map(Number);
      const startTime = new Date(date);
      startTime.setHours(hours, minutes, 0, 0);

      const isWorkspace = createMode === "workspace" && !!archetype;
      const arch = archetype ? findArchetype(archetype) : null;
      const finalCategory = isWorkspace && arch ? arch.category : formData.category;

      const { data: inserted, error } = await supabase.from('creative_jams').insert({
        created_by: user.id,
        title: formData.title,
        description: formData.description,
        category: finalCategory,
        venue_name: formData.venue_name,
        venue_address: formData.venue_address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        start_time: startTime.toISOString(),
        max_participants: formData.max_participants,
        is_public: true,
        status: 'upcoming',
        is_ticketed: formData.is_ticketed,
        ticket_price: formData.is_ticketed ? formData.ticket_price : 0,
        ticket_currency: formData.ticket_currency,
        event_type: isWorkspace ? 'event' : formData.event_type,
        cover_image_url: coverUrl,
        external_ticket_url: formData.external_ticket_url || null,
        circle_id: formData.circle_id || null,
        tags: isWorkspace && arch ? arch.defaultTags : [],
        event_mode: formatValue.event_mode,
        online_format: formatValue.online_format,
        online_max_attendees: formatValue.online_max_attendees,
        watch_party_video_url: formatValue.watch_party_video_url || null,
        recording_enabled: formatValue.recording_enabled,
        require_account_for_rsvp: requireAccount,
        guest_matching_enabled: guestMatching,
      } as any).select('id').single();

      if (error) throw error;

      // Persist custom RSVP questions if the host added any
      if (inserted?.id && rsvpQuestions.length > 0) {
        const rows = rsvpQuestions.map((q, idx) => ({
          event_id: inserted.id as string,
          question: q.question,
          question_type: "short_text",
          required: q.required,
          position: idx,
          created_by: user.id,
        }));
        const { error: qErr } = await supabase.from("event_rsvp_questions").insert(rows as any);
        if (qErr) console.warn("[create-event] RSVP questions failed", qErr);
      }

      // If full Production Workspace was selected, create the linked Studio.
      if (isWorkspace && inserted?.id && archetype) {
        try {
          const projectId = await createEventStudio({
            eventId: inserted.id as string,
            userId: user.id,
            title: formData.title,
            description: formData.description,
            startTime: startTime.toISOString(),
            archetypeId: archetype,
            coverUrl: coverUrl,
          });
          toast({
            title: "Production workspace ready",
            description: "Opening your event Studio…",
          });
          onOpenChange(false);
          onCreated?.();
          navigate(`/desk/${projectId}`);
          return;
        } catch (studioErr: any) {
          console.error("createEventStudio failed", studioErr);
          toast({
            title: "Event created, workspace failed",
            description: studioErr?.message ?? "Open the event and try again.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Event created!",
        description: "Others can now find and join your event",
      });

      onOpenChange(false);
      onCreated?.();

      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'general',
        venue_name: '',
        venue_address: '',
        max_participants: 10,
        latitude: null,
        longitude: null,
        is_ticketed: false,
        ticket_price: 0,
        ticket_currency: 'USD',
        event_type: 'session',
        external_ticket_url: '',
        circle_id: '',
      });
      setDate(undefined);
      setCoverFile(null);
      setCoverPreview(null);
      setFormatValue({
        event_mode: 'irl',
        online_format: null,
        online_max_attendees: null,
        watch_party_video_url: '',
        recording_enabled: false,
      });
      setRsvpQuestions([]);
      setNewRsvpQ("");
      setNewRsvpReq(false);
      setRequireAccount(false);
      setGuestMatching(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Not supported", description: "Geolocation is not supported by your browser", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({ ...prev, latitude: position.coords.latitude, longitude: position.coords.longitude }));
        toast({ title: "Location detected", description: "Your current location will be used for the venue" });
      },
      () => {
        toast({ title: "Location error", description: "Could not detect your location", variant: "destructive" });
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Create an Event</DialogTitle>
          <DialogDescription>Host a meetup, jam session, workshop, or event for creators</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick vs Production Workspace fork */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setCreateMode("quick")}
              className={`rounded-lg px-3 py-2 text-left transition-colors ${
                createMode === "quick" ? "bg-primary text-primary-foreground" : "hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <Zap className="h-3 w-3" /> Quick Event
              </div>
              <p className="text-[10px] opacity-80 mt-0.5 leading-tight">Just publish & share.</p>
            </button>
            <button
              type="button"
              onClick={() => setCreateMode("workspace")}
              className={`rounded-lg px-3 py-2 text-left transition-colors ${
                createMode === "workspace"
                  ? "bg-[hsl(var(--energy))] text-[hsl(var(--background))]"
                  : "hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <Sparkles className="h-3 w-3" /> Production Workspace
              </div>
              <p className="text-[10px] opacity-80 mt-0.5 leading-tight">Full Studio + run sheet.</p>
            </button>
          </div>

          {createMode === "workspace" && (
            <EventArchetypePicker value={archetype} onChange={setArchetype} />
          )}

          {createMode === "quick" && (
            <div className="flex gap-2">
              <Button type="button" variant={formData.event_type === 'session' ? 'default' : 'outline'} size="sm" className="flex-1"
                onClick={() => setFormData(prev => ({ ...prev, event_type: 'session' }))}>Jam Session</Button>
              <Button type="button" variant={formData.event_type === 'event' ? 'default' : 'outline'} size="sm" className="flex-1"
                onClick={() => setFormData(prev => ({ ...prev, event_type: 'event' }))}>Event / Meetup</Button>
            </div>
          )}

          {/* Scan Flyer shortcut */}
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="w-full flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-left hover:bg-primary/10 transition-colors"
          >
            <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <ScanLine className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">Scan a flyer with AI</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Auto-fill title, date, venue & more from an image</p>
            </div>
          </button>

          <EventCoverPicker
            coverPreview={coverPreview}
            onCoverChange={(file, preview) => { setCoverFile(file); setCoverPreview(preview); }}
            eventTitle={formData.title}
            eventCategory={formData.category}
          />

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder={formData.event_type === 'event' ? "e.g., Creator Meetup Bali, Open Mic Night" : "e.g., Sunset Photo Walk, Music Jam"}
              value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="What's the vibe? What should people bring?" value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
          </div>

          {/* Hybrid mode + online format */}
          <EventModeFormatPicker value={formatValue} onChange={setFormatValue} />

          {/* Date & Time - stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} disabled={(date) => date < new Date()} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="pl-10" required />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <LocationSearchInput value={formData.venue_address}
              onChange={(val) => setFormData(prev => ({ ...prev, venue_address: val }))}
              onSelect={(result) => setFormData(prev => ({ ...prev, venue_name: result.venueName, venue_address: result.address, latitude: result.lat, longitude: result.lng }))}
              placeholder="Search for a venue, address, or place..." />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={detectLocation} className="text-xs gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Use current location
              </Button>
            </div>
            {formData.latitude && formData.longitude && (
              <p className="text-xs text-muted-foreground">{formData.venue_name || 'Location set'} ({formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)})</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_participants">Max Participants</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="max_participants" type="number" min={2} max={1000} value={formData.max_participants}
                onChange={(e) => setFormData(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 10 }))} className="pl-10" />
            </div>
          </div>

          {/* Ticketing */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="ticketed" className="text-sm font-medium">Paid Event / Tickets</Label>
              </div>
              <Switch id="ticketed" checked={formData.is_ticketed}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_ticketed: checked }))} />
            </div>
            {formData.is_ticketed && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Price</Label>
                    <Input type="number" min={0} step={0.01} placeholder="0.00" value={formData.ticket_price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, ticket_price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Currency</Label>
                    <Select value={formData.ticket_currency} onValueChange={(v) => setFormData(prev => ({ ...prev, ticket_currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="IDR">IDR (Rp)</SelectItem>
                        <SelectItem value="TTD">TTD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">External Ticket Link (optional)</Label>
                  <Input 
                    type="url" 
                    placeholder="https://nomeo.io/m/... or Eventbrite link" 
                    value={formData.external_ticket_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, external_ticket_url: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Paste a Nomeo, Eventbrite, or other ticket link. Users will be redirected there to purchase.</p>
                </div>
                <PayoutsConnectWarning visible={formData.is_ticketed && !formData.external_ticket_url && (formData.ticket_price || 0) > 0} />
              </div>
            )}
          </div>

          {/* Guest experience — account requirement + Smart Guest Matching */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" /> Require account to RSVP
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Off (default): guests can RSVP with just name + email. On: they have to sign up or sign in first.
                </p>
              </div>
              <Switch checked={requireAccount} onCheckedChange={setRequireAccount} />
            </div>

            <div className="flex items-start justify-between gap-3 pt-1 border-t border-border/40">
              <div className="min-w-0">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> Smart Guest Matching
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Surface a guest roster and Smart Match intros across attendees. {requireAccount ? "Recommended — your guests have profiles." : "Tip: turn on \u201CRequire account\u201D so matches actually have profiles."}
                </p>
              </div>
              <Switch checked={guestMatching} onCheckedChange={setGuestMatching} />
            </div>
          </div>

          {/* Custom RSVP Questions (optional) — captured at creation, editable later in Backstage */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium">RSVP Questions <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Ask guests up to 5 questions when they RSVP — dietary needs, what they create, what would make this a win for them. Editable later in Backstage.
                </p>
              </div>
            </div>

            {rsvpQuestions.length > 0 && (
              <div className="space-y-1.5">
                {rsvpQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">{q.question}</p>
                      {q.required && <span className="text-[10px] text-muted-foreground">Required</span>}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeRsvpQuestion(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {rsvpQuestions.length < 5 && (
              <div className="space-y-2">
                <Input
                  placeholder="e.g., What do you create?"
                  value={newRsvpQ}
                  onChange={(e) => setNewRsvpQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addRsvpQuestion(); }
                  }}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Switch checked={newRsvpReq} onCheckedChange={setNewRsvpReq} />
                    Required
                  </label>
                  <Button type="button" size="sm" variant="outline" onClick={addRsvpQuestion} disabled={!newRsvpQ.trim()} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Circle linking removed */}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button
              type="submit"
              disabled={loading || !date || !formData.title || (createMode === "workspace" && !archetype)}
              className="flex-1"
              variant="gradient"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {createMode === "workspace"
                ? "Open Production Workspace"
                : `Create ${formData.event_type === "event" ? "Event" : "Session"}`}
            </Button>
          </div>
        </form>
      </DialogContent>
      <ScanFlyerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onExtracted={applyScannedDetails}
      />
    </Dialog>
  );
};
