import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, ShieldCheck, Loader2, CheckCircle2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrandVerificationRequestProps {
  projectId: string;
  roleId: string;
  projectTitle: string;
  currentUserId: string;
}

export const BrandVerificationRequest = ({
  projectId,
  roleId,
  projectTitle,
  currentUserId,
}: BrandVerificationRequestProps) => {
  const [open, setOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!brandName.trim() || !brandEmail.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-brand-credit', {
        body: {
          action: 'request',
          roleId,
          projectId,
          brandEmail: brandEmail.trim(),
          brandName: brandName.trim(),
          submittedBy: currentUserId,
        },
      });

      if (error) throw error;
      setSent(true);
      toast.success("Verification request sent!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send verification request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-[11px] h-7">
          <Building2 className="h-3 w-3" /> Request Brand Verification
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Brand Verification
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Request Sent!</h3>
            <p className="text-sm text-muted-foreground">
              A verification email will be sent to <strong>{brandEmail}</strong> for
              your credit on <strong>{projectTitle}</strong>.
            </p>
            <Badge variant="outline" className="mt-3 text-[10px]">
              Status: Pending Verification
            </Badge>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Request the brand or company to verify your credit on <strong>{projectTitle}</strong>. 
              They'll receive an email with a verification link.
            </p>

            <div className="space-y-2">
              <Label className="text-xs">Brand / Company Name</Label>
              <Input
                placeholder="e.g., Nike, Universal Music, HBO"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="contact@company.com"
                  value={brandEmail}
                  onChange={(e) => setBrandEmail(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Verification Request
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
