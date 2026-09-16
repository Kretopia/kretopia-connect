import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { analytics } from "@/lib/analytics";
import { Sparkles, Check, X, ExternalLink, Loader2, ChevronDown, ChevronUp, Pencil } from "lucide-react";

interface Discovery {
  id: string;
  project_name: string;
  role: string | null;
  year: number | null;
  credit_category: string | null;
  platform: string | null;
  url: string | null;
  ai_confidence: number | null;
  source: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  onApproved?: () => void;
  /** Fired once, right after a batch confirm succeeds, with the credits that were added — hands off to the Kreto Passport-build sequence. */
  onBulkConfirmed?: (credits: { project_name: string; role: string; year?: number | null }[]) => void;
}

// Evidence label per the product's approved vocabulary. Nothing here is
// ever "Verified Credit" — that only happens through real verification
// (organization confirmation / co-sign / authoritative source), never
// through the user just confirming an AI-found guess is theirs.
function evidenceLabel(d: Discovery): string {
  if (d.source && /^(imdb|spotify|behance)/i.test(d.source)) return "Publicly Sourced";
  if ((d.ai_confidence ?? 0) >= 0.7) return "Publicly Sourced";
  return "Potential";
}

export const DiscoveriesInbox = ({ userId, onApproved, onBulkConfirmed }: Props) => {
  const { toast } = useToast();
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [bulkActioning, setBulkActioning] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editYear, setEditYear] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("discovered_credits")
      .select("id, project_name, role, year, credit_category, platform, url, ai_confidence, source, created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!error) {
      const rows = (data as Discovery[]) || [];
      setDiscoveries(rows);
      setSelected(new Set(rows.map((r) => r.id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const handleApprove = async (id: string, silent = false) => {
    setActioning(id);
    const { data, error } = await supabase.rpc("approve_discovered_credit", { _discovery_id: id });
    setActioning(null);
    if (error || !(data as any)?.success) {
      toast({ title: "Couldn't add credit", description: error?.message || (data as any)?.error, variant: "destructive" });
      return false;
    }
    setDiscoveries((d) => d.filter((x) => x.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    analytics.creditConfirmed(1);
    if (!silent) {
      toast({ title: "Added to your credits", description: "Your profile is updated." });
      onApproved?.();
    }
    return true;
  };

  const handleDismiss = async (id: string) => {
    setActioning(id);
    const { data, error } = await supabase.rpc("dismiss_discovered_credit", { _discovery_id: id });
    setActioning(null);
    if (error || !(data as any)?.success) {
      toast({ title: "Couldn't dismiss", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    setDiscoveries((d) => d.filter((x) => x.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    analytics.creditRemoved('not_me');
  };

  const handleConfirmSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkActioning(true);
    const confirmed: { project_name: string; role: string; year?: number | null }[] = [];
    for (const id of ids) {
      const d = discoveries.find((x) => x.id === id);
      const ok = await handleApprove(id, true);
      if (ok && d) confirmed.push({ project_name: d.project_name, role: d.role || "Contributor", year: d.year });
    }
    setBulkActioning(false);
    if (confirmed.length > 0) {
      toast({ title: `${confirmed.length} credit${confirmed.length === 1 ? "" : "s"} added to your Passport` });
      onApproved?.();
      onBulkConfirmed?.(confirmed);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const startEdit = (d: Discovery) => {
    setEditingId(d.id);
    setEditRole(d.role || "");
    setEditYear(d.year ? String(d.year) : "");
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("discovered_credits")
      .update({ role: editRole.trim() || null, year: editYear ? parseInt(editYear, 10) : null })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Couldn't save edit", description: error.message, variant: "destructive" });
      return;
    }
    setDiscoveries((d) => d.map((x) => (x.id === id ? { ...x, role: editRole.trim() || null, year: editYear ? parseInt(editYear, 10) : null } : x)));
    setEditingId(null);
  };

  if (loading || discoveries.length === 0) return null;

  const allSelected = discoveries.length > 0 && discoveries.every((d) => selected.has(d.id));

  return (
    <Card className="mb-4 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-4">
        <button
          className="flex items-center justify-between w-full mb-3"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-primary/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">
                {discoveries.length} credit{discoveries.length === 1 ? "" : "s"} found
              </div>
              <div className="text-xs text-muted-foreground">Tap to review and add to your portfolio</div>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelected(allSelected ? new Set() : new Set(discoveries.map((d) => d.id)))}
              >
                <Checkbox checked={allSelected} />
                Select all
              </button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={selected.size === 0 || bulkActioning}
                onClick={handleConfirmSelected}
              >
                {bulkActioning ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Add selected credits to my Passport ({selected.size})
              </Button>
            </div>

            {discoveries.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border bg-background/60 p-3 flex flex-col gap-2"
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selected.has(d.id)}
                    onCheckedChange={() => toggleSelected(d.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="font-medium text-sm truncate">{d.project_name}</div>
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wide">
                        {evidenceLabel(d)}
                      </Badge>
                    </div>

                    {editingId === d.id ? (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Input
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          placeholder="Role"
                          className="h-7 text-xs"
                        />
                        <Input
                          value={editYear}
                          onChange={(e) => setEditYear(e.target.value.replace(/\D/g, ""))}
                          placeholder="Year"
                          className="h-7 text-xs w-20"
                        />
                        <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveEdit(d.id)}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                        {d.role && <span>{d.role}</span>}
                        {d.year && <span>· {d.year}</span>}
                        {d.platform && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                            {d.platform}
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(d)}
                          className="inline-flex items-center gap-0.5 hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {d.url && (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8"
                    disabled={actioning === d.id}
                    onClick={() => handleApprove(d.id)}
                  >
                    {actioning === d.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" /> Add to credits
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    disabled={actioning === d.id}
                    onClick={() => handleDismiss(d.id)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Not me
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
