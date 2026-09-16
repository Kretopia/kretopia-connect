import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRightLeft, Save, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { projectId: string; currentUserId: string; }

interface Terms {
  id?: string;
  what_i_give: string;
  what_i_get: string;
  proof_required: string;
  delivered: boolean;
  received: boolean;
}

const EMPTY: Terms = { what_i_give: "", what_i_get: "", proof_required: "", delivered: false, received: false };

export function ExchangeLedgerTab({ projectId, currentUserId }: Props) {
  const { toast } = useToast();
  const [terms, setTerms] = useState<Terms>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("project_exchange_terms").select("*")
        .eq("project_id", projectId).maybeSingle();
      if (data) {
        setTerms({
          id: data.id,
          what_i_give: data.what_i_give ?? "",
          what_i_get: data.what_i_get ?? "",
          proof_required: typeof data.proof_required === "string" ? data.proof_required : ((data.proof_required as any)?.text ?? ""),
          delivered: !!data.delivered,
          received: !!data.received,
        });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      project_id: projectId,
      created_by: currentUserId,
      what_i_give: terms.what_i_give,
      what_i_get: terms.what_i_get,
      proof_required: { text: terms.proof_required },
      delivered: terms.delivered,
      received: terms.received,
    };
    const { error } = terms.id
      ? await supabase.from("project_exchange_terms").update(payload).eq("id", terms.id)
      : await supabase.from("project_exchange_terms").insert(payload);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Exchange terms saved" }); void load(); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Exchange Ledger</h2>
        <p className="text-sm text-muted-foreground">No money changing hands? Document what each side gives & gets — keeps things fair.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">What I give</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. 3 Instagram stories tagging the venue + 1 in-feed post within 48 hrs"
            value={terms.what_i_give}
            onChange={(e) => setTerms({ ...terms, what_i_give: e.target.value })}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">What I get</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. Dinner for 2 (up to $150), bottle of wine, 10% off future visits"
            value={terms.what_i_get}
            onChange={(e) => setTerms({ ...terms, what_i_get: e.target.value })}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Proof required</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. Send link to published story; receipt of meal kept on file"
            value={terms.proof_required}
            onChange={(e) => setTerms({ ...terms, proof_required: e.target.value })}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <button onClick={() => setTerms({ ...terms, delivered: !terms.delivered })} className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${terms.delivered ? "bg-primary border-primary" : "border-border"}`}>
              {terms.delivered && <Check className="h-3 w-3 text-primary-foreground" />}
            </span>
            I delivered
          </button>
          <button onClick={() => setTerms({ ...terms, received: !terms.received })} className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${terms.received ? "bg-primary border-primary" : "border-border"}`}>
              {terms.received && <Check className="h-3 w-3 text-primary-foreground" />}
            </span>
            I received
          </button>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save terms
        </Button>
      </div>
    </div>
  );
}
