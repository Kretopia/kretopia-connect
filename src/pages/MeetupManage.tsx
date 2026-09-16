// Organizer Command Center — /meetup/manage  (mobile-first)
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar, Users, Mail, MessageSquare, Ticket, Megaphone,
  Settings as SettingsIcon, BarChart3, Plus, ArrowLeft, ExternalLink,
  QrCode, Share2, Pencil, UserPlus, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { BlastComposerDialog } from "@/components/meetup/BlastComposerDialog";
import { CreateSessionDialog } from "@/components/sessions/CreateSessionDialog";
import { EditEventDialog } from "@/components/sessions/EditEventDialog";
import { EventAnalyticsDialog } from "@/components/sessions/EventAnalyticsDialog";
import { EventShareKit } from "@/components/sessions/EventShareKit";
import { EventCheckInDialog } from "@/components/sessions/EventCheckInDialog";
import { InviteByEmailDialog } from "@/components/sessions/InviteByEmailDialog";
import { EventHostToolsDialog } from "@/components/sessions/EventHostToolsDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_time: string;
  venue_name: string | null;
  cover_image_url: string | null;
  is_ticketed: boolean | null;
  ticket_price: number | null;
  ticket_currency: string | null;
  status: string | null;
  total_views: number | null;
  max_participants: number | null;
  created_by: string | null;
}

const TABS = [
  { v: "overview", l: "Overview", icon: BarChart3 },
  { v: "attendees", l: "Attendees", icon: Users },
  { v: "blasts", l: "Blasts", icon: Megaphone },
  { v: "tickets", l: "Tickets", icon: Ticket },
  { v: "promotion", l: "Promotion", icon: Share2 },
  { v: "messages", l: "Messages", icon: MessageSquare },
  { v: "settings", l: "Settings", icon: SettingsIcon },
] as const;

const MeetupManage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?redirect=/meetup/manage", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<typeof TABS[number]["v"]>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ rsvps: 0, tickets: 0, revenue: 0, views: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showHostTools, setShowHostTools] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("creative_jams")
      .select("id, title, description, category, start_time, venue_name, cover_image_url, is_ticketed, ticket_price, ticket_currency, status, total_views, max_participants, created_by")
      .eq("created_by", user.id)
      .order("start_time", { ascending: false })
      .limit(50);
    const list = (data as EventRow[]) || [];
    setEvents(list);
    if (list.length && !selectedId) setSelectedId(list[0].id);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!selectedId) return;
    const loadStats = async () => {
      const [{ count: rsvps }, { count: tickets }, sel] = await Promise.all([
        supabase.from("jam_participants").select("id", { count: "exact", head: true }).eq("jam_id", selectedId),
        supabase.from("event_orders" as any).select("id", { count: "exact", head: true }).eq("event_id", selectedId).eq("status", "paid"),
        supabase.from("event_orders" as any).select("amount_total").eq("event_id", selectedId).eq("status", "paid"),
      ]);
      const revenue = ((sel as any).data || []).reduce((a: number, r: any) => a + (Number(r.amount_total) || 0), 0);
      const ev = events.find(e => e.id === selectedId);
      setStats({ rsvps: rsvps || 0, tickets: tickets || 0, revenue, views: ev?.total_views || 0 });
    };
    loadStats();
  }, [selectedId, events]);

  const selected = events.find(e => e.id === selectedId);

  return (
    <div className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <Helmet>
        <title>Organizer Command Center | Kretopia Events</title>
        <meta name="description" content="Manage your events, attendees, blasts, tickets and analytics in one place." />
      </Helmet>

      {/* Cinematic header */}
      <div className="relative border-b border-border/50 bg-cinematic bg-grid-quadrille overflow-hidden pt-[env(safe-area-inset-top)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-energy/40 to-transparent" />
        <div className="relative container mx-auto max-w-6xl px-4 pt-4 pb-5 sm:pt-7 sm:pb-8">
          <button
            onClick={() => navigate("/meetup")}
            className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-[hsl(var(--energy))] transition mb-3 uppercase tracking-wider font-bold"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Events
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-energy mb-2 px-2.5 py-1 rounded-full border border-energy/30 bg-energy/[0.04]">
                <span className="h-1.5 w-1.5 rounded-full bg-energy animate-pulse" />
                Organizer mode
              </p>
              <h1 className="text-xl sm:text-4xl font-black tracking-[-0.035em] text-foreground leading-[0.95]">
                Command Center.<br />
                <span className="landing-accent">Run your event like a pro.</span>
              </h1>
            </div>
            <Button onClick={() => setShowCreate(true)} variant="gradient" size="sm" className="rounded-full shrink-0">
              <Plus className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">New Event</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="p-8 sm:p-10 text-center border-dashed bg-card/40">
            <Calendar className="h-12 w-12 mx-auto text-energy/40 mb-3" />
            <h3 className="font-black text-lg mb-1 tracking-tight">No events yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Host your first event to unlock the Command Center.</p>
            <Button onClick={() => setShowCreate(true)} variant="gradient" className="rounded-full">
              <Plus className="h-4 w-4 mr-1.5" /> Host an Event
            </Button>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
            {/* Mobile: event switcher sheet */}
            <div className="lg:hidden">
              <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
                <SheetTrigger asChild>
                  <button className="btn-glass btn-glass-outline w-full flex items-center gap-3 p-3 rounded-lg">
                    <div className="shrink-0 w-10 h-10 rounded bg-gradient-to-br from-primary/20 to-energy/10 overflow-hidden flex items-center justify-center">
                      {selected?.cover_image_url ? (
                        <img src={selected.cover_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Calendar className="h-4 w-4 text-energy" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-energy">Managing</p>
                      <p className="font-bold text-sm line-clamp-1 leading-tight">{selected?.title || "Pick an event"}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                  <SheetHeader><SheetTitle>Your Events</SheetTitle></SheetHeader>
                  <div className="space-y-2 mt-3">
                    {events.map(e => (
                      <button
                        key={e.id}
                        onClick={() => { setSelectedId(e.id); setPickerOpen(false); }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedId === e.id ? "border-energy bg-energy/5" : "border-border/50 bg-card/40"
                        }`}
                      >
                        <p className="font-bold text-sm line-clamp-1">{e.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(e.start_time), "MMM d, yyyy · h:mm a")}</p>
                      </button>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop sidebar */}
            <aside className="hidden lg:block space-y-2">
              <p className="brand-eyebrow mb-2">Your Events</p>
              {events.map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedId === e.id
                      ? "border-energy bg-energy/5 shadow-glow-lime"
                      : "border-border/50 bg-card/40 hover:border-energy/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 w-10 h-10 rounded bg-gradient-to-br from-primary/20 to-energy/10 overflow-hidden flex items-center justify-center">
                      {e.cover_image_url ? (
                        <img src={e.cover_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Calendar className="h-4 w-4 text-energy" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm line-clamp-1 leading-tight">{e.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(e.start_time), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                </button>
              ))}
            </aside>

            {/* Detail */}
            <div className="min-w-0">
              {selected && (
                <>
                  <Card className="p-3 sm:p-4 mb-3 sm:mb-4 bg-card/60 border-border/50">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <h2 className="font-black text-base sm:text-lg tracking-tight line-clamp-2">{selected.title}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(selected.start_time), "EEE, MMM d · h:mm a")}
                          {selected.venue_name && ` · ${selected.venue_name}`}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link to={`/event/${selected.id}`}>
                          <ExternalLink className="h-3 w-3 sm:mr-1.5" /> <span className="hidden sm:inline">View Page</span>
                        </Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3 sm:mt-4">
                      <Stat label="RSVPs" value={stats.rsvps} />
                      <Stat label="Tickets" value={stats.tickets} />
                      <Stat label="Revenue" value={`$${stats.revenue.toFixed(0)}`} />
                      <Stat label="Views" value={stats.views} />
                    </div>
                    {/* Quick action bar */}
                    <div className="flex items-center gap-1.5 mt-3 -mx-1 px-1 overflow-x-auto scrollbar-hide">
                      <QuickAction icon={QrCode} label="Check-In" onClick={() => setShowCheckIn(true)} />
                      <QuickAction icon={Share2} label="Share" onClick={() => setTab("promotion")} />
                      <QuickAction icon={UserPlus} label="Invite" onClick={() => setShowInvite(true)} />
                      <QuickAction icon={Megaphone} label="Blast" onClick={() => setTab("blasts")} />
                      <QuickAction icon={BarChart3} label="Analytics" onClick={() => setShowAnalytics(true)} />
                      <QuickAction icon={Pencil} label="Edit" onClick={() => setShowEdit(true)} />
                    </div>
                  </Card>

                  <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                    <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 h-auto gap-1.5 sm:gap-2 mb-4 scrollbar-hide">
                      {TABS.map(({ v, l, icon: Icon }) => (
                        <TabsTrigger
                          key={v}
                          value={v}
                          className="data-[state=active]:bg-energy data-[state=active]:text-energy-foreground data-[state=active]:shadow-glow-lime rounded-full px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shrink-0"
                        >
                          <Icon className="h-3.5 w-3.5 mr-1" /> {l}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value="overview">
                      <OverviewTab
                        eventId={selected.id}
                        onCheckIn={() => setShowCheckIn(true)}
                        onInvite={() => setShowInvite(true)}
                        onAnalytics={() => setShowAnalytics(true)}
                        onHostTools={() => setShowHostTools(true)}
                      />
                    </TabsContent>
                    <TabsContent value="attendees">
                      <AttendeesTab eventId={selected.id} onInvite={() => setShowInvite(true)} />
                    </TabsContent>
                    <TabsContent value="blasts"><BlastsTab eventId={selected.id} eventTitle={selected.title} /></TabsContent>
                    <TabsContent value="tickets">
                      <TicketsTab eventId={selected.id} onEdit={() => setShowEdit(true)} />
                    </TabsContent>
                    <TabsContent value="promotion">
                      <PromotionTab event={selected} />
                    </TabsContent>
                    <TabsContent value="messages">
                      <Placeholder
                        title="Group Chat"
                        body="Open the event page to broadcast in the attendee chat room."
                        actionLabel="Open Event Chat"
                        actionTo={`/event/${selected.id}#chat`}
                      />
                    </TabsContent>
                    <TabsContent value="settings">
                      <SettingsTab
                        onEdit={() => setShowEdit(true)}
                        onHostTools={() => setShowHostTools(true)}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateSessionDialog open={showCreate} onOpenChange={setShowCreate} onCreated={reload} />
      {selected && (
        <>
          <EditEventDialog open={showEdit} onOpenChange={setShowEdit} eventId={selected.id} onUpdated={reload} />
          <EventAnalyticsDialog
            open={showAnalytics}
            onOpenChange={setShowAnalytics}
            eventId={selected.id}
            eventTitle={selected.title}
            capacity={selected.max_participants}
            currency={selected.ticket_currency || "USD"}
          />
          <EventCheckInDialog
            open={showCheckIn}
            onOpenChange={setShowCheckIn}
            eventId={selected.id}
            eventTitle={selected.title}
          />
          <InviteByEmailDialog
            open={showInvite}
            onOpenChange={setShowInvite}
            eventId={selected.id}
            eventTitle={selected.title}
          />
          <EventHostToolsDialog
            open={showHostTools}
            onOpenChange={setShowHostTools}
            eventId={selected.id}
            eventTitle={selected.title}
          />
        </>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-lg border border-border/50 bg-card/40 p-2.5 sm:p-3">
    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">{label}</p>
    <p className="text-xl sm:text-2xl font-black tracking-tight text-energy">{value}</p>
  </div>
);

const QuickAction = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="btn-glass btn-glass-outline shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
  >
    <Icon className="h-3.5 w-3.5 text-energy" /> {label}
  </button>
);

const Placeholder = ({ title, body, actionLabel, actionTo, onAction }: { title: string; body: string; actionLabel?: string; actionTo?: string; onAction?: () => void }) => (
  <Card className="p-6 sm:p-8 text-center border-dashed bg-card/40">
    <h3 className="font-black text-lg tracking-tight mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4">{body}</p>
    {actionLabel && (actionTo ? (
      <Button asChild variant="outline" size="sm"><Link to={actionTo}>{actionLabel}</Link></Button>
    ) : onAction ? (
      <Button onClick={onAction} variant="outline" size="sm">{actionLabel}</Button>
    ) : null)}
  </Card>
);

const OverviewTab = ({ eventId, onCheckIn, onInvite, onAnalytics, onHostTools }: {
  eventId: string; onCheckIn: () => void; onInvite: () => void; onAnalytics: () => void; onHostTools: () => void;
}) => (
  <div className="space-y-3">
    <Card className="p-4 bg-card/60 border-border/50">
      <p className="brand-eyebrow mb-3">Quick Actions</p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onCheckIn} variant="outline" size="sm" className="justify-start">
          <QrCode className="h-4 w-4 mr-2 text-energy" /> Check-In
        </Button>
        <Button onClick={onInvite} variant="outline" size="sm" className="justify-start">
          <UserPlus className="h-4 w-4 mr-2 text-energy" /> Invite Guests
        </Button>
        <Button onClick={onAnalytics} variant="outline" size="sm" className="justify-start">
          <BarChart3 className="h-4 w-4 mr-2 text-energy" /> Analytics
        </Button>
        <Button onClick={onHostTools} variant="outline" size="sm" className="justify-start">
          <SettingsIcon className="h-4 w-4 mr-2 text-energy" /> Host Tools
        </Button>
        <Button asChild variant="outline" size="sm" className="justify-start col-span-2">
          <Link to={`/event/${eventId}`}><ExternalLink className="h-4 w-4 mr-2 text-energy" /> View Public Page</Link>
        </Button>
      </div>
    </Card>
  </div>
);

const AttendeesTab = ({ eventId, onInvite }: { eventId: string; onInvite: () => void }) => {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("jam_participants")
        .select("id, user_id, guest_name, guest_email, status, joined_at")
        .eq("jam_id", eventId)
        .order("joined_at", { ascending: false })
        .limit(200);
      if (error) console.error("[AttendeesTab]", error);
      const rows = (data as any[]) || [];
      const userIds = rows.map((r) => r.user_id).filter(Boolean);
      let profilesById: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("public_profiles_safe")
          .select("user_id, full_name, avatar_url, username")
          .in("user_id", userIds);
        (profs || []).forEach((p: any) => { profilesById[p.user_id] = p; });
      }
      setList(rows.map((r) => ({ ...r, profiles: r.user_id ? profilesById[r.user_id] : null })));
      setLoading(false);
    })().catch((e) => {
      console.error("[AttendeesTab]", e);
      setList([]);
      setLoading(false);
    });
  }, [eventId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="brand-eyebrow">{list.length} Attendees</p>
        <Button onClick={onInvite} variant="lime" size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" /> Invite
        </Button>
      </div>
      {loading ? (
        <div className="h-32 rounded bg-muted/40 animate-pulse" />
      ) : list.length === 0 ? (
        <Placeholder title="No attendees yet" body="Invite by email or share your event page to get the first RSVPs." actionLabel="Invite by Email" onAction={onInvite} />
      ) : (
        <Card className="bg-card/60 border-border/50 divide-y divide-border/50">
          {list.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                {p.profiles?.avatar_url && <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm line-clamp-1">{p.profiles?.full_name || p.guest_name || "Guest"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.profiles?.username ? `@${p.profiles.username} · ` : p.guest_email ? `${p.guest_email} · ` : ""}
                  {format(new Date(p.joined_at), "MMM d")}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{p.status || "going"}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

const BlastsTab = ({ eventId, eventTitle }: { eventId: string; eventTitle: string }) => {
  const [blasts, setBlasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("event_blasts" as any)
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setBlasts((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [eventId]);

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-card/60 border-border/50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="brand-eyebrow mb-1">Email Blasts</p>
            <p className="text-sm text-muted-foreground">Announcements, reminders, and thank-you notes.</p>
          </div>
          <Button variant="lime" size="sm" onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Blast
          </Button>
        </div>
      </Card>
      {loading ? (
        <div className="h-20 rounded bg-muted/40 animate-pulse" />
      ) : blasts.length === 0 ? (
        <Placeholder title="No blasts sent" body="Send your first email blast — announcement, reminder, or thank-you." actionLabel="Compose Blast" onAction={() => setComposerOpen(true)} />
      ) : (
        <Card className="bg-card/60 border-border/50 divide-y divide-border/50">
          {blasts.map(b => (
            <div key={b.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm line-clamp-1">{b.subject}</p>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{b.status}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {b.template} · {b.delivered_count ?? 0}/{b.recipient_count ?? 0} · {format(new Date(b.created_at), "MMM d, h:mm a")}
              </p>
            </div>
          ))}
        </Card>
      )}
      <BlastComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        eventId={eventId}
        eventTitle={eventTitle}
        onSent={load}
      />
    </div>
  );
};

const TicketsTab = ({ eventId, onEdit }: { eventId: string; onEdit: () => void }) => {
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("event_ticket_tiers" as any)
        .select("*")
        .eq("event_id", eventId)
        .order("position", { ascending: true });
      setTiers((data as any[]) || []);
      setLoading(false);
    })();
  }, [eventId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="brand-eyebrow">{tiers.length} Tier{tiers.length === 1 ? "" : "s"}</p>
        <Button onClick={onEdit} variant="lime" size="sm">
          <Pencil className="h-4 w-4 mr-1.5" /> Manage Tiers
        </Button>
      </div>
      {loading ? (
        <div className="h-32 rounded bg-muted/40 animate-pulse" />
      ) : tiers.length === 0 ? (
        <Placeholder title="No ticket tiers" body="Create tiered tickets — Early Bird, GA, VIP — with custom pricing and limits." actionLabel="Add Tickets" onAction={onEdit} />
      ) : (
        <Card className="bg-card/60 border-border/50 divide-y divide-border/50">
          {tiers.map(t => (
            <div key={t.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-sm">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{t.sold_count || 0} / {t.quantity || "∞"} sold</p>
              </div>
              <p className="font-black text-energy">${t.price}</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

const PromotionTab = ({ event }: { event: EventRow }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4 bg-card/60 border-border/50 space-y-3">
      <p className="brand-eyebrow">Share Kit</p>
      <p className="text-sm text-muted-foreground">
        Copy link, generate QR, share to WhatsApp/Twitter, or grab an embed snippet.
      </p>
      <Button onClick={() => setOpen(true)} variant="lime" size="sm" className="w-full sm:w-auto">
        <Share2 className="h-4 w-4 mr-1.5" /> Open Share Kit
      </Button>
      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto sm:ml-2">
        <Link to={`/event/${event.id}`}><ExternalLink className="h-4 w-4 mr-1.5" /> Preview Public Page</Link>
      </Button>
      <EventShareKit
        open={open}
        onOpenChange={setOpen}
        event={{
          id: event.id,
          title: event.title,
          description: event.description || undefined,
          start_time: event.start_time,
          venue_name: event.venue_name || undefined,
          category: event.category || "general",
          is_ticketed: event.is_ticketed,
          ticket_price: event.ticket_price,
          ticket_currency: event.ticket_currency,
          created_by: event.created_by || undefined,
        }}
      />
    </Card>
  );
};

const SettingsTab = ({ onEdit, onHostTools }: { onEdit: () => void; onHostTools: () => void }) => (
  <Card className="p-4 bg-card/60 border-border/50 space-y-2">
    <p className="brand-eyebrow mb-2">Event Settings</p>
    <Button onClick={onEdit} variant="outline" size="sm" className="w-full justify-start">
      <Pencil className="h-4 w-4 mr-2 text-energy" /> Edit Event Details
    </Button>
    <Button onClick={onHostTools} variant="outline" size="sm" className="w-full justify-start">
      <SettingsIcon className="h-4 w-4 mr-2 text-energy" /> Host Tools (RSVP questions, co-hosts, seating)
    </Button>
  </Card>
);

export default MeetupManage;
