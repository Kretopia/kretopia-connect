import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Users, Loader2, Ticket, X, Trash2 } from "lucide-react";
import { PayoutsConnectWarning } from "./PayoutsConnectWarning";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { LocationSearchInput } from "./LocationSearchInput";
import { Switch } from "@/components/ui/switch";
import { EventCoverPicker } from "./EventCoverPicker";
import { EventModeFormatPicker, type EventFormatValue } from "./EventModeFormatPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
  eventId: string;
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

export const EditEventDialog = ({ open, onOpenChange, onUpdated, eventId }: EditEventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("14:00");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    venue_name: '',
    venue_address: '',
    max_participants: 10,
    latitude: null as number | null,
    longitude: null as number | null,
    is_ticketed: false,
    ticket_price: 0,
    ticket_currency: 'USD',
    event_type: 'session' as 'session' | 'event',
    external_ticket_url: '',
  });

  const [formatValue, setFormatValue] = useState<EventFormatValue>({
    event_mode: 'irl',
    online_format: null,
    online_max_attendees: null,
    watch_party_video_url: '',
    recording_enabled: false,
  });

  const [requireAccount, setRequireAccount] = useState(false);
  const [guestMatching, setGuestMatching] = useState(true);

  useEffect(() => {
    if (open && eventId) fetchEvent();
  }, [open, eventId]);

  const fetchEvent = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from('creative_jams')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      toast({ title: "Error", description: "Could not load event", variant: "destructive" });
      onOpenChange(false);
      return;
    }

    const startDate = new Date(data.start_time);
    setDate(startDate);
    setTime(format(startDate, "HH:mm"));
    setExistingCoverUrl(data.cover_image_url || null);
    setCoverPreview(data.cover_image_url || null);
    setFormData({
      title: data.title,
      description: data.description || '',
      category: data.category,
      venue_name: data.venue_name || '',
      venue_address: data.venue_address || '',
      max_participants: data.max_participants || 10,
      latitude: data.latitude,
      longitude: data.longitude,
      is_ticketed: data.is_ticketed || false,
      ticket_price: data.ticket_price || 0,
      ticket_currency: data.ticket_currency || 'USD',
      event_type: (data.event_type as any) || 'session',
      external_ticket_url: (data as any).external_ticket_url || '',
    });
    setFormatValue({
      event_mode: ((data as any).event_mode as any) || 'irl',
      online_format: (data as any).online_format || null,
      online_max_attendees: (data as any).online_max_attendees || null,
      watch_party_video_url: (data as any).watch_party_video_url || '',
      recording_enabled: (data as any).recording_enabled || false,
    });
    setRequireAccount(!!(data as any).require_account_for_rsvp);
    setGuestMatching((data as any).guest_matching_enabled !== false);
    setFetching(false);
  };

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
    setExistingCoverUrl(null);
  };

  const uploadCover = async (): Promise<string | null> => {
    if (!coverFile || !user) return existingCoverUrl;
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
      const coverUrl = await uploadCover();
      const [hours, minutes] = time.split(':').map(Number);
      const startTime = new Date(date);
      startTime.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from('creative_jams')
        .update({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          venue_name: formData.venue_name,
          venue_address: formData.venue_address,
          latitude: formData.latitude,
          longitude: formData.longitude,
          start_time: startTime.toISOString(),
          max_participants: formData.max_participants,
          is_ticketed: formData.is_ticketed,
          ticket_price: formData.is_ticketed ? formData.ticket_price : 0,
          ticket_currency: formData.ticket_currency,
          event_type: formData.event_type,
          cover_image_url: coverUrl,
          external_ticket_url: formData.external_ticket_url || null,
          event_mode: formatValue.event_mode,
          online_format: formatValue.online_format,
          online_max_attendees: formatValue.online_max_attendees,
          watch_party_video_url: formatValue.watch_party_video_url || null,
          recording_enabled: formatValue.recording_enabled,
          require_account_for_rsvp: requireAccount,
          guest_matching_enabled: guestMatching,
        } as any)
        .eq('id', eventId)
        .eq('created_by', user.id);

      if (error) throw error;
      toast({ title: "Event updated!" });
      onOpenChange(false);
      onUpdated?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Delete participants first
      await supabase.from('jam_participants').delete().eq('jam_id', eventId);
      const { error } = await supabase.from('creative_jams').delete().eq('id', eventId).eq('created_by', user.id);
      if (error) throw error;
      toast({ title: "Event deleted" });
      onOpenChange(false);
      onUpdated?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (fetching) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>Update your event details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Type */}
          <div className="flex gap-2">
            <Button type="button" variant={formData.event_type === 'session' ? 'default' : 'outline'} size="sm" className="flex-1"
              onClick={() => setFormData(prev => ({ ...prev, event_type: 'session' }))}>Jam Session</Button>
            <Button type="button" variant={formData.event_type === 'event' ? 'default' : 'outline'} size="sm" className="flex-1"
              onClick={() => setFormData(prev => ({ ...prev, event_type: 'event' }))}>Event / Meetup</Button>
          </div>

          <EventCoverPicker
            coverPreview={coverPreview}
            onCoverChange={(file, preview) => { setCoverFile(file); setCoverPreview(preview); if (!file && !preview) setExistingCoverUrl(null); }}
            eventTitle={formData.title}
            eventCategory={formData.category}
          />

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={formData.category} onValueChange={v => setFormData(prev => ({ ...prev, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
          </div>

          <EventModeFormatPicker value={formatValue} onChange={setFormatValue} />

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
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Time *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="pl-10" required />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <LocationSearchInput
              value={formData.venue_address}
              onChange={val => setFormData(prev => ({ ...prev, venue_address: val }))}
              onSelect={result => setFormData(prev => ({ ...prev, venue_name: result.venueName, venue_address: result.address, latitude: result.lat, longitude: result.lng }))}
              placeholder="Search for a venue..."
            />
          </div>

          <div className="space-y-2">
            <Label>Max Participants</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="number" min={2} max={1000} value={formData.max_participants}
                onChange={e => setFormData(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 10 }))} className="pl-10" />
            </div>
          </div>

          {/* Guest experience */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-sm font-medium">Require account to RSVP</Label>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Guests must sign up or sign in before they can RSVP.
                </p>
              </div>
              <Switch checked={requireAccount} onCheckedChange={setRequireAccount} />
            </div>
            <div className="flex items-start justify-between gap-3 pt-1 border-t border-border/40">
              <div className="min-w-0">
                <Label className="text-sm font-medium">Smart Guest Matching</Label>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Show the guest roster + Smart Match intros across attendees.
                </p>
              </div>
              <Switch checked={guestMatching} onCheckedChange={setGuestMatching} />
            </div>
          </div>

          {/* Ticketing */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Paid Event / Tickets</Label>
              </div>
              <Switch checked={formData.is_ticketed} onCheckedChange={checked => setFormData(prev => ({ ...prev, is_ticketed: checked }))} />
            </div>
            {formData.is_ticketed && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Price</Label>
                    <Input type="number" min={0} step={0.01} value={formData.ticket_price || ''}
                      onChange={e => setFormData(prev => ({ ...prev, ticket_price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Currency</Label>
                    <Select value={formData.ticket_currency} onValueChange={v => setFormData(prev => ({ ...prev, ticket_currency: v }))}>
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
                    onChange={e => setFormData(prev => ({ ...prev, external_ticket_url: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Redirect users to Nomeo, Eventbrite, etc. for ticket purchase.</p>
                </div>
                <PayoutsConnectWarning visible={formData.is_ticketed && !formData.external_ticket_url && (formData.ticket_price || 0) > 0} />
              </div>
            )}
          </div>

          {/* Event Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Event Status</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="flex-1 text-xs"
                onClick={async () => {
                  await supabase.from('creative_jams').update({ status: 'cancelled', status_note: 'Cancelled by host' } as any).eq('id', eventId).eq('created_by', user?.id || '');
                  toast({ title: "Event cancelled" });
                  onUpdated?.();
                  onOpenChange(false);
                }}>
                Cancel Event
              </Button>
              <Button type="button" size="sm" variant="outline" className="flex-1 text-xs"
                onClick={async () => {
                  await supabase.from('creative_jams').update({ status: 'completed' } as any).eq('id', eventId).eq('created_by', user?.id || '');
                  toast({ title: "Event marked complete" });
                  onUpdated?.();
                  onOpenChange(false);
                }}>
                Mark Complete
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" className="gap-1.5">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove the event and all participants. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !date || !formData.title} variant="gradient">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
