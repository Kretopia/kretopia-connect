import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, UserCheck } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const schema = z
  .object({
    guest_name: z.string().trim().min(1, "Name required").max(100),
    guest_email: z.string().trim().email("Invalid email").max(255),
    guest_email_confirm: z.string().trim().email("Invalid email").max(255),
  })
  .refine((d) => d.guest_email.toLowerCase() === d.guest_email_confirm.toLowerCase(), {
    path: ["guest_email_confirm"],
    message: "Emails don't match",
  });

interface CustomQuestion {
  id: string;
  question: string;
  question_type: string;
  required: boolean;
  options: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  eventTitle: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  onRsvpComplete?: () => void;
}

export const GuestRsvpDialog = ({ open, onOpenChange, eventId, eventTitle, startTime, endTime, venueName, venueAddress, onRsvpComplete }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailConfirm, setEmailConfirm] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ guest_name?: string; guest_email?: string; guest_email_confirm?: string }>({});
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [nameMatches, setNameMatches] = useState<Array<{ user_id: string; full_name: string | null; username: string | null; avatar_url: string | null; role: string | null; location: string | null }>>([]);
  const [matchDismissed, setMatchDismissed] = useState(false);

  // This dialog is always mounted (its `open` prop just toggles the Dialog),
  // so the email/emailConfirm useState initializers above ran at page-mount
  // time, before auth had necessarily resolved user.email. Re-sync whenever
  // the dialog opens with a resolved email, without clobbering anything the
  // user already typed.
  useEffect(() => {
    if (open && user?.email) {
      setEmail((prev) => prev || user.email!);
      setEmailConfirm((prev) => prev || user.email!);
    }
  }, [open, user]);

  // Debounced fuzzy name lookup against public profiles
  useEffect(() => {
    if (user || matchDismissed) { setNameMatches([]); return; }
    const q = name.trim();
    if (q.length < 3) { setNameMatches([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from("public_profiles_safe")
        .select("user_id, full_name, username, avatar_url, role, location")
        .ilike("full_name", `%${q}%`)
        .eq("onboarding_completed", true)
        .limit(3);
      setNameMatches(data || []);
    }, 350);
    return () => clearTimeout(t);
  }, [name, user, matchDismissed]);

  useEffect(() => {
    if (!open || !eventId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("event_rsvp_questions")
        .select("id, question, question_type, required, options")
        .eq("event_id", eventId)
        .order("position", { ascending: true });
      setQuestions((data || []).map((d: any) => ({ ...d, options: Array.isArray(d.options) ? d.options : [] })));
    })().catch(() => {});
  }, [open, eventId]);

  const setAnswer = (id: string, value: any) => setAnswers(prev => ({ ...prev, [id]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ guest_name: name, guest_email: email, guest_email_confirm: emailConfirm });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({
        guest_name: fe.guest_name?.[0],
        guest_email: fe.guest_email?.[0],
        guest_email_confirm: fe.guest_email_confirm?.[0],
      });
      return;
    }

    // Validate required custom questions
    for (const q of questions) {
      if (q.required) {
        const a = answers[q.id];
        const isEmpty = a === undefined || a === null || a === "" || (Array.isArray(a) && a.length === 0);
        if (isEmpty) {
          toast({ title: "Missing answer", description: `"${q.question}" is required`, variant: "destructive" });
          return;
        }
      }
    }

    setLoading(true);
    let guestToken: string | null = null;
    let waitlisted = false;
    try {
      if (user) {
        // Route through the same server-side RPC EventPage's toggle button
        // uses (SECURITY DEFINER — enforces capacity/waitlist and is the
        // only path with a working ON CONFLICT target for user rows).
        const { data: result, error } = await supabase.rpc("rsvp_to_event", {
          p_event_id: eventId,
        });
        if (error) throw error;
        if (result === "full_no_waitlist") {
          throw new Error("This event is full and isn't accepting a waitlist right now.");
        }
        waitlisted = result === "waitlisted";
        if (!waitlisted) {
          // rsvp_to_event returns only a status string, not the participant
          // row -- without this lookup guestToken stays null for every
          // logged-in RSVP, so the confirmation email below silently sends
          // with no QR code (checkInToken: undefined). Guests get theirs
          // from guest_rsvp_upsert's own return value below; this is the
          // equivalent read for the signed-in path.
          const { data: row } = await supabase
            .from("jam_participants")
            .select("check_in_token")
            .eq("jam_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();
          guestToken = row?.check_in_token ?? null;
        }
      } else {
        const { data, error } = await (supabase as any).rpc("guest_rsvp_upsert", {
          p_event_id: eventId,
          p_guest_name: parsed.data.guest_name,
          p_guest_email: parsed.data.guest_email,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error("RSVP failed");
        guestToken = row.check_in_token ?? null;
      }

      // Save answers (best-effort — must not abort an already-successful RSVP)
      const answerRows = Object.entries(answers)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
        .map(([qid, v]) => ({
          event_id: eventId,
          question_id: qid,
          user_id: user?.id ?? null,
          guest_email: user ? null : parsed.data.guest_email,
          answer: { value: v },
        }));
      if (answerRows.length > 0) {
        try {
          await (supabase as any).from("event_rsvp_answers").insert(answerRows);
        } catch {
          // Non-critical — the RSVP itself already succeeded above.
        }
      }

      if (waitlisted) {
        onOpenChange(false);
        toast({ title: "You're on the waitlist", description: "We'll email you the moment a spot opens." });
        navigate(`/event/${eventId}`);
        return;
      }

      const eventTimezone = "America/Port_of_Spain";
      const eventDate = startTime
        ? new Date(startTime).toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: eventTimezone,
          })
        : undefined;
      const eventTime = startTime
        ? new Date(startTime).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: eventTimezone,
          })
        : undefined;
      const venue = venueName
        ? (venueAddress ? `${venueName}, ${venueAddress}` : venueName)
        : undefined;

      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "event-registration-confirmation",
          recipientEmail: parsed.data.guest_email,
          idempotencyKey: `guest-rsvp-${eventId}-${parsed.data.guest_email}`,
          templateData: {
            attendeeName: parsed.data.guest_name,
            attendeeEmail: parsed.data.guest_email,
            eventTitle,
            eventDate,
            eventTime,
            eventVenue: venue,
            eventUrl: `${window.location.origin}/event/${eventId}`,
            passUrl: guestToken
              ? `${window.location.origin}/event/${eventId}/pass?token=${encodeURIComponent(guestToken)}&name=${encodeURIComponent(parsed.data.guest_name)}`
              : undefined,
            checkInToken: guestToken ?? undefined,
            isGuest: !user,
          },
        },
      }).catch(() => {});

      // Auto-refresh AI guest matches (registered users only; throttled server-side)
      if (user) {
        supabase.functions.invoke("match-event-guests", {
          body: { event_id: eventId, mode: "auto" },
        }).catch(() => {});
      }

      onOpenChange(false);
      onRsvpComplete?.();
      // Land on the full event page (not gated) with a success banner.
      const qs = new URLSearchParams({
        rsvp: "confirmed",
        name: parsed.data.guest_name,
        email: parsed.data.guest_email,
      });
      if (guestToken) qs.set("token", guestToken);
      navigate(`/event/${eventId}?${qs.toString()}`);
    } catch (err: any) {
      toast({ title: "Couldn't RSVP", description: err?.message || "Try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (q: CustomQuestion) => {
    const v = answers[q.id];
    switch (q.question_type) {
      case "long_text":
      case "meet_intent":
        return (
          <textarea
            className="w-full min-h-[72px] rounded-md border bg-background p-2 text-sm"
            value={v || ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            maxLength={1000}
          />
        );
      case "single_select":
        return (
          <div className="space-y-1.5">
            {q.options.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={q.id} checked={v === opt} onChange={() => setAnswer(q.id, opt)} />
                {opt}
              </label>
            ))}
          </div>
        );
      case "multi_select":
        return (
          <div className="space-y-1.5">
            {q.options.map(opt => {
              const arr: string[] = Array.isArray(v) ? v : [];
              const checked = arr.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => {
                      const next = checked ? arr.filter(x => x !== opt) : [...arr, opt];
                      setAnswer(q.id, next);
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        );
      default:
        return (
          <Input value={v || ""} onChange={(e) => setAnswer(q.id, e.target.value)} maxLength={500} />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Reserve your spot</DialogTitle>
          <DialogDescription>
            Quick RSVP for <span className="font-medium text-foreground">{eventTitle}</span>. No account needed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guest-name">Full name</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
              error={!!errors.guest_name}
              maxLength={100}
            />
            {errors.guest_name && <p className="text-xs text-destructive">{errors.guest_name}</p>}
          </div>

          {!user && nameMatches.length > 0 && !matchDismissed && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  Is this you? Sign in — your RSVP will be saved.
                </p>
                <button
                  type="button"
                  onClick={() => setMatchDismissed(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Not me
                </button>
              </div>
              <div className="space-y-1.5">
                {nameMatches.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => {
                      const redirect = `/event/${eventId}`;
                      try { sessionStorage.setItem("post_auth_redirect", redirect); } catch {}
                      navigate(`/auth?tab=signin&redirect=${encodeURIComponent(redirect)}`);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-md bg-background/80 hover:bg-background p-2 text-left transition"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(m.full_name || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[m.role, m.location].filter(Boolean).join(" · ") || (m.username ? `@${m.username}` : "Sign in to claim")}
                      </p>
                    </div>
                    <span className="text-[11px] text-primary font-medium shrink-0">Sign in →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="guest-email">Email</Label>
            <Input
              id="guest-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              error={!!errors.guest_email}
              maxLength={255}
            />
            {errors.guest_email && <p className="text-xs text-destructive">{errors.guest_email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-email-confirm">Confirm email</Label>
            <Input
              id="guest-email-confirm"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              placeholder="Re-type your email"
              error={!!errors.guest_email_confirm}
              maxLength={255}
            />
            {errors.guest_email_confirm && (
              <p className="text-xs text-destructive">{errors.guest_email_confirm}</p>
            )}
          </div>

          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label>
                {q.question}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderQuestion(q)}
            </div>
          ))}

          <Button type="submit" variant="gradient" className="w-full py-6 text-base" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm RSVP"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
