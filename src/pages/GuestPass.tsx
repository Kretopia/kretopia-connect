import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { ArrowLeft } from "lucide-react";
import { SEO } from "@/components/SEO";
import { EventPassCard } from "@/components/sessions/EventPassCard";

/**
 * Public guest boarding pass.
 * Token comes via URL — the token IS the credential, no auth required.
 * Pattern: /event/:eventId/pass?token=...&name=...
 */
const GuestPass = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const guestName = params.get("name") || "";

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("creative_jams")
          .select("id, title, start_time, end_time, venue_name, venue_address, cover_image_url")
          .eq("id", eventId)
          .maybeSingle();
        setEvent(data);
      } finally {
        setLoading(false);
      }
    })().catch(() => setLoading(false));
  }, [eventId]);

  const buildIcs = () => {
    if (!event) return;
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
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(event.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><CreativeLoader size="page" /></div>;
  }

  if (!event || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-muted-foreground">
            {!event ? "Event not found." : "No pass token in this link."}
          </p>
          {eventId && (
            <Link to={`/event/${eventId}`}>
              <Button variant="outline" className="mt-4">View event</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const directionsHref = event.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`Your pass · ${event.title}`} description="Show this at the door" />

      <div className="max-w-md mx-auto px-4 py-6 sm:py-10">
        <Link to={`/event/${eventId}/confirmed`} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <EventPassCard
          eventTitle={event.title}
          guestName={guestName}
          startTime={event.start_time}
          venueName={event.venue_name}
          venueAddress={event.venue_address}
          token={token}
          loading={false}
          onDownloadCalendar={buildIcs}
          directionsHref={directionsHref}
        />

        <p className="text-center text-xs text-muted-foreground mt-6">
          Save this page or screenshot the QR — no signal at the door? No problem.
        </p>
      </div>
    </div>
  );
};

export default GuestPass;
