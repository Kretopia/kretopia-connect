import { useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RequestPaymentCardProps {
  project: { id: string; title?: string | null; currency?: string | null };
  currentUserId: string;
}

/**
 * Shown to collaborators (non-owner) so they can request payment from the agent/owner.
 * Inserts a milestone with status='requested' which surfaces on the owner's Studio.
 */
export function RequestPaymentCard({ project, currentUserId }: RequestPaymentCardProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!title.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Add a title and amount", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("milestones").insert({
        project_id: project.id,
        title: title.trim(),
        description: note.trim() || null,
        amount: amt,
        status: "requested",
        created_by: currentUserId,
        requested_by: currentUserId,
      });
      if (error) throw error;
      toast({ title: "Payment request sent", description: "The project owner will see it on their Studio." });
      setOpen(false);
      setTitle("");
      setAmount("");
      setNote("");
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="px-4 py-5 space-y-3">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">
          Get Paid
        </p>
        <h2 className="text-lg font-black leading-none tracking-tight">Request payment</h2>
      </header>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <p className="text-sm text-muted-foreground">
          Submit your rate or invoice line to the agent. They'll review, approve, and send it to the client.
        </p>
        <Button onClick={() => setOpen(true)} className="w-full gap-2">
          <HandCoins className="h-4 w-4" /> Submit payment request
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request payment</DialogTitle>
            <DialogDescription>The owner of "{project.title || "this Studio"}" will get a notification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp-title">What's it for?</Label>
              <Input id="rp-title" placeholder="e.g. Hair & makeup, Day 2" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-amt">Amount ({(project.currency || "USD").toUpperCase()})</Label>
              <Input id="rp-amt" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-note">Note (optional)</Label>
              <Textarea id="rp-note" rows={3} placeholder="Anything the agent should know" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
