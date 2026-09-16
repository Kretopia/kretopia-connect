import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoloCard } from "@/components/passport/HoloCard";
import {
  Calendar, MapPin, Users, Share2, Ticket, CheckCircle, CalendarPlus,
  Navigation, Lock, ImagePlus, Loader2, X as XIcon,
} from "lucide-react";
import { format } from "date-fns";
import { downloadIcs, openDirections } from "@/lib/eventActions";
import { APP_URL } from "@/lib/constants";

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

interface AttendeeAvatar { avatar_url: string | null; full_name: string; role?: string | null }

interface EventHeroCardProps {
  event: any;
  creator: Creator | null;
  isCreator: boolean;
  isAuthenticated: boolean;
  isPast: boolean;
  isCancelled: boolean;
  isCompleted: boolean;
  now: Date;
  participantCount: number;
  capacity: number;
  isFull: boolean;
  spotsLeft: number | null;
  showScarcity: boolean;
  participation: string | null;
  joining: boolean;
  attendeeAvatars: AttendeeAvatar[];
  roleBreakdown: string[];
  onShare: () => void;
  onShowGuestPass: () => void;
  onCancelRsvp: () => void;
  onGalleryChange: (urls: string[]) => void;
}

/**
 * Component 1 — the Holo Card. Everything about the event itself lives here:
 * cover, title, host, live countdown, the "who's going" headcount, the host's
 * gallery, and the when/where/capacity detail rows. One card, one glance.
 */
export function EventHeroCard({
  event, creator, isCreator, isAuthenticated, isPast, isCancelled, isCompleted,
  now, participantCount, capacity, isFull, spotsLeft, showScarcity,
  participation, joining, attendeeAvatars, roleBreakdown,
  onShare, onShowGuestPass, onCancelRsvp, onGalleryChange,
}: EventHeroCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  // Reset the broken-image fallback whenever the cover actually changes
  // (e.g. the host replaces it) so a stale failure doesn't stick around.
  useEffect(() => { setCoverImageFailed(false); }, [event.cover_image_url]);

  const startDate = new Date(event.start_time);
  const diff = startDate.getTime() - now.getTime();
  const daysUntil = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hoursUntil = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutesUntil = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
  const secondsUntil = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));
  const isImminent = diff > 0 && diff < 24 * 60 * 60 * 1000;

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
    <HoloCard className="mb-4 sm:mb-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card text-center px-4 pb-5 sm:px-6 sm:pb-7">
        {event.cover_image_url && !coverImageFailed ? (
          <div className="relative -mx-4 sm:-mx-6 mb-4 h-40 sm:h-56 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)]">
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="w-full h-full object-cover"
              onError={() => setCoverImageFailed(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
          </div>
        ) : (
          <div className="-mx-4 sm:-mx-6 mb-4 h-16 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20" />
        )}

        <Badge variant="secondary" className="mb-2 sm:mb-3 text-xs sm:text-sm">
          {CATEGORY_LABELS[event.category] || event.category}
        </Badge>
        <h1 className="text-xl sm:text-4xl font-bold mb-2 sm:mb-3 leading-tight">{event.title}</h1>

        {/* Hosted By — trust card */}
        <button
          type="button"
          onClick={() => creator?.username && navigate(`/u/${creator.username}`)}
          className="inline-flex items-center justify-center gap-3 mb-4 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors disabled:opacity-100"
          disabled={!creator?.username}
        >
          <Avatar className="h-11 w-11 ring-2 ring-primary/20">
            <AvatarImage src={creator?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {creator?.full_name?.charAt(0) || 'H'}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Your host</p>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm">{creator?.full_name || 'Kretopia Host'}</p>
              {creator?.id_verified && (
                <CheckCircle className="h-3.5 w-3.5 text-primary" aria-label="Verified" />
              )}
            </div>
            {(creator?.role || (creator?.hostedCount || 0) > 0) && (
              <p className="text-[11px] text-muted-foreground">
                {creator?.role}
                {creator?.role && (creator?.hostedCount || 0) > 0 && ' · '}
                {(creator?.hostedCount || 0) > 0 && `${creator!.hostedCount} ${creator!.hostedCount === 1 ? 'event' : 'events'} hosted`}
              </p>
            )}
          </div>
        </button>

        {/* Live countdown */}
        {!isPast && !isCancelled && diff > 0 && (
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10 min-w-[56px]">
              <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{daysUntil}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Days</p>
            </div>
            <span className="text-xl text-muted-foreground">:</span>
            <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10 min-w-[56px]">
              <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{String(hoursUntil).padStart(2, '0')}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Hrs</p>
            </div>
            <span className="text-xl text-muted-foreground">:</span>
            <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10 min-w-[56px]">
              <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{String(minutesUntil).padStart(2, '0')}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Min</p>
            </div>
            {isImminent && (
              <>
                <span className="text-xl text-muted-foreground">:</span>
                <div className="text-center px-3 py-1.5 rounded-lg bg-energy/15 border border-energy/40 min-w-[56px] animate-pulse">
                  <p className="text-xl sm:text-2xl font-bold text-energy tabular-nums">{String(secondsUntil).padStart(2, '0')}</p>
                  <p className="text-[10px] text-energy/80 uppercase">Sec</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Scarcity line */}
        {showScarcity && !isPast && !isCancelled && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-energy/15 border border-energy/40 text-energy text-xs font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
            Only {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
          </div>
        )}

        {/* Décompte — headcount, folded straight into the hero instead of a floating strip */}
        {attendeeAvatars.length > 0 && (
          <div className="mb-4 flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex -space-x-2.5">
              {attendeeAvatars.slice(0, 6).map((a, i) => (
                <Avatar key={i} className="h-9 w-9 border-2 border-background">
                  <AvatarImage src={a.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {a.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
              ))}
              {participantCount > 6 && (
                <div className="h-9 w-9 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">+{participantCount - 6}</span>
                </div>
              )}
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-semibold">{participantCount} {participantCount === 1 ? 'person is' : 'people are'} going</p>
              <p className="text-xs text-muted-foreground truncate">
                {roleBreakdown.length > 0 ? `Incl. ${roleBreakdown.join(', ')}` : 'Join the crew'}
              </p>
            </div>
          </div>
        )}

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
          <button
            type="button"
            onClick={onCancelRsvp}
            disabled={joining}
            className="mt-2 text-xs text-muted-foreground hover:text-destructive underline underline-offset-2"
          >
            Cancel RSVP
          </button>
        )}

        {/* Event detail — when / where / capacity, same card */}
        <div className="mt-5 pt-5 border-t border-border/60 text-left space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">When</p>
              <p className="font-medium">{format(startDate, "EEEE, MMMM d, yyyy")}</p>
              <p className="text-sm text-muted-foreground">{format(startDate, "h:mm a")}{event.end_time ? ` – ${format(new Date(event.end_time), "h:mm a")}` : ''}</p>
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
              <p className="font-medium">{participantCount}{capacity ? ` of ${capacity}` : ''} going</p>
              {isFull && <p className="text-xs text-destructive">This one's full — try the waitlist</p>}
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
                    {uploadingGallery ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
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
    </HoloCard>
  );
}

export default EventHeroCard;
