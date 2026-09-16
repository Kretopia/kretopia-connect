import { useEffect, useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Calendar, MapPin, Clock, ArrowRight, Share2, Loader2, CalendarPlus, Navigation, Ticket } from "lucide-react";
import { format } from "date-fns";
import { SEO } from "@/components/SEO";
import { APP_URL } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { MyEventMatches } from "@/components/sessions/MyEventMatches";

const EventConfirmed = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const guestName = params.get("name");
  const guestEmail = params.get("email");
  const guestToken = params.get("token");
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data } = await supabase
        .from("creative_jams")
        .select("id, title, start_time, end_time, venue_name, venue_address, cover_image_url, category, created_by")
        .eq("id", eventId)
        .maybeSingle();
      setEvent(data);
      setLoading(false);
    })();
  }, [eventId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-muted-foreground">Event not found.</p>
          <Link to="/nearby"><Button variant="outline" className="mt-4">Browse events</Button></Link>
        </div>
      </div>
    );
  }

  const shareUrl = `${APP_URL}/share/event/${event.id}/`;
  const handleShare = async () => {
    const shareData = {
      title: event.title,
      text: `I just RSVP'd for ${event.title}! Join me?`,
      url: shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const buildIcs = () => {
    const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = event.end_time || new Date(new Date(event.start_time).getTime() + 2 * 60 * 60 * 1000).toISOString();
    const loc = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kretopia//Event//EN",
      "BEGIN:VEVENT",
      `UID:${event.id}@kretopia.com`,
      `DTSTAMP:${dt(new Date().toISOString())}`,
      `DTSTART:${dt(event.start_time)}`,
      `DTEND:${dt(end)}`,
      `SUMMARY:${(event.title || "").replace(/\n/g, " ")}`,
      loc ? `LOCATION:${loc.replace(/\n/g, " ")}` : "",
      `URL:${shareUrl}`,
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(event.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const directionsHref = event.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`You're in! ${event.title}`} description="RSVP confirmed" />

      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero confirmation */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/15 mb-5">
            <CheckCircle2 className="h-12 w-12 text-primary" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">You're going! 🎉</h1>
          <p className="text-muted-foreground">
            {guestName ? `Thanks, ${guestName}. ` : ""}
            We sent a confirmation to <span className="text-foreground font-medium">{guestEmail || "your email"}</span>.
          </p>
        </div>

        {/* Event card */}
        <Card className="overflow-hidden mb-6">
          {event.cover_image_url && (
            <div className="aspect-[16/9] bg-muted">
              <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <CardContent className="p-5 space-y-4">
            <h2 className="text-xl font-semibold leading-tight">{event.title}</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{format(new Date(event.start_time), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{format(new Date(event.start_time), "h:mm a")}{event.end_time ? ` – ${format(new Date(event.end_time), "h:mm a")}` : ""}</span>
              </div>
              {event.venue_name && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{event.venue_name}</div>
                    {event.venue_address && <div className="text-muted-foreground text-xs">{event.venue_address}</div>}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {user && eventId && (
          <div className="mb-6">
            <MyEventMatches eventId={eventId} currentUserId={user.id} />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={buildIcs} variant="secondary" className="py-6">
              <CalendarPlus className="h-4 w-4 mr-2" /> Add to calendar
            </Button>
            {directionsHref ? (
              <a href={directionsHref} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="secondary" className="w-full py-6">
                  <Navigation className="h-4 w-4 mr-2" /> Get directions
                </Button>
              </a>
            ) : (
              <Button variant="secondary" className="py-6" disabled>
                <Navigation className="h-4 w-4 mr-2" /> Directions
              </Button>
            )}
          </div>
          {guestToken && eventId && (
            <Link
              to={`/event/${eventId}/pass?token=${encodeURIComponent(guestToken)}${guestName ? `&name=${encodeURIComponent(guestName)}` : ""}`}
              className="block"
            >
              <Button variant="gradient" className="w-full py-6">
                <Ticket className="h-4 w-4 mr-2" /> Show my pass
              </Button>
            </Link>
          )}
          <Button onClick={handleShare} variant={guestToken ? "secondary" : "gradient"} className="w-full py-6">
            <Share2 className="h-4 w-4 mr-2" /> Invite friends
          </Button>
          {!user && (
            <Link
              to={`/auth?tab=signup${guestEmail ? `&email=${encodeURIComponent(guestEmail)}` : ""}${guestName ? `&name=${encodeURIComponent(guestName)}` : ""}&redirect=${encodeURIComponent(`/event/${event.id}`)}`}
              className="block"
            >
              <Button variant="gradient" className="w-full py-6">
                Create your free profile <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          )}
          {user && event.created_by === user.id && (
            <Link to="/events/backstage" className="block">
              <Button variant="secondary" className="w-full py-6">
                Manage event (Backstage)
              </Button>
            </Link>
          )}
          <Link to={`/event/${event.id}`} className="block">
            <Button variant="outline" className="w-full py-6">
              View event details <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Add it to your calendar so you don't forget. See you there! 🎶
        </p>
      </div>
    </div>
  );
};

export default EventConfirmed;
