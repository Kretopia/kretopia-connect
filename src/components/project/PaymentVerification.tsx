import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Shield, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PaymentVerificationProps {
  milestoneId: string;
  paymentIntentId?: string;
}

interface VerificationStatus {
  status: "verified" | "pending" | "failed";
  checks: {
    paymentReceived: boolean;
    amountMatches: boolean;
    recipientVerified: boolean;
    escrowReleased: boolean;
  };
  timestamp: string;
}

export const PaymentVerification = ({ milestoneId, paymentIntentId }: PaymentVerificationProps) => {
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const runVerification = async () => {
    setIsVerifying(true);
    try {
      // Get milestone details
      const { data: milestone, error: milestoneError } = await supabase
        .from("milestones")
        .select("*, projects(id, created_by)")
        .eq("id", milestoneId)
        .single();

      if (milestoneError) throw milestoneError;

      // Verify payment status
      const checks = {
        paymentReceived: milestone.status === "completed" || milestone.status === "paid",
        amountMatches: milestone.amount > 0,
        recipientVerified: milestone.paid_to !== null,
        escrowReleased: milestone.escrow_status === "released" || milestone.status === "completed",
      };

      const allChecksPass = Object.values(checks).every(check => check === true);

      setVerification({
        status: allChecksPass ? "verified" : milestone.status === "pending" ? "pending" : "failed",
        checks,
        timestamp: new Date().toISOString(),
      });

      if (allChecksPass) {
        toast({
          title: "Payment Verified",
          description: "All verification checks passed successfully",
        });
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      toast({
        title: "Verification Failed",
        description: "Unable to verify payment status",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    runVerification();
  }, [milestoneId]);

  if (!verification) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Payment Verification
          </CardTitle>
          <CardDescription>Checking payment status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (verification.status) {
      case "verified":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-orange-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (verification.status) {
      case "verified":
        return <Badge className="bg-green-600">Verified</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-orange-600 text-orange-600">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle>Payment Verification</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Last checked: {new Date(verification.timestamp).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {[
            { key: "paymentReceived", label: "Payment Received", icon: DollarSign },
            { key: "amountMatches", label: "Amount Verified", icon: CheckCircle2 },
            { key: "recipientVerified", label: "Recipient Verified", icon: Shield },
            { key: "escrowReleased", label: "Escrow Released", icon: CheckCircle2 },
          ].map(({ key, label, icon: Icon }) => {
            const passed = verification.checks[key as keyof typeof verification.checks];
            return (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                {passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        <Button 
          onClick={runVerification}
          disabled={isVerifying}
          variant="outline"
          className="w-full"
        >
          {isVerifying ? "Verifying..." : "Re-verify Payment"}
        </Button>
      </CardContent>
    </Card>
  );
};
