import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KretoScene } from "@/components/brand/KretoScene";
import {
  CalendarDays, CheckCircle, ExternalLink, ImagePlus, MapPin, MoreHorizontal,
  Navigation, Share2, Ticket, UserRound, Users, X as XIcon,
} from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { openDirections } from "@/lib/eventActions";
import { eventTimeZone, formatEventTime } from "@/lib/eventTime";
import type { EventCountdown } from "@/lib/eventCountdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EventAttendeeStack, type EventAttendeePreview } from "@/components/sessions/EventAttendeeStack";
import { EventOptionsList, type EventOptionRowData } from "@/components/sessions/EventOptionsList";
import { EVENT_PAGE_CONTENT_CLASS } from "@/components/sessions/EventPageShell";

const CATEGORY_LABELS: Record<string, string> = {
  music: "Music", film: "Film", photo: "Photo", art: "Art",
  podcast: "Podcast", workshop: "Workshop", networking: "Networking",
  content: "Content", festival: "Festival", showcase: "Showcase",
  general: "Creative",
};

const MAX_GALLERY = 6;

interface Creator {
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  id_verified?: boolean | null;
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
  participantCount: number | null;
  isFull: boolean;
  participation: string | null;
  joining: boolean;
  attendees: EventAttendeePreview[];
  attendeesVisible: boolean;
  onShare: () => void;
  onShowGuestPass: () => void;
  onCancelRsvp: () => void;
  /** The calendar actions (my calendar, export), apart from RSVP and tickets. */
  calendarActions: ReactNode;
  /** Where tickets are sold when the host sells them elsewhere: its own action, apart from RSVP. */
  ticketUrl?: string | null;
  /**
   * Whether the address and the map are shown. The host can hide the Venue section; a visitor then sees the venue's name (a listing
   * headline) but not its address or directions, here or anywhere else on the page. The host always sees them.
   */
  venueDetailsVisible?: boolean;
  /** Whether the Policies section is shown, so that its link does not point at nothing. */
  policiesVisible?: boolean;
  onGalleryChange: (urls: string[]) => void;
  onSignIn: () => void;
}

export function EventHeroCard({
  event, creator, isCreator, isAuthenticated, isPast, isCancelled, isCompleted,
  countdown, cityLabel, priceLabel, participantCount, isFull, participation, joining,
  attendees, attendeesVisible, onShare, onShowGuestPass, onCancelRsvp, calendarActions,
  ticketUrl = null, venueDetailsVisible = true, policiesVisible = true, onGalleryChange, onSignIn,
}: EventHeroCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const galleryUrls: string[] = event.gallery_image_urls || [];
  const eventIsOnline = event.event_mode && event.event_mode !== "irl";
  const showAddress = venueDetailsVisible || isCreator;
  const address = showAddress ? event.venue_address : null;
  const locationValue = eventIsOnline
    ? `Online event${event.online_format ? ` · ${event.online_format}` : ""}`
    : isAuthenticated
      ? [event.venue_name, address].filter(Boolean).join(" · ") || "Location to be announced"
      : event.venue_name || (address ? "Sign in to see the full address" : "Location to be announced");

  useEffect(() => {
    setCoverImageFailed(false);
  }, [event.cover_image_url]);

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
        if (upErr) {
          console.error(upErr);
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
        next.push(publicUrl);
      }
      const { error } = await supabase.from("creative_jams").update({ gallery_image_urls: next } as any).eq("id", event.id);
      if (error) throw error;
      onGalleryChange(next);
    } catch (error: any) {
      toast({ title: "Upload failed", description: error?.message, variant: "destructive" });
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const removeGalleryImage = async (url: string) => {
    if (!isCreator) return;
    const next = galleryUrls.filter((item) => item !== url);
    const { error } = await supabase.from("creative_jams").update({ gallery_image_urls: next } as any).eq("id", event.id);
    if (error) {
      toast({ title: "Could not remove photo", description: error.message, variant: "destructive" });
      return;
    }
    onGalleryChange(next);
  };

  const optionRows: EventOptionRowData[] = [
    {
      id: "when",
      label: "When",
      value: <span title={`Shown in your local timezone (${eventTimeZone()})`}>{formatEventTime(event.start_time)} · local time</span>,
      icon: CalendarDays,
      action: calendarActions,
    },
    {
      id: "where",
      label: "Where",
      value: locationValue,
      icon: MapPin,
      action: eventIsOnline ? <span className="text-sm text-muted-foreground">Online</span>
        : isAuthenticated && showAddress && (address || event.venue_name) ? (
          <Button type="button" variant="outline" size="sm" onClick={() => openDirections(address, event.venue_name)}>
            <Navigation className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Open map
          </Button>
        ) : !isAuthenticated && address ? (
          <Button type="button" variant="outline" size="sm" onClick={onSignIn}>Sign in to view</Button>
        ) : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      id: "price",
      label: "Price",
      value: priceLabel || "Free",
      icon: Ticket,
      action: ticketUrl ? (
        <a
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get tickets <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : <a className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#event-booking">I'm Going</a>,
    },
    {
      id: "host",
      label: "Host",
      value: creator?.full_name || "Event host",
      icon: UserRound,
      action: <a className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#host">Contact host</a>,
    },
    {
      id: "attendees",
      label: "Attendees",
      value: participantCount === null ? "Attendance count unavailable" : `${participantCount} going`,
      icon: Users,
      action: <a className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#attendees">Who's coming</a>,
    },
    ...(policiesVisible ? [{
      id: "policies",
      label: "Policies",
      value: "Event policies and booking details",
      icon: ExternalLink,
      action: <a className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#about-policies">View policies</a>,
    }] : []),
  ];

  return (
    <section id="hero" aria-labelledby="event-title" className="space-y-6">
      <header className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:aspect-[16/7]">
        {event.cover_image_url && !coverImageFailed ? (
          <img
            src={event.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[50%_45%]"
            onError={() => setCoverImageFailed(true)}
          />
        ) : <KretoScene scene="soundstages" size="thumb" className="absolute inset-0 h-full w-full" />}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/5" />
        <div className={`${EVENT_PAGE_CONTENT_CLASS} absolute inset-x-0 bottom-0 pb-4 pt-12 sm:pb-6`}>
          <Badge variant="secondary" className="mb-2">{CATEGORY_LABELS[event.category] || event.category}</Badge>
          <h1 id="event-title" tabIndex={-1} className="max-w-4xl text-3xl font-bold leading-tight tracking-tight text-foreground focus-visible:outline-none sm:text-5xl">
            {event.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-foreground/90">
            <span>{formatEventTime(event.start_time)}</span>
            {cityLabel && <><span aria-hidden>·</span><span>{cityLabel}</span></>}
            <span aria-hidden>·</span><span>{priceLabel || "Free"}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarImage src={creator?.avatar_url || undefined} alt="" />
                <AvatarFallback>{creator?.full_name?.trim().charAt(0) || "H"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Hosted by</p>
                <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                  <span className="truncate">{creator?.full_name || "Event host"}</span>
                  {creator?.id_verified && <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-label="Verified host" />}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <EventAttendeeStack attendees={attendees} totalCount={participantCount ?? 0} visible={attendeesVisible} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" aria-label="More event actions">
                    <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden /> More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={onShare}><Share2 className="mr-2 h-4 w-4" aria-hidden />Share event</DropdownMenuItem>
                  {!!participation && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onShowGuestPass}><Ticket className="mr-2 h-4 w-4" aria-hidden />My pass</DropdownMenuItem>
                      {!isPast && !isCompleted && (
                        <DropdownMenuItem disabled={joining} className="text-destructive focus:text-destructive" onClick={() => setConfirmCancel(true)}>
                          Cancel RSVP
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className={`${EVENT_PAGE_CONTENT_CLASS} space-y-6`}>
        {!isPast && !isCancelled && countdown && !countdown.ended && (
          <div
            className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
            role="timer"
            aria-label={`${countdown.days} days, ${countdown.hours} hours, and ${countdown.minutes} minutes until the event`}
          >
            <span className="font-semibold text-foreground">Starts in</span>
            <span>{countdown.days} days · {countdown.hours} hours · {countdown.minutes} mins</span>
          </div>
        )}
        {isFull && !isPast && !isCancelled && (
          <p className="text-sm font-medium text-muted-foreground" role="status">This event is full{event.waitlist_enabled ? " · join the waitlist" : ""}.</p>
        )}
        <EventOptionsList rows={optionRows} />
        {(galleryUrls.length > 0 || isCreator) && (
          <section aria-label="Event gallery" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Gallery</h2>
              {isCreator && galleryUrls.length < MAX_GALLERY && (
                <>
                  <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleGalleryFiles(event.target.files)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()} disabled={uploadingGallery}>
                    {uploadingGallery ? <KretopiaSpinner className="mr-2 h-4 w-4" /> : <ImagePlus className="mr-2 h-4 w-4" aria-hidden />}
                    Add photo
                  </Button>
                </>
              )}
            </div>
            {galleryUrls.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {galleryUrls.map((url) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(url)}
                        className="absolute right-2 top-2 rounded-full bg-background/90 p-2 text-foreground opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Remove photo"
                      >
                        <XIcon className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Add up to {MAX_GALLERY} photos to show off the event.</p>}
          </section>
        )}
      </div>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Release your spot?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't be able to attend {event.title}. Your pass stops working and the place goes to the next person on the waitlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my spot</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmCancel(false); onCancelRsvp(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, cancel RSVP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default EventHeroCard;
