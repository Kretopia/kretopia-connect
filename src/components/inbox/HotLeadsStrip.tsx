import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, MessageCircle, Sparkles, Copy, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { trackDeckEvent } from "@/lib/deckMetrics";

/**
 * HotLeadsStrip — surfaces unread inbound messages that smell like real
 * booking/hiring intent (budget, rate, hire, book, available, project, brief…).
 *
 * Pure read-only triage signal. Lives at the top of /inbox so a creator
 * landing in NYC for a busy week sees the *money* messages first.
 *
 * Phase 14: tap "Draft reply" to have Thrive (Executive Producer) draft
 * three short, on-brand replies — copy to clipboard + jump to the thread.
 */

// Words that almost always indicate hire/booking intent.
const HOT_PATTERNS = [
  /\b(hire|hiring|book|booking|booked)\b/i,
  /\b(budget|rate|rates|quote|fee|fees|cost)\b/i,
  /\b(available|availability)\b/i,
  /\b(project|gig|shoot|campaign|brief|treatment)\b/i,
  /\b(paid|pay|payment|invoice)\b/i,
  /\$\s?\d/,
];

interface Lead {
  conversation_id: string | null;
  sender_id: string;
  preview: string;
  created_at: string;
  matched: string;
  sender_name?: string;
  sender_avatar?: string | null;
}

interface DraftOpt { label: string; text: string }

export function HotLeadsStrip() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, DraftOpt[]>>({});
  const [drafting, setDrafting] = useState<Record<number, boolean>>({});
  const [myProfile, setMyProfile] = useState<{ full_name?: string; role?: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await (supabase as any)
          .from("messages")
          .select("id, sender_id, receiver_id, content, created_at, match_id, read")
          .eq("receiver_id", user.id)
          .eq("read", false)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(80)
          .then((r: any) => r, () => ({ data: [] }));

        if (!data || cancelled) { setLoading(false); return; }

        const seen = new Set<string>();
        const hot: Lead[] = [];
        for (const m of data as any[]) {
          if (hot.length >= 5) break;
          const text = String(m.content || "");
          const hit = HOT_PATTERNS.find(rx => rx.test(text));
          if (!hit) continue;
          const key = m.match_id || m.sender_id;
          if (seen.has(key)) continue;
          seen.add(key);
          hot.push({
            conversation_id: m.match_id,
            sender_id: m.sender_id,
            preview: text.slice(0, 240),
            created_at: m.created_at,
            matched: (text.match(hit) || [""])[0],
          });
        }

        if (hot.length > 0) {
          const ids = Array.from(new Set(hot.map(h => h.sender_id)));
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url")
            .in("user_id", ids)
            .then(r => r, () => ({ data: [] } as any));
          const byId = new Map((profs || []).map((p: any) => [p.user_id, p]));
          for (const h of hot) {
            const p: any = byId.get(h.sender_id);
            if (p) { h.sender_name = p.full_name; h.sender_avatar = p.avatar_url; }
          }
          // also load my own name/role once for draft personalization
          const { data: mine } = await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(r => r, () => ({ data: null } as any));
          if (mine) setMyProfile(mine as any);
        }

        if (!cancelled) {
          setLeads(hot);
          if (hot.length > 0) {
            trackDeckEvent("hot_leads_seen", "opportunity", {
              count: hot.length,
              matched: hot.map(h => h.matched.toLowerCase()),
            });
          }
        }
      } catch {/* silent */}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const requestDrafts = async (idx: number) => {
    if (drafts[idx]?.length) { setOpenIdx(openIdx === idx ? null : idx); return; }
    setOpenIdx(idx);
    setDrafting(d => ({ ...d, [idx]: true }));
    const l = leads[idx];
    trackDeckEvent("hot_lead_draft_requested", "opportunity", {
      sender_id: l.sender_id, matched: l.matched.toLowerCase(),
    });
    try {
      const { data, error } = await supabase.functions.invoke('draft-lead-reply', {
        body: {
          inbound: l.preview,
          senderName: l.sender_name || 'them',
          myName: myProfile?.full_name || undefined,
          myRole: myProfile?.role || undefined,
        },
      });
      if (error) throw error;
      const out: DraftOpt[] = (data as any)?.drafts || [];
      setDrafts(d => ({ ...d, [idx]: out }));
      trackDeckEvent("hot_lead_draft_returned", "opportunity", {
        sender_id: l.sender_id, count: out.length,
      });
    } catch (e: any) {
      toast({ title: "Couldn't draft right now", description: e?.message || 'Try again in a sec.', variant: 'destructive' });
      setOpenIdx(null);
    } finally {
      setDrafting(d => ({ ...d, [idx]: false }));
    }
  };

  const applyDraft = async (lead: Lead, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {/* ignore */}
    trackDeckEvent("hot_lead_draft_used", "opportunity", {
      sender_id: lead.sender_id, matched: lead.matched.toLowerCase(), length: text.length,
    });
    toast({ title: 'Draft copied', description: 'Paste it in the chat to send.' });
    navigate(lead.conversation_id ? `/messages?c=${lead.conversation_id}` : `/messages?user=${lead.sender_id}`);
  };

  const openThread = (lead: Lead) => {
    trackDeckEvent("hot_lead_opened", "opportunity", {
      sender_id: lead.sender_id, matched: lead.matched.toLowerCase(),
    });
    navigate(lead.conversation_id ? `/messages?c=${lead.conversation_id}` : `/messages?user=${lead.sender_id}`);
  };

  if (loading || leads.length === 0) return null;

  return (
    <Card className="p-4 mb-4 border-[hsl(var(--signal-amber))]/30 bg-[hsl(var(--signal-amber))]/[0.04]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-[hsl(var(--signal-amber))]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
            Hot leads
          </p>
          <Badge className="h-4 px-1.5 text-[10px] bg-[hsl(var(--signal-amber))] text-background">
            {leads.length}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">Last 14d · unread</span>
      </div>
      <div className="space-y-2">
        {leads.map((l, i) => {
          const isOpen = openIdx === i;
          const ds = drafts[i];
          return (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-start gap-3 px-3 py-2.5">
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={l.sender_avatar || undefined} />
                  <AvatarFallback>{(l.sender_name || "?").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <button
                  onClick={() => openThread(l)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold truncate">
                      {l.sender_name || "New lead"}
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-[hsl(var(--signal-amber))]/40 text-[hsl(var(--signal-amber))]">
                      {l.matched.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{l.preview}</p>
                </button>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant={isOpen ? "secondary" : "outline"}
                    className="h-7 px-2 text-[10px] gap-1"
                    onClick={() => requestDrafts(i)}
                    disabled={drafting[i]}
                  >
                    {drafting[i] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Draft
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openThread(l)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {isOpen && ds && ds.length > 0 && (
                <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-2">
                  {ds.map((d, j) => (
                    <button
                      key={j}
                      onClick={() => applyDraft(l, d.text)}
                      className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/50 transition px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--signal-amber))]">
                          {d.label}
                        </span>
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs leading-snug">{d.text}</p>
                    </button>
                  ))}
                  <p className="text-[10px] text-muted-foreground text-center">
                    Tap a draft to copy + open the chat.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default HotLeadsStrip;
