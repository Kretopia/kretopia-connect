import { useEffect, useMemo, useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, ExternalLink, ArrowRightLeft, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Dispute {
  id: string;
  credit_id: string;
  challenger_id: string;
  current_owner_id: string;
  challenger_role: string | null;
  challenger_evidence: string | null;
  source_url: string | null;
  evidence_urls: string[] | null;
  owner_response: string | null;
  owner_responded_at: string | null;
  status: string;
  created_at: string;
  auto_resolve_at: string | null;
  credit?: { project_name: string; role: string; url: string | null; thumbnail_url: string | null };
  challenger?: { full_name: string | null; avatar_url: string | null };
  owner?: { full_name: string | null; avatar_url: string | null };
}

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "owner_responded", label: "Awaiting Review" },
  { value: "resolved_for_challenger", label: "Resolved (Challenger)" },
  { value: "resolved_for_owner", label: "Resolved (Owner)" },
  { value: "withdrawn", label: "Withdrawn" },
];

export default function AdminDisputes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [tab, setTab] = useState("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) {
        toast.error("Admin access required");
        navigate("/");
        return;
      }
      setIsAdmin(true);
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("credit_claim_disputes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Failed to load disputes");
      setLoading(false);
      return;
    }

    const userIds = Array.from(
      new Set((data || []).flatMap((d) => [d.challenger_id, d.current_owner_id])),
    );
    const creditIds = Array.from(new Set((data || []).map((d) => d.credit_id)));

    const [{ data: profs }, { data: credits }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds),
      supabase.from("credits").select("id, project_name, role, url, thumbnail_url").in("id", creditIds),
    ]);

    const profMap = new Map((profs || []).map((p) => [p.user_id, p]));
    const credMap = new Map((credits || []).map((c) => [c.id, c]));

    setDisputes(
      (data || []).map((d) => ({
        ...d,
        credit: credMap.get(d.credit_id) as Dispute["credit"],
        challenger: profMap.get(d.challenger_id) as Dispute["challenger"],
        owner: profMap.get(d.current_owner_id) as Dispute["owner"],
      })) as Dispute[],
    );
    setLoading(false);
  };

  const filtered = useMemo(() => disputes.filter((d) => d.status === tab), [disputes, tab]);

  const arbitrate = async (d: Dispute, outcome: "challenger" | "owner") => {
    setActionId(d.id);
    try {
      if (outcome === "challenger") {
        const { error: e1 } = await supabase
          .from("credits")
          .update({ user_id: d.challenger_id })
          .eq("id", d.credit_id);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase
        .from("credit_claim_disputes")
        .update({
          status: outcome === "challenger" ? "resolved_for_challenger" : "resolved_for_owner",
          resolution_note: `Admin ruling: in favor of ${outcome}.`,
          resolved_by: user!.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", d.id);
      if (e2) throw e2;
      toast.success(`Resolved in favor of ${outcome}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve");
    } finally {
      setActionId(null);
    }
  };

  const runAutoResolve = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-resolve-disputes", {});
      if (error) throw error;
      toast.success(`Auto-resolve: checked ${data?.checked ?? 0}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  return (
    <div className="container max-w-5xl py-8 px-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Dispute Arbitration
          </h1>
          <p className="text-sm text-muted-foreground">Review credit ownership disputes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={runAutoResolve} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
          Run auto-resolve sweep
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {STATUS_TABS.map((t) => {
            const count = disputes.filter((d) => d.status === t.value).length;
            return (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} {count > 0 && <Badge variant="secondary" className="ml-2">{count}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No disputes here.</CardContent></Card>
          ) : (
            filtered.map((d) => <DisputeCard key={d.id} d={d} onAct={arbitrate} busy={actionId === d.id} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DisputeCard({
  d,
  onAct,
  busy,
}: {
  d: Dispute;
  onAct: (d: Dispute, outcome: "challenger" | "owner") => void;
  busy: boolean;
}) {
  const isPending = d.status === "pending" || d.status === "owner_responded";
  const overdue = d.auto_resolve_at && new Date(d.auto_resolve_at) < new Date() && d.status === "pending";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">{d.credit?.project_name || "Credit"}</CardTitle>
            <CardDescription>
              {d.credit?.role} · filed {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
            </CardDescription>
          </div>
          {overdue && <Badge variant="destructive">Overdue</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Challenger</p>
            <p className="font-medium">{d.challenger?.full_name || "Unknown"}</p>
            {d.challenger_role && <p className="text-muted-foreground">Claims role: {d.challenger_role}</p>}
            {d.challenger_evidence && (
              <p className="text-xs bg-muted p-2 rounded">{d.challenger_evidence}</p>
            )}
            {d.source_url && (
              <a href={d.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {d.evidence_urls && d.evidence_urls.length > 0 && (
              <p className="text-xs text-muted-foreground">{d.evidence_urls.length} attachment(s)</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Current owner</p>
            <p className="font-medium">{d.owner?.full_name || "Unknown"}</p>
            {d.owner_response ? (
              <p className="text-xs bg-muted p-2 rounded">{d.owner_response}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No response yet</p>
            )}
          </div>
        </div>

        {isPending && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" onClick={() => onAct(d, "challenger")} disabled={busy}>
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer to challenger
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAct(d, "owner")} disabled={busy}>
              <X className="h-4 w-4 mr-2" /> Keep with owner
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
