import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCog, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MergeAccountsDialog } from "./MergeAccountsDialog";
import type { DuplicateCandidate } from "@/hooks/useDuplicateAccounts";

/**
 * Manual entry-point in Settings → "Merge another account".
 * User types the OTHER account's email; we look it up and open the secure merge dialog.
 */
export const ManualMergeAccountPanel = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<DuplicateCandidate | null>(null);

  const lookup = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      // Find a profile whose linked auth user has this email by reusing detect endpoint
      // and filtering — fallback: ask the merge-init function to resolve
      const { data, error } = await supabase.functions.invoke("merge-accounts-lookup", {
        body: { email: e },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.candidate) {
        toast.error("No account found with that email");
        return;
      }
      setCandidate(data.candidate as DuplicateCandidate);
      setOpen(true);
    } catch (err: any) {
      toast.error(err?.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="merge-email" className="text-sm font-medium flex items-center gap-2">
          <UserCog className="h-4 w-4" /> Merge another account
        </Label>
        <p className="text-xs text-muted-foreground">
          Have a duplicate account? Enter its email and we'll send codes to both inboxes
          to confirm before combining everything.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          id="merge-email"
          type="email"
          placeholder="other@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
        />
        <Button onClick={lookup} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
        </Button>
      </div>

      <MergeAccountsDialog
        open={open}
        onOpenChange={setOpen}
        candidate={candidate}
      />
    </div>
  );
};
