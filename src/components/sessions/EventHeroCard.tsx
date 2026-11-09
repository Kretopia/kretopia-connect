import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KretoScene } from "@/components/brand/KretoScene";
import {
  Calendar, MapPin, Users, Share2, Ticket, CheckCircle, CalendarPlus,
  Navigation, Lock, ImagePlus, X as XIcon, XCircle,
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { downloadIcs, openDirections } from "@/lib/eventActions";
import { APP_URL } from "@/lib/constants";
import { eventTimeZone, formatEventTime } from "@/lib/eventTime";
import type { EventCountdown } from "@/lib/eventCountdown";

const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music', film: 'Film', photo: 'Photo', art: 'Art',
  podcast: '🎙Podcast', workshop: 'Workshop', networking: 'Networking',
  content: 'Content', festival: 'Festival', showcase: 'Showcase',
  general: 'Creative',
};

/** CEO rule: host-only gallery, capped at 6 for now. */
const MAX_GALLERY = 6;

interface Creator {
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  id_verified?: boolean | null;
  role?: string | null;
  hostedCount?: number;
}

interface EventHeroCardProps {
  event: any;
  creator: Creator | null;
  isCreator: boolean;
  isAuthenticated: boolean;
  isPast: boolean;
  isCancelled: boolean;
  isCompleted: boolean;
  countdown: EventCountdown | null;
  cityLabel: string | null;
  priceLabel: string | null;
  bookingLabel: string;
  bookingReason: string | null;
  bookingDisabled: boolean;
  participantCount: number | null;
  capacity: number;
  isFull: boolean;
  spotsLeft: number | null;
  showScarcity: boolean;
  participation: string | null;
  joining: boolean;
  onBook: () => void;
  onShare: () => void;
  onShowGuestPass: () => void;
  onCancelRsvp: () => void;
  onGalleryChange: (urls: string[]) => void;
}

/**
 * Event hero. Everything about the event itself lives here:
 * cover, title, host, live countdown, the "who's going" headcount, the host's
 * gallery, and the when/where/capacity detail rows. One card, one glance.
 */
export function EventHeroCard({
  event, creator, isCreator, isAuthenticated, isPast, isCancelled, isCompleted,
  countdown, cityLabel, priceLabel, bookingLabel, bookingReason, bookingDisabled,
  participantCount, capacity, isFull, spotsLeft, showScarcity,
  participation, joining,
  onBook, onShare, onShowGuestPass, onCancelRsvp, onGalleryChange,
}: EventHeroCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  // Reset the broken-image fallback whenever the cover actually changes
  // (e.g. the host replaces it) so a stale failure doesn't stick around.
  useEffect(() => { setCoverImageFailed(false); }, [event.cover_image_url]);

  const galleryUrls: string[] = event.gallery_image_urls || [];

  const handleGalleryFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user || !isCreator) return;
    const room = MAX_GALLERY - galleryUrls.length;
    if (room <= 0) {
      toast({ title: `Max ${MAX_GALLERY} photos`, description: "Remove one to add another.", variant: "destructive" });
      return;
    }
    setUploadingGallery(true);
    try {
      const next = [...galleryUrls];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/events/${event.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("portfolio").upload(path, file);
        if (upErr) { console.error(upErr); continue; }
        const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
        next.push(publicUrl);
      }
      const { error } = await supabase.from("creative_jams").update({ gallery_image_urls: next } as any).eq("id", event.id);
      if (error) throw error;
      onGalleryChange(next);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const removeGalleryImage = async (url: string) => {
    if (!isCreator) return;
    const next = galleryUrls.filter((u) => u !== url);
    const { error } = await supabase.from("creative_jams").update({ gallery_image_urls: next } as any).eq("id", event.id);
    if (!error) onGalleryChange(next);
  };

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card pb-5 text-left shadow-[0_20px_70px_-45px_hsl(var(--primary)/0.28)] sm:mb-8 sm:pb-7">
        <div className="relative -mx-px -mt-px h-[min(72vw,34rem)] min-h-[280px] overflow-hidden rounded-t-2xl sm:min-h-[380px]">
          {event.cover_image_url && !coverImageFailed ? (
            <img
              src={event.cover_image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setCoverImageFailed(true)}
            />
          ) : (
            <KretoScene scene="soundstages" size="thumb" className="h-full w-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/5" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-12 sm:px-8 sm:pb-8">
            <Badge variant="secondary" className="mb-3">
              {CATEGORY_LABELS[event.category] || event.category}
            </Badge>
            <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{event.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/90">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" aria-hidden />
                {formatEventTime(event.start_time)}
              </span>
              {cityLabel && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" aria-hidden />
                  {cityLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" aria-hidden />
                {participantCount === null ? "Attendance count unavailable" : `${participantCount} going`}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarImage src={creator?.avatar_url || undefined} alt="" />
                <AvatarFallback>{creator?.full_name?.charAt(0) || "H"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Hosted by</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold">{creator?.full_name || "Event host"}</p>
                  {creator?.id_verified && <CheckCircle className="h-4 w-4 text-primary" aria-label="Verified host" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pt-5 sm:px-8">
          <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admission</p>
              <p className="mt-1 text-xl font-semibold">{priceLabel || "Free"}</p>
            </div>
            <Button className="w-full sm:w-auto sm:min-w-36" disabled={bookingDisabled || joining} onClick={onBook}>
              {joining ? <KretopiaSpinner className="h-4 w-4" /> : bookingLabel}
            </Button>
          </div>
          {bookingReason && <p className="mt-2 text-sm text-muted-foreground" role="status">{bookingReason}</p>}
        </div>

        {/* Live countdown */}
        {!isPast && !isCancelled && countdown && !countdown.ended && (
          <div className="mt-4 flex items-center justify-center gap-2 sm:gap-3">
            <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10 min-w-[56px]">
              <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{countdown.days}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Days</p>
            </div>
            <span className="text-xl text-muted-foreground">:</span>
            <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10 min-w-[56px]">
              <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{String(countdown.hours).padStart(2, '0')}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Hrs</p>
            </div>
            <span className="text-xl text-muted-foreground">:</span>
            <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10 min-w-[56px]">
              <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{String(countdown.minutes).padStart(2, '0')}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Min</p>
            </div>
          </div>
        )}

        {/* Scarcity line */}
        {showScarcity && !isPast && !isCancelled && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-energy/15 border border-energy/40 text-energy text-xs font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-energy motion-safe:animate-pulse" />
            Only {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
          </div>
        )}

        {/* Décompte — headcount, folded straight into the hero instead of a floating strip */}
        {/* Quick share + pass */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onShare} className="text-muted-foreground">
            <Share2 className="h-4 w-4 mr-1.5" /> Share with friends
          </Button>
          {!!participation && (
            <Button variant="outline" size="sm" onClick={onShowGuestPass} className="gap-1.5">
              <Ticket className="h-4 w-4" /> My pass
            </Button>
          )}
        </div>
        {!!participation && !isPast && !isCompleted && (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmCancel(true)}
              disabled={joining}
              className="gap-1.5 rounded-full border-destructive/50 bg-destructive/10 px-5 font-semibold text-destructive shadow-[0_0_18px_-3px_hsl(var(--destructive)/0.55)] transition-shadow hover:border-destructive hover:bg-destructive/15 hover:text-destructive hover:shadow-[0_0_26px_-2px_hsl(var(--destructive)/0.75)]"
            >
              {joining ? <KretopiaSpinner className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              Cancel RSVP
            </Button>
          </div>
        )}
        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent className="max-w-sm rounded-2xl border-destructive/30 shadow-[0_0_40px_-8px_hsl(var(--destructive)/0.5)]">
            <AlertDialogHeader>
              <AlertDialogTitle>Release your spot?</AlertDialogTitle>
              <AlertDialogDescription>
                You won't be able to attend {event.title}. Your pass stops working and the place goes to the next person on the waitlist.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel>Keep my spot</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { setConfirmCancel(false); onCancelRsvp(); }}
                className="bg-destructive text-destructive-foreground shadow-[0_0_18px_-3px_hsl(var(--destructive)/0.6)] hover:bg-destructive/90"
              >
                Yes, cancel RSVP
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Event detail — when / where / capacity, same card */}
        <div className="mt-5 pt-5 border-t border-border/60 text-left space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">When</p>
              <p className="font-medium">Your local time · {formatEventTime(event.start_time)}</p>
              <p className="text-sm text-muted-foreground" title={`Timezone: ${eventTimeZone()}`}>
                {event.end_time ? `Ends · ${formatEventTime(event.end_time)}` : `Timezone · ${eventTimeZone()}`}
              </p>
            </div>
            {!isPast && !isCancelled && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={() => downloadIcs({
                  id: event.id,
                  title: event.title,
                  description: event.description,
                  startTime: event.start_time,
                  endTime: event.end_time,
                  venueName: event.venue_name,
                  venueAddress: event.venue_address,
                  url: `${APP_URL}/event/${event.id}`,
                })}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add to Calendar</span>
                <span className="sm:hidden">Save</span>
              </Button>
            )}
          </div>

          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            {isAuthenticated ? (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Where</p>
                <p className="font-medium truncate">{event.venue_name || 'Location TBA'}</p>
                {event.venue_address && <p className="text-sm text-muted-foreground line-clamp-2">{event.venue_address}</p>}
              </div>
            ) : (
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Where</p>
                <p className="font-medium text-muted-foreground">
                  {event.venue_name ? event.venue_name.split(',')[0] + '…' : 'Location hidden'}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Sign up to see full location
                </p>
              </div>
            )}
            {isAuthenticated && (event.venue_address || event.venue_name) && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={() => openDirections(event.venue_address, event.venue_name)}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Directions</span>
                <span className="sm:hidden">Map</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Who's coming</p>
              <p className="font-medium">
                {participantCount === null ? "Attendance count unavailable" : `${participantCount}${capacity ? ` of ${capacity}` : ''} going`}
              </p>
              {isFull && <p className="text-xs text-amber-500">This one's full — try the waitlist</p>}
            </div>
          </div>
        </div>

        {/* Gallery — host-only, capped at 6 (CEO rule) */}
        {(galleryUrls.length > 0 || isCreator) && (
          <div className="mt-5 pt-5 border-t border-border/60 text-left">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Gallery</p>
              {isCreator && galleryUrls.length < MAX_GALLERY && (
                <>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleGalleryFiles(e.target.files)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-muted-foreground"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploadingGallery}
                  >
                    {uploadingGallery ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {galleryUrls.length}/{MAX_GALLERY}
                  </Button>
                </>
              )}
            </div>
            {galleryUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {galleryUrls.map((url) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(url)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Remove photo"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Add up to {MAX_GALLERY} photos to show off the event.</p>
            )}
          </div>
        )}
    </div>
  );
}

export default EventHeroCard;
