import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateEmail } from "@/lib/validation";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordDialog = ({ open, onOpenChange }: ForgotPasswordDialogProps) => {
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { analytics } = await import("@/lib/analytics");
    analytics.featureUsed("forgot_password_attempt");

    const ev = validateEmail(resetEmail);
    if (!ev.valid) {
      toast({ title: "Invalid Email", description: ev.error || "Please enter a valid email", variant: "destructive" });
      return;
    }

    setResetLoading(true);
    const siteUrl = import.meta.env.VITE_SITE_URL || 'https://kretopia.com';
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${siteUrl}/auth?reset=true`,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      analytics.featureUsed("forgot_password_sent");
      toast({ title: "Check Your Email", description: "We've sent you a password reset link. Please check your inbox." });
      onOpenChange(false);
      setResetEmail("");
    }
    setResetLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Enter your email address and we'll send you a link to reset your password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input id="reset-email" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" variant="gradient" className="flex-1" disabled={resetLoading}>{resetLoading ? "Sending..." : "Send Reset Link"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
