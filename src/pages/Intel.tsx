import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Radar, Users, FileText, Loader2, Check, X, Copy, ArrowLeft, Send, Inbox, Wand2 } from "lucide-react";
import { toast } from "sonner";

const Intel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "matches";
  const [digest, setDigest] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [epk, setEpk] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { subject: string; body: string; recipient_email: string }>>({});

  useEffect(() => { if (user) refresh(); }, [user]);

  // Realtime: new drafts pop into Outbox
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("outreach_drafts_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_drafts", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [d, l, e, dr] = await Promise.all([
        supabase.from("opportunity_intel_digests").select("*").eq("user_id", user!.id).eq("kind", "daily_match").order("generated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("sponsor_leads").select("*").eq("user_id", user!.id).neq("status", "dismissed").order("fit_score", { ascending: false }).limit(50),
        supabase.from("epk_refresh_suggestions").select("*").eq("user_id", user!.id).eq("status", "pending").order("created_at", { ascending: false }).limit(20),
        supabase.from("outreach_drafts").select("*").eq("user_id", user!.id).in("status", ["draft", "approved", "sent", "failed"]).order("created_at", { ascending: false }).limit(50),
      ]);
      setDigest(d.data);
      setLeads(l.data || []);
      setEpk(e.data || []);
      setDrafts(dr.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const generateMatches = async () => {
    setBusy("matches");
    try { await supabase.functions.invoke("daily-match-digest", { body: { user_id: user!.id } }); await refresh(); toast.success("Brief refreshed"); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const generateSponsors = async () => {
    setBusy("sponsors");
    try { const { error } = await supabase.functions.invoke("sponsor-radar", { body: { count: 6 } }); if (error) throw error; await refresh(); toast.success("Sponsor leads ready"); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const generateEpk = async () => {
    setBusy("epk");
    try { const { error } = await supabase.functions.invoke("auto-epk-updater", { body: {} }); if (error) throw error; await refresh(); toast.success("EPK suggestions ready"); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const draftPitch = async (lead: any) => {
    setBusy(`draft-${lead.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("draft-outreach-email", { body: { lead_id: lead.id } });
      if (error) throw error;
      toast.success("Pitch drafted — see Outbox");
      setSearchParams({ tab: "outbox" });
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to draft");
    } finally { setBusy(null); }
  };

  const updateLead = async (id: string, status: string) => {
    await supabase.from("sponsor_leads").update({ status }).eq("id", id);
    setLeads((prev) => prev.filter((l) => l.id !== id || status === "saved" || status === "contacted"));
    if (status === "saved" || status === "contacted") refresh();
  };

  const sendDraft = async (draft: any) => {
    const edit = editing[draft.id];
    setBusy(`send-${draft.id}`);
    try {
      // Patch first if edited
      if (edit) {
        const { error: uErr } = await supabase.from("outreach_drafts").update({
          subject: edit.subject, body: edit.body, recipient_email: edit.recipient_email,
        }).eq("id", draft.id);
        if (uErr) throw uErr;
      }
      const { data, error } = await supabase.functions.invoke("send-outreach-draft", { body: { draft_id: draft.id } });
      if (error) throw error;
      toast.success("Sent ✓");
      setEditing((prev) => { const next = { ...prev }; delete next[draft.id]; return next; });
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally { setBusy(null); }
  };

  const dismissDraft = async (id: string) => {
    await supabase.from("outreach_drafts").update({ status: "dismissed" }).eq("id", id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const applyEpk = async (s: any) => {
    const field = s.kind === "bio" ? "bio" : s.kind === "headline" ? "headline" : null;
    if (field) await supabase.from("profiles").update({ [field]: s.suggested_value }).eq("user_id", user!.id);
    await supabase.from("epk_refresh_suggestions").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", s.id);
    setEpk((prev) => prev.filter((p) => p.id !== s.id));
    toast.success("Applied to your profile");
  };
  const dismissEpk = async (id: string) => {
    await supabase.from("epk_refresh_suggestions").update({ status: "dismissed" }).eq("id", id);
    setEpk((prev) => prev.filter((p) => p.id !== id));
  };

  if (!user) return null;

  const pendingDrafts = drafts.filter((d) => d.status === "draft");
  const sentDrafts = drafts.filter((d) => d.status === "sent");

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO title="Your Intel Brief — Kretopia" description="Daily matches, sponsor radar, EPK refresh, and Kreto-drafted outreach." />
      <div className="pt-[env(safe-area-inset-top)]">
        <div className="container max-w-3xl mx-auto px-4 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 -ml-2 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <div className="mt-1 space-y-1">
            <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase flex items-center gap-1.5">
              <Radar className="h-3 w-3" />
              Opportunity Intel
            </p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">Intel Brief</h1>
            <p className="text-sm text-muted-foreground">Matches, sponsors, drafts &amp; EPK signals — refreshed daily.</p>
          </div>
        </div>
        <div className="mt-4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="container max-w-3xl mx-auto px-4 py-4">
        <Tabs value={initialTab} onValueChange={(v) => setSearchParams({ tab: v })}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="matches"><Users className="h-3.5 w-3.5 mr-1" /> Matches</TabsTrigger>
            <TabsTrigger value="sponsors"><Sparkles className="h-3.5 w-3.5 mr-1" /> Sponsors</TabsTrigger>
            <TabsTrigger value="outbox" className="relative">
              <Inbox className="h-3.5 w-3.5 mr-1" /> Outbox
              {pendingDrafts.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] text-primary-foreground font-bold">{pendingDrafts.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="epk"><FileText className="h-3.5 w-3.5 mr-1" /> EPK</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="mt-4 space-y-3">
            <Button size="sm" onClick={generateMatches} disabled={busy === "matches"} className="w-full">
              {busy === "matches" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Refresh today's brief
            </Button>
            {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loading && !digest && <p className="text-sm text-muted-foreground text-center py-8">No brief yet. Tap refresh.</p>}
            {digest && (
              <>
                {digest.payload?.summary && <p className="text-sm font-semibold">{digest.payload.summary}</p>}
                {(digest.payload?.gigs || []).map((g: any) => (
                  <Card key={g.id} className="p-3 cursor-pointer" onClick={() => navigate(`/gigs/${g.id}`)}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold line-clamp-1">{g.title}</p>
                      {g.fit != null && <Badge>{g.fit}%</Badge>}
                    </div>
                    {g.why && <p className="text-xs text-muted-foreground">{g.why}</p>}
                  </Card>
                ))}
                {(digest.payload?.matches || []).map((m: any) => (
                  <Card key={m.user_id} className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/u/${m.user_id}`)}>
                    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                      {m.avatar_url ? <img src={m.avatar_url} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-primary/20 to-energy/20" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold line-clamp-1">{m.display_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{m.primary_role}</p>
                    </div>
                    <Badge variant="outline">{m.score}%</Badge>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="sponsors" className="mt-4 space-y-3">
            <Button size="sm" onClick={generateSponsors} disabled={busy === "sponsors"} className="w-full">
              {busy === "sponsors" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Radar className="h-4 w-4 mr-2" />}
              Scan for sponsor leads
            </Button>
            {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loading && leads.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No leads yet. Tap scan.</p>}
            {leads.map((l) => (
              <Card key={l.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{l.brand_name}</p>
                    {l.niche && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{l.niche}</p>}
                  </div>
                  <Badge variant={l.fit_score >= 75 ? "default" : "outline"}>{l.fit_score}%</Badge>
                </div>
                {l.reason && <p className="text-xs text-muted-foreground">{l.reason}</p>}
                {l.pitch_draft && (
                  <div className="rounded-lg bg-muted/40 p-2 border border-border/50">
                    <p className="text-xs whitespace-pre-wrap">{l.pitch_draft}</p>
                  </div>
                )}
                {(l.contact_name || l.contact_email || l.contact_phone || l.address || l.contact_info?.hint) && (
                  <div className="space-y-0.5 text-[10px] text-muted-foreground">
                    {l.contact_name && <p>Contact: {l.contact_name}</p>}
                    {l.contact_email && <p>Email: {l.contact_email}</p>}
                    {l.contact_phone && <p>Phone: {l.contact_phone}</p>}
                    {l.address && <p>Address: {l.address}</p>}
                    {l.contact_info?.hint && <p>Hint: {l.contact_info.hint}</p>}
                  </div>
                )}
                {(l.website || l.brand_url || l.source_url) && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {(l.website || l.brand_url) && <a className="text-primary underline" href={l.website || l.brand_url} target="_blank" rel="noreferrer">Website</a>}
                    {l.source_url && <a className="text-primary underline" href={l.source_url} target="_blank" rel="noreferrer">Source</a>}
                  </div>
                )}
                <div className="flex gap-1.5 pt-1 flex-wrap">
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={() => draftPitch(l)} disabled={busy === `draft-${l.id}`}>
                    {busy === `draft-${l.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                    Draft pitch
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(l.pitch_draft || ""); toast.success("Pitch copied"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateLead(l.id, "saved")}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateLead(l.id, "dismissed")}><X className="h-3 w-3" /></Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="outbox" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Drafts Kreto prepared on your behalf. Edit, then approve to send.</p>
            {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loading && drafts.length === 0 && (
              <Card className="p-6 text-center space-y-2">
                <Inbox className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-semibold">Outbox is empty</p>
                <p className="text-xs text-muted-foreground">Tap "Draft pitch" on a sponsor lead, or wait for Kreto's next scan.</p>
              </Card>
            )}
            {pendingDrafts.map((d) => {
              const edit = editing[d.id] ?? { subject: d.subject, body: d.body, recipient_email: d.recipient_email || "" };
              const setEdit = (patch: Partial<typeof edit>) =>
                setEditing((prev) => ({ ...prev, [d.id]: { ...edit, ...patch } }));
              return (
                <Card key={d.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">{d.source.replace("_", " ")}</Badge>
                      <p className="text-sm font-bold truncate">{d.brand_name || d.recipient_name || "—"}</p>
                    </div>
                    <Badge className="text-[10px]">DRAFT</Badge>
                  </div>
                  <Input value={edit.recipient_email} onChange={(e) => setEdit({ recipient_email: e.target.value })} placeholder="recipient@brand.com" className="h-8 text-xs" />
                  <Input value={edit.subject} onChange={(e) => setEdit({ subject: e.target.value })} placeholder="Subject" className="h-8 text-xs font-semibold" />
                  <Textarea value={edit.body} onChange={(e) => setEdit({ body: e.target.value })} rows={6} className="text-xs leading-relaxed resize-none" />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-8 text-xs flex-1" disabled={busy === `send-${d.id}` || !edit.recipient_email} onClick={() => sendDraft(d)}>
                      {busy === `send-${d.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                      Approve & send
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { navigator.clipboard.writeText(`${edit.subject}\n\n${edit.body}`); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => dismissDraft(d.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              );
            })}
            {sentDrafts.length > 0 && (
              <details className="pt-2">
                <summary className="text-[11px] uppercase tracking-wider text-muted-foreground cursor-pointer">Sent ({sentDrafts.length})</summary>
                <div className="space-y-2 mt-2">
                  {sentDrafts.map((d) => (
                    <Card key={d.id} className="p-2.5 opacity-70">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold truncate">{d.brand_name} — {d.subject}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0"><Check className="h-2.5 w-2.5 mr-0.5" /> Sent</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </details>
            )}
          </TabsContent>

          <TabsContent value="epk" className="mt-4 space-y-3">
            <Button size="sm" onClick={generateEpk} disabled={busy === "epk"} className="w-full">
              {busy === "epk" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Generate EPK suggestions
            </Button>
            {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loading && epk.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No suggestions. Add credits to trigger ideas.</p>}
            {epk.map((s) => (
              <Card key={s.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{s.kind}</Badge>
                  {s.reason && <p className="text-[10px] text-muted-foreground line-clamp-1">{s.reason}</p>}
                </div>
                {s.current_value && (
                  <div className="text-[11px]">
                    <p className="text-muted-foreground">Current:</p>
                    <p className="line-clamp-2">{s.current_value}</p>
                  </div>
                )}
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Suggested</p>
                  <p className="text-xs whitespace-pre-wrap">{s.suggested_value}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={() => applyEpk(s)}><Check className="h-3 w-3 mr-1" /> Apply</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismissEpk(s.id)}><X className="h-3 w-3" /></Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Intel;
