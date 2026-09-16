import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VerificationAppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  rejectionReason?: string;
}

export function VerificationAppealDialog({
  open,
  onOpenChange,
  requestId,
  rejectionReason,
}: VerificationAppealDialogProps) {
  const [appealReason, setAppealReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!appealReason.trim()) {
      toast({
        title: "Appeal reason required",
        description: "Please explain why you're appealing this decision.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("verification_requests")
        .update({
          status: "appealed",
          appeal_reason: appealReason,
          appeal_submitted_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Appeal submitted",
        description: "Your appeal will be reviewed manually by our team.",
      });
      
      onOpenChange(false);
      setAppealReason("");
    } catch (error) {
      console.error("Error submitting appeal:", error);
      toast({
        title: "Error",
        description: "Failed to submit appeal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Appeal Verification Decision</DialogTitle>
          <DialogDescription>
            If you believe your verification was rejected in error, explain why below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {rejectionReason && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Rejection reason:</strong> {rejectionReason}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="appeal-reason">Why should we reconsider?</Label>
            <Textarea
              id="appeal-reason"
              placeholder="Explain why you believe this decision should be reviewed..."
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Appeals are reviewed manually by our team within 48 hours.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Appeal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
