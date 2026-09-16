import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, FileText, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentDisputeProps {
  milestoneId: string;
  paymentIntentId?: string;
  onDisputeCreated?: () => void;
}

export const PaymentDispute = ({ milestoneId, paymentIntentId, onDisputeCreated }: PaymentDisputeProps) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmitDispute = async () => {
    if (!reason || !details) {
      toast({
        title: "Missing Information",
        description: "Please provide a reason and details for the dispute",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("payment_disputes").insert({
        milestone_id: milestoneId,
        payment_intent_id: paymentIntentId,
        disputed_by: user.id,
        reason,
        details,
        evidence,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Dispute Submitted",
        description: "Your payment dispute has been submitted for review",
      });

      setReason("");
      setDetails("");
      setEvidence("");
      onDisputeCreated?.();
    } catch (error) {
      console.error("Error submitting dispute:", error);
      toast({
        title: "Error",
        description: "Failed to submit dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-orange-200 dark:border-orange-900">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <CardTitle>Payment Dispute</CardTitle>
        </div>
        <CardDescription>
          Submit a dispute if there's an issue with this payment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dispute-reason">Dispute Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="dispute-reason">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work_not_completed">Work Not Completed</SelectItem>
              <SelectItem value="poor_quality">Poor Quality Work</SelectItem>
              <SelectItem value="missed_deadline">Missed Deadline</SelectItem>
              <SelectItem value="unauthorized_charge">Unauthorized Charge</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dispute-details">Details</Label>
          <Textarea
            id="dispute-details"
            placeholder="Provide detailed information about the dispute..."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dispute-evidence">Evidence (optional)</Label>
          <Textarea
            id="dispute-evidence"
            placeholder="Links to evidence, screenshots, communication logs, etc."
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={3}
          />
          <p className="text-sm text-muted-foreground">
            Provide any supporting evidence like screenshots, messages, or documentation
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Dispute Process:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Submit your dispute with details and evidence</li>
                <li>Both parties will be notified</li>
                <li>Our team will review within 3-5 business days</li>
                <li>Payment will be held in escrow during review</li>
                <li>Decision will be final and binding</li>
              </ol>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSubmitDispute}
          disabled={isSubmitting || !reason || !details}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {isSubmitting ? "Submitting..." : "Submit Dispute"}
        </Button>
      </CardContent>
    </Card>
  );
};
