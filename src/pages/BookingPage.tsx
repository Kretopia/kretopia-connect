// /@:handle/book — public booking page (Calendly-style)
// Generates available slots from creator_booking_windows for the next 14 days,
// filters out blocked dates + already-scheduled meetings, then books via edge fn.
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLoader } from "@/components/brand/BrandDots";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, Loader2, Check, Fingerprint, ExternalLink, Copy } from "lucide-react";
import { downloadIcs, buildGoogleCalendarUrl } from "@/lib/calendarLinks";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Owner {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}
interface Window { weekday: number; start_minute: number; end_minute: number; slot_minutes: number; }
interface DayWithSlots { date: Date; label: string; slots: Date[]; }

export default function BookingPage() {
  const { handle: rawHandle } = useParams();
  const handle = (rawHandle || "").replace(/^@/, "").toLowerCase();
  const { user } = useAuth();

  const [owner, setOwner] = useState<Owner | null>(null);
  const [windows, setWindows] = useState<Window[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set()); // ISO start strings
  const [allDayBlocks, setAllDayBlocks] = useState<{ from: Date; to: Date }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [brief, setBrief] = useState("");
  const [booking, setBooking] = useState(false);
  const [recordConsent, setRecordConsent] = useState(true);
  const [confirmed, setConfirmed] = useState<{ shareUrl: string; start: Date; durationMin: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url, username")
        .ilike("username", handle)
        .maybeSingle();
      if (cancelled) return;
      if (!p) { setNotFound(true); setLoading(false); return; }
      setOwner(p as unknown as Owner);

      const [{ data: w }, { data: blocks }, { data: mtgs }] = await Promise.all([
        supabase
          .from("creator_booking_windows")
          .select("weekday, start_minute, end_minute, slot_minutes")
          .eq("user_id", p.user_id)
          .eq("is_active", true),
        supabase
          .from("creator_availability_blocks")
          .select("start_date, end_date, is_public")
          .eq("user_id", p.user_id)
          .gte("end_date", new Date().toISOString().split("T")[0]),
        supabase
          .from("meetings")
          .select("scheduled_for")
          .eq("host_id", p.user_id)
          .not("scheduled_for", "is", null)
          .gte("scheduled_for", new Date().toISOString()),
      ]);
      if (cancelled) return;
      setWindows((w || []) as Window[]);
      setAllDayBlocks(
        (blocks || [])
          .filter((b: any) => b.is_public !== false)
          .map((b: any) => ({ from: new Date(b.start_date + "T00:00:00Z"), to: new Date(b.end_date + "T23:59:59Z") })),
      );
      setBusy(new Set((mtgs || []).map((m: any) => new Date(m.scheduled_for).toISOString())));
      setLoading(false);
    })().catch(() => { if (!cancelled) { setNotFound(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [handle]);

  useEffect(() => {
    if (!user) return;
    const n = (user.user_metadata as any)?.full_name as string | undefined;
    if (n && !name) setName(n);
    if (user.email && !email) setEmail(user.email);
  }, [user, name, email]);

  const days: DayWithSlots[] = useMemo(() => {
    if (!windows.length) return [];
    const out: DayWithSlots[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
      const blocked = allDayBlocks.some((b) => d >= b.from && d <= b.to);
      if (blocked) continue;
      const wd = d.getUTCDay();
      const ws = windows.filter((w) => w.weekday === wd);
      if (!ws.length) continue;
      const slots: Date[] = [];
      ws.forEach((w) => {
        for (let m = w.start_minute; m + w.slot_minutes <= w.end_minute; m += w.slot_minutes) {
          const slot = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(m / 60), m % 60));
          if (slot.getTime() < Date.now() + 15 * 60 * 1000) continue;
          if (busy.has(slot.toISOString())) continue;
          slots.push(slot);
        }
      });
      if (slots.length) {
        out.push({
          date: d,
          label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
          slots,
        });
      }
    }
    return out;
  }, [windows, allDayBlocks, busy]);

  const slotDuration = windows[0]?.slot_minutes ?? 30;

  const book = async () => {
    if (!owner || !selectedSlot) return;
    if (!name.trim() || !email.trim()) { toast.error("Add your name + email"); return; }
    setBooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("book-meeting", {
        body: {
          owner_id: owner.user_id,
          start_iso: selectedSlot.toISOString(),
          duration_minutes: slotDuration,
          guest_name: name.trim(),
          guest_email: email.trim(),
          brief: brief.trim() || undefined,
          record_consent: recordConsent,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setConfirmed({ shareUrl: data.share_url, start: selectedSlot, durationMin: slotDuration });
    } catch (e: any) {
      toast.error("Couldn't book", { description: e?.message });
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><BrandLoader /></div>;
  }
  if (notFound || !owner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <Fingerprint className="h-10 w-10 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Booking page not found</h1>
        <Link to="/" className="mt-3 text-sm underline">Back home</Link>
      </div>
    );
  }

  // Confirmation
  if (confirmed) {
    const cal = {
      title: `Call with ${owner.full_name || handle}`,
      description: brief ? `${brief}\n\nJoin: ${confirmed.shareUrl}` : `Join: ${confirmed.shareUrl}`,
      location: confirmed.shareUrl,
      startISO: confirmed.start.toISOString(),
      durationMinutes: confirmed.durationMin,
    };
    return (
      <div className="min-h-screen bg-background pb-20">
        <SEO title={`Booked with ${owner.full_name || handle}`} description="See you soon" />
        <div className="max-w-md mx-auto px-4 pt-10">
          <Card className="border-[hsl(var(--signal-teal))]/40">
            <CardContent className="p-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-[hsl(var(--signal-teal))]/15 flex items-center justify-center">
                <Check className="h-6 w-6 text-[hsl(var(--signal-teal))]" />
              </div>
              <h1 className="text-xl font-bold">You're on the books.</h1>
              <p className="text-sm text-muted-foreground">
                {confirmed.start.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {confirmed.durationMin}m
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => downloadIcs(cal, "kretopia-call.ics")}>
                  <CalendarDays className="h-3.5 w-3.5" /> .ics
                </Button>
                <a href={buildGoogleCalendarUrl(cal)} target="_blank" rel="noopener">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="h-3.5 w-3.5" /> Google
                  </Button>
                </a>
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => { navigator.clipboard.writeText(confirmed.shareUrl); toast.success("Link copied"); }}
              >
                <Copy className="h-3.5 w-3.5" /> Copy join link
              </Button>
              <p className="text-[11px] text-muted-foreground pt-2">
                We sent a confirmation to {email}.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEO
        title={`Book a call with ${owner.full_name || handle} — Kretopia`}
        description={`Pick a slot. ${owner.full_name || handle} confirms instantly.`}
      />
      <div className="max-w-md mx-auto px-4 pt-8">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 ring-2 ring-[hsl(var(--signal-teal))]/30">
            <AvatarImage src={owner.avatar_url ?? undefined} />
            <AvatarFallback>{(owner.full_name || handle).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">Book a call with {owner.full_name || `@${handle}`}</h1>
          </div>
        </div>

        {windows.length === 0 ? (
          <Card className="mt-6"><CardContent className="p-5 text-center text-sm">
            <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            {owner.full_name || handle} hasn't opened up booking slots yet.
            <div className="mt-3">
              <Link to={`/@${handle}/room`} className="underline text-xs">Knock on their room instead →</Link>
            </div>
          </CardContent></Card>
        ) : days.length === 0 ? (
          <Card className="mt-6"><CardContent className="p-5 text-center text-sm text-muted-foreground">
            All booked up for the next 2 weeks. Check back soon.
          </CardContent></Card>
        ) : selectedSlot ? (
          <Card className="mt-6"><CardContent className="p-4 space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Confirm</div>
            <div className="text-sm font-semibold">
              {selectedSlot.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {slotDuration}m
            </div>
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            <Textarea placeholder="What's this about? (optional)" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={400} />
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recordConsent}
                onChange={(e) => setRecordConsent(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[hsl(var(--signal-teal))]"
              />
              <span>
                Record this call so Kreto can transcribe it, pull action items, and suggest a Studio to keep the work moving. You can turn this off.
              </span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedSlot(null)} className="flex-1">Back</Button>
              <Button variant="hero" onClick={book} disabled={booking} className="flex-1">
                {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Book it
              </Button>
            </div>
          </CardContent></Card>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              Times shown in your local timezone. Slot length: {slotDuration} min.
            </p>
            {days.map((d) => (
              <div key={d.date.toISOString()}>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {d.label}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {d.slots.map((s) => (
                    <button
                      key={s.toISOString()}
                      onClick={() => setSelectedSlot(s)}
                      className="h-10 rounded-lg border border-border hover:border-[hsl(var(--signal-teal))] hover:bg-[hsl(var(--signal-teal))]/5 text-sm font-medium transition-colors"
                    >
                      {s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link to={`/@${handle}`} className="block mt-6 text-center text-xs text-muted-foreground hover:text-foreground">
          View full Passport →
        </Link>
      </div>
    </div>
  );
}
