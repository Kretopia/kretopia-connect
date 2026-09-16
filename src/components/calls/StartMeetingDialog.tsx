import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  Video,
  UserPlus,
  Check,
  Mic,
  Circle,
  Calendar as CalendarIcon,
  Sparkles,
  Users,
  Copy,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { MeetingReadySheet } from "@/components/calls/MeetingReadySheet";
import { APP_URL } from "@/lib/constants";

export type MeetingSource = "studio" | "dm" | "profile" | "event" | "adhoc" | "circle";

interface PersonOption {
  id: string;
  name: string;
  avatar?: string | null;
  preselected?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: MeetingSource;
  title?: string;
  /** Members to suggest as invitees (project members, conversation peers, circle members…). */
  people?: PersonOption[];
  projectId?: string | null;
  conversationId?: string | null;
  eventId?: string | null;
  circleId?: string | null;
  /** Default tab to show. */
  defaultTab?: "instant" | "schedule" | "workshop";
}

type Mode = "instant" | "schedule" | "workshop";

const WORKSHOP_CAPS = [50, 100, 250, 500] as const;

/**
 * Unified "Start a video call" surface — Instant · Schedule · Workshop.
 * Mobile-first bottom sheet. Reuses MeetingReadySheet (link-first) → VideoCallSheet (lobby).
 */
export const StartMeetingDialog = ({
  open,
  onOpenChange,
  source,
  title,
  people = [],
  projectId,
  conversationId,
  eventId,
  circleId,
  defaultTab = "instant",
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>(defaultTab);
  const [meetingTitle, setMeetingTitle] = useState(title || "");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>(
    () => defaultDateTimeLocal(),
  );
  const [capacity, setCapacity] = useState<number>(50);
  const [recording, setRecording] = useState(true);
  const [transcript, setTranscript] = useState(true);
  const [knock, setKnock] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(people.filter((p) => p.preselected).map((p) => p.id)),
  );
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{
    meetingId: string;
    roomUrl: string;
    token: string;
    shareUrl: string;
    scheduled: boolean;
  } | null>(null);
  const [readyOpen, setReadyOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Host";

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const maxParticipants = useMemo(() => {
    if (mode === "workshop") return capacity;
    if (mode === "instant") return 25;
    return 25;
  }, [mode, capacity]);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const scheduledIso =
        mode === "schedule" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null;

      const { data, error } = await supabase.functions.invoke("create-meeting", {
        body: {
          source,
          title: meetingTitle || title || (mode === "workshop" ? "Workshop" : "Meeting"),
          project_id: projectId ?? null,
          conversation_id: conversationId ?? null,
          event_id: eventId ?? null,
          circle_id: circleId ?? null,
          invited_user_ids: Array.from(selected),
          recording_enabled: recording,
          transcript_enabled: transcript,
          knocking_enabled: knock,
          max_participants: maxParticipants,
          scheduled_for: scheduledIso,
        },
      });
      if (error) throw error;
      if (!data?.room_url || !data?.host_token) throw new Error("No room");

      const shareUrl = `${APP_URL}/meet/${data.meeting_id}?t=${data.share_token}`;
      setCreated({
        meetingId: data.meeting_id,
        roomUrl: data.room_url,
        token: data.host_token,
        shareUrl,
        scheduled: !!scheduledIso,
      });
      setReadyOpen(true);
    } catch (e: any) {
      console.error("[StartMeetingDialog]", e);
      toast({
        title: "Couldn't start the meeting",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    setReadyOpen(false);
    setCallOpen(true);
  };

  const ctaLabel =
    mode === "instant"
      ? `Get my link${selected.size > 0 ? ` (${selected.size} invited)` : ""}`
      : mode === "schedule"
      ? "Schedule & copy link"
      : `Create workshop (${capacity} cap)`;

  return (
    <>
      <Sheet
        open={open && !readyOpen && !callOpen}
        onOpenChange={onOpenChange}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 max-h-[92vh] sm:max-w-lg sm:mx-auto overflow-hidden flex flex-col"
        >
          <SheetHeader className="px-5 pt-5 pb-3 text-left shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Video className="h-4 w-4" />
              </span>
              Start a video call
            </SheetTitle>
            <SheetDescription>
              Pick a mode. Your link appears before you join.
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="px-5 shrink-0">
              <TabsList className="grid w-full grid-cols-3 h-10">
                <TabsTrigger value="instant" className="text-xs gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Instant
                </TabsTrigger>
                <TabsTrigger value="schedule" className="text-xs gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" /> Schedule
                </TabsTrigger>
                <TabsTrigger value="workshop" className="text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Workshop
                </TabsTrigger>
              </TabsList>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-5 space-y-4"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            >
              {/* Shared: title */}
              <Field label="What's this call about?">
                <Input
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder={title || (mode === "workshop" ? "My workshop" : "Quick sync")}
                  className="h-11"
                />
              </Field>

              <TabsContent value="instant" className="m-0 space-y-4">
                <PeoplePicker
                  people={people}
                  selected={selected}
                  onToggle={toggle}
                  projectId={projectId ?? null}
                />
                <SettingsBlock
                  recording={recording}
                  setRecording={setRecording}
                  transcript={transcript}
                  setTranscript={setTranscript}
                  knock={knock}
                  setKnock={setKnock}
                />
              </TabsContent>

              <TabsContent value="schedule" className="m-0 space-y-4">
                <Field label="When?">
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    min={defaultDateTimeLocal()}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="h-11"
                  />
                </Field>
                <Field label="Description (optional)">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What you'll cover, links, anything attendees should know."
                    rows={3}
                  />
                </Field>
                <PeoplePicker
                  people={people}
                  selected={selected}
                  onToggle={toggle}
                  projectId={projectId ?? null}
                />
                <SettingsBlock
                  recording={recording}
                  setRecording={setRecording}
                  transcript={transcript}
                  setTranscript={setTranscript}
                  knock={knock}
                  setKnock={setKnock}
                />
                <p className="text-[11px] text-muted-foreground">
                  We'll generate a link you can drop into a calendar invite, WhatsApp,
                  or anywhere else.
                </p>
              </TabsContent>

              <TabsContent value="workshop" className="m-0 space-y-4">
                <Field label="Capacity">
                  <div className="grid grid-cols-4 gap-2">
                    {WORKSHOP_CAPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCapacity(c)}
                        className={`h-11 rounded-lg border text-sm font-semibold transition-colors ${
                          capacity === c
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Description / agenda">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Welcome, intro, main session, Q&A…"
                    rows={3}
                  />
                </Field>
                <SettingsBlock
                  recording={recording}
                  setRecording={setRecording}
                  transcript={transcript}
                  setTranscript={setTranscript}
                  knock={knock}
                  setKnock={setKnock}
                  workshop
                />
                <p className="text-[11px] text-muted-foreground">
                  Attendees join with cameras off by default. Breakout rooms & polls
                  are coming soon.
                </p>
              </TabsContent>
            </div>

            <div
              className="px-5 py-3 border-t border-border bg-background shrink-0"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
            >
              <Button
                onClick={create}
                disabled={creating || (mode === "schedule" && !scheduledAt)}
                variant="hero"
                className="w-full h-12"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    {ctaLabel}
                  </>
                )}
              </Button>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Step 2: ready sheet */}
      <MeetingReadySheet
        open={readyOpen}
        onOpenChange={(o) => {
          setReadyOpen(o);
          if (!o && !callOpen) {
            onOpenChange(false);
            setCreated(null);
          }
        }}
        shareUrl={created?.shareUrl ?? null}
        onJoin={handleJoin}
        title={
          created?.scheduled
            ? "Your scheduled room is ready"
            : mode === "workshop"
            ? "Your workshop room is ready"
            : "Your call is ready"
        }
        hint={
          created?.scheduled
            ? "Share this link in your calendar invite. The room opens at the scheduled time — but you can join now to test."
            : "Share this link — guests can join without an account. Link works for 4 hours."
        }
        joinLabel={created?.scheduled ? "Join early" : "Join now"}
        calendarEvent={
          created?.scheduled && scheduledAt
            ? {
                title: meetingTitle || title || "Kretopia meeting",
                description: description
                  ? `${description}\n\nJoin: ${created.shareUrl}`
                  : `Join: ${created.shareUrl}`,
                location: created.shareUrl,
                startISO: new Date(scheduledAt).toISOString(),
                durationMinutes: 60,
              }
            : undefined
        }
      />

      {/* Step 3: live call */}
      {created && (
        <VideoCallSheet
          open={callOpen}
          onOpenChange={(v) => {
            setCallOpen(v);
            if (!v) {
              onOpenChange(false);
              setCreated(null);
            }
          }}
          projectName={meetingTitle || title || "Meeting"}
          roomUrl={created.roomUrl}
          token={created.token}
          callId={null}
          userName={userName}
          projectId={projectId ?? null}
          roomName={null}
          meetingShareUrl={created.shareUrl}
        />
      )}
    </>
  );
};

// ---------- helpers ----------

function defaultDateTimeLocal() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function PeoplePicker({
  people,
  selected,
  onToggle,
  projectId,
}: {
  people: PersonOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  projectId?: string | null;
}) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const ids = new Set<string>();
        if (projectId) {
          const { data: collabs } = await supabase
            .from("project_collaborators")
            .select("user_id")
            .eq("project_id", projectId)
            .eq("status", "accepted");
          (collabs || []).forEach((c: any) => c.user_id && ids.add(c.user_id));
        }
        const { data: conns } = await supabase
          .from("connections")
          .select("user_id, connected_user_id")
          .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
          .eq("status", "accepted");
        (conns || []).forEach((c: any) => {
          ids.add(c.user_id === user.id ? c.connected_user_id : c.user_id);
        });
        ids.delete(user.id);
        people.forEach((p) => ids.delete(p.id));
        if (!ids.size) {
          if (!cancelled) setContacts([]);
          return;
        }
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", Array.from(ids))
          .limit(200);
        if (!cancelled) {
          setContacts(
            (profiles || [])
              .map((p: any) => ({
                id: p.user_id,
                name: p.full_name || "Unnamed",
                avatar: p.avatar_url,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      } catch (e) {
        console.warn("[StartMeetingDialog] contacts", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id, projectId, people]);

  const merged = useMemo(() => {
    const seen = new Set<string>();
    const out: PersonOption[] = [];
    [...people, ...contacts].forEach((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      out.push(p);
    });
    return out;
  }, [people, contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((p) => (p.name || "").toLowerCase().includes(q));
  }, [merged, query]);

  return (
    <Field label="Add people">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your contacts…"
            className="pl-9 h-10 rounded-full"
          />
        </div>
        <div className="space-y-1 max-h-56 overflow-y-auto rounded-md border border-border">
          {loading && merged.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {merged.length === 0
                ? "No contacts yet — share the link instead."
                : "No matches."}
            </div>
          ) : (
            filtered.map((p) => {
              const on = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggle(p.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    on ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p.avatar || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(p.name || "?")
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1 truncate">{p.name}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Field>
  );
}

function SettingsBlock({
  recording,
  setRecording,
  transcript,
  setTranscript,
  knock,
  setKnock,
  workshop,
}: {
  recording: boolean;
  setRecording: (v: boolean) => void;
  transcript: boolean;
  setTranscript: (v: boolean) => void;
  knock: boolean;
  setKnock: (v: boolean) => void;
  workshop?: boolean;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border border-border p-3">
      <ToggleRow
        icon={<Circle className="h-3.5 w-3.5" />}
        label="Record this call"
        hint="Saved for the host. Everyone sees a recording badge."
        checked={recording}
        onChange={setRecording}
      />
      <ToggleRow
        icon={<Mic className="h-3.5 w-3.5" />}
        label="Live captions + transcript"
        hint="Searchable transcript after the call."
        checked={transcript}
        onChange={setTranscript}
      />
      <ToggleRow
        icon={<UserPlus className="h-3.5 w-3.5" />}
        label={workshop ? "Approve attendees from greenroom" : "Greenroom for guests"}
        hint={
          workshop
            ? "You'll see who's waiting and admit them when ready."
            : "People with the link wait until you let them in."
        }
        checked={knock}
        onChange={setKnock}
      />
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{hint}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
