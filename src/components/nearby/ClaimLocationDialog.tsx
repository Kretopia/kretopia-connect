import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, Loader2, Building2, Link, FileText } from "lucide-react";

interface ClaimLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
  onClaimed?: () => void;
}

export function ClaimLocationDialog({ open, onOpenChange, locationId, locationName, onClaimed }: ClaimLocationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofDescription, setProofDescription] = useState('');

  const handleSubmit = async () => {
    if (!user || !businessName.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('location_claims')
        .insert({
          location_id: locationId,
          user_id: user.id,
          business_name: businessName.trim(),
          proof_url: proofUrl.trim() || null,
          proof_description: proofDescription.trim() || null,
        });
      if (error) {
        if (error.code === '23505') {
          toast({ title: "Already claimed", description: "You've already submitted a claim for this spot.", variant: "destructive" });
          return;
        }
        throw error;
      }
      toast({
        title: "Claim submitted!",
        description: "We'll verify your ownership and link your brand page.",
      });
      setBusinessName('');
      setProofUrl('');
      setProofDescription('');
      onOpenChange(false);
      onClaimed?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            Claim This Spot
          </DialogTitle>
          <DialogDescription>
            Verify you own or manage <span className="font-medium text-foreground">{locationName}</span> to unlock your brand page, bookings, and analytics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* What you get */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-primary">What you'll unlock:</p>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-center gap-2">
                <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                Verified badge on your listing
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                Linked brand page with full bio
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                Booking requests & enquiries
              </li>
            </ul>
          </div>

          <div>
            <Label className="text-sm font-medium">Business / Brand Name *</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Pulse Recording Studios"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Proof of Ownership</Label>
            <div className="relative mt-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="Website, Google listing, or social link"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Additional Details</Label>
            <Textarea
              value={proofDescription}
              onChange={(e) => setProofDescription(e.target.value)}
              placeholder="How can we verify you manage this spot? E.g. 'I'm the owner, listed on Google Maps as...'"
              rows={3}
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !businessName.trim()}
            className="w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-2" />}
            Submit Claim
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Claims are reviewed within 48 hours. We may contact you for additional verification.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
