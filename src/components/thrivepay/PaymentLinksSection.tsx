import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link as LinkIcon, Copy, Plus, ExternalLink, Power } from "lucide-react";

const APP_URL = "https://www.kretopia.com";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
    || Math.random().toString(36).slice(2, 8);
}

export function PaymentLinksSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"fixed" | "open" | "suggested">("open");
  const [amount, setAmount] = useState("");
  const [singleUse, setSingleUse] = useState(false);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payment_links")
      .select("id, slug, title, mode, amount_cents, currency, single_use, use_count, active, last_paid_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setLinks(data || []);
    setLoading(false);
  };

  const create = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const needsAmount = mode === "fixed" || mode === "suggested";
    const cents = amount ? Math.round(parseFloat(amount) * 100) : null;
    if (needsAmount && (!cents || cents < 50)) {
      toast({ title: "Enter a valid amount ($0.50 min)", variant: "destructive" });
      return;
    }
    setSaving(true);
    const baseSlug = slugify(title);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("payment_links").insert({
      user_id: user!.id,
      slug,
      title: title.trim(),
      description: description.trim() || null,
      mode,
      amount_cents: needsAmount ? cents : null,
      single_use: singleUse,
      currency: "USD",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't create link", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payment link created" });
    setOpen(false);
    setTitle(""); setDescription(""); setAmount(""); setMode("open"); setSingleUse(false);
    load();
  };

  const copy = (slug: string) => {
    navigator.clipboard.writeText(`${APP_URL}/pay/${slug}`);
    toast({ title: "Link copied" });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("payment_links").update({ active: !active }).eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <LinkIcon className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
            Payment Links
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Share a link. Clients pay you — fixed amount, open, or "pay what you want."
          </p>
        </div>
        <Button size="sm" variant="lime" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Link
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No links yet. Create one to get paid in seconds — no invoice required.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((l) => {
              const url = `${APP_URL}/pay/${l.slug}`;
              return (
                <div key={l.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{l.title}</p>
                      {!l.active && <Badge variant="outline" className="text-xs">Disabled</Badge>}
                      {l.single_use && <Badge variant="secondary" className="text-xs">One-time</Badge>}
                      <Badge variant="outline" className="text-xs capitalize">{l.mode}</Badge>
                      {l.amount_cents && (
                        <span className="text-xs text-muted-foreground">
                          ${(l.amount_cents / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{url}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {l.use_count} payment{l.use_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => copy(l.slug)} aria-label="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => window.open(url, "_blank")} aria-label="Open link">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => toggleActive(l.id, l.active)} aria-label="Toggle">
                      <Power className={`h-4 w-4 ${l.active ? "text-green-500" : "text-muted-foreground"}`} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Payment Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Studio Session Deposit" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Amount type</Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="open">Open (payer enters amount)</SelectItem>
                  <SelectItem value="suggested">Suggested (editable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(mode === "fixed" || mode === "suggested") && (
              <div>
                <Label>Amount (USD)</Label>
                <Input type="number" min="0.5" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" />
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">One-time link</p>
                <p className="text-xs text-muted-foreground">Auto-disables after first payment</p>
              </div>
              <Switch checked={singleUse} onCheckedChange={setSingleUse} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Creating…" : "Create Link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
