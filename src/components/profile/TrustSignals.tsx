import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, ShieldCheck, CreditCard, CheckCircle2, Circle, Loader2, Upload, X, MessageCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TrustSignalsProps {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  idVerified?: boolean;
  paymentVerified?: boolean;
  isOwnProfile?: boolean;
  compact?: boolean;
}

const signals = [
  { key: "email", icon: Mail, label: "Email Verified", unverifiedLabel: "Verify Email" },
  { key: "phone", icon: Phone, label: "Phone Verified", unverifiedLabel: "Verify Phone" },
  { key: "id", icon: ShieldCheck, label: "ID Verified", unverifiedLabel: "Verify ID" },
  { key: "payment", icon: CreditCard, label: "Payment Verified", unverifiedLabel: "Add Payment" },
] as const;

type VerifyDialogType = "email" | "phone" | "id" | "payment" | null;

export function TrustSignals({ emailVerified, phoneVerified, idVerified, paymentVerified, isOwnProfile, compact }: TrustSignalsProps) {
  const navigate = useNavigate();
  const [activeDialog, setActiveDialog] = useState<VerifyDialogType>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"input" | "otp">("input");
  const [otpCode, setOtpCode] = useState("");
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp">("sms");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idLoading, setIdLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const verifiedMap: Record<string, boolean> = {
    email: !!emailVerified,
    phone: !!phoneVerified,
    id: !!idVerified,
    payment: !!paymentVerified,
  };

  const verifiedCount = Object.values(verifiedMap).filter(Boolean).length;

  const handleSignalClick = (key: string) => {
    if (!isOwnProfile || verifiedMap[key]) return;
    setActiveDialog(key as VerifyDialogType);
  };

  const handleResendVerificationEmail = async () => {
    if (!user?.email) return;
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });
      if (error) throw error;
      toast({ title: "Verification email sent!", description: `Check ${user.email} for the confirmation link.` });
      setActiveDialog(null);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err?.message || "Please try again later.", variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePhoneSendOtp = async () => {
    if (!user || !phoneNumber.trim()) return;
    setPhoneLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-phone-otp", {
        body: { action: "send", phone: phoneNumber.trim(), channel: otpChannel },
      });
      if (error) throw new Error(error.message || "Failed to send code");
      if (data?.error) throw new Error(data.error);
      setPhoneStep("otp");
      const channelLabel = otpChannel === "whatsapp" ? "WhatsApp" : "SMS";
      toast({ title: "Code sent!", description: `A verification code has been sent via ${channelLabel} to ${phoneNumber.trim()}.` });
    } catch (err: any) {
      toast({ title: "Failed to send code", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneVerifyOtp = async () => {
    if (!user || !otpCode.trim()) return;
    setPhoneLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-phone-otp", {
        body: { action: "verify", code: otpCode.trim() },
      });
      if (error) throw new Error(error.message || "Verification failed");
      if (data?.error) throw new Error(data.error);
      toast({ title: "Phone verified!", description: "Your phone number has been verified." });
      setActiveDialog(null);
      setPhoneNumber("");
      setOtpCode("");
      setPhoneStep("input");
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleIdUpload = async () => {
    if (!user || !idFile) return;
    setIdLoading(true);
    try {
      // Upload ID document to storage
      const fileExt = idFile.name.split(".").pop();
      const filePath = `${user.id}/id-verification.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("verification-docs")
        .upload(filePath, idFile, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, just mark as pending
        console.warn("Upload failed (bucket may not exist):", uploadError);
      }

      // Mark ID as submitted for admin review — id_verified itself is
      // admin-only (see admin_verify_profile_identity); this RPC only
      // records the request timestamp, it never grants the badge.
      const { error } = await supabase.rpc("request_id_verification");
      if (error) throw error;

      toast({ title: "ID submitted!", description: "We'll review it and confirm your verified badge soon." });
      setActiveDialog(null);
      setIdFile(null);
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIdLoading(false);
    }
  };

  if (compact) {
    // Only render verified signals — hide empty/inactive states for a cleaner profile
    const verifiedSignals = signals.filter((s) => verifiedMap[s.key]);
    if (verifiedSignals.length === 0) return null;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {verifiedSignals.map((s) => (
                <div
                  key={s.key}
                  className="h-5 w-5 rounded-full flex items-center justify-center bg-success/15 text-success"
                >
                  <s.icon className="h-3 w-3" />
                </div>
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs font-medium">{verifiedCount}/4 Trust Signals verified</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Trust Signals</h3>
          <span className="text-xs text-muted-foreground">{verifiedCount}/4 verified</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {signals.map((s) => {
            const verified = verifiedMap[s.key];
            const clickable = isOwnProfile && !verified;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!clickable}
                onClick={() => handleSignalClick(s.key)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left w-full",
                  verified
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-border bg-muted/30",
                  clickable && "hover:border-primary/50 hover:bg-primary/5 cursor-pointer active:scale-[0.98]"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    verified
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-muted text-muted-foreground/50"
                  )}
                >
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "text-xs font-medium truncate",
                    verified ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {verified ? s.label : s.unverifiedLabel}
                  </p>
                  {verified ? (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-[10px] font-medium">Verified</span>
                    </div>
                  ) : isOwnProfile ? (
                    <span className="text-[10px] text-primary font-medium">Tap to verify →</span>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground/50">
                      <Circle className="h-3 w-3" />
                      <span className="text-[10px]">Pending</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Trust Score Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Trust Score</span>
            <span className="font-semibold text-foreground">{verifiedCount * 25}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                verifiedCount === 4
                  ? "bg-gradient-to-r from-green-500 to-emerald-400"
                  : verifiedCount >= 2
                    ? "bg-gradient-to-r from-primary to-accent"
                    : "bg-muted-foreground/30"
              )}
              style={{ width: `${verifiedCount * 25}%` }}
            />
          </div>
        </div>
      </div>

      {/* Email Verification Dialog */}
      <Dialog open={activeDialog === "email"} onOpenChange={(v) => !v && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Verify Your Email
            </DialogTitle>
            <DialogDescription>
              We'll send a verification link to your email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A confirmation email will be sent to <span className="font-medium text-foreground">{user?.email}</span>.
              Click the link in the email to verify.
            </p>
            <Button onClick={handleResendVerificationEmail} disabled={emailLoading} className="w-full gap-2">
              {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Verification Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phone Verification Dialog */}
      <Dialog open={activeDialog === "phone"} onOpenChange={(v) => { if (!v) { setActiveDialog(null); setPhoneStep("input"); setOtpCode(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Verify Your Phone
            </DialogTitle>
            <DialogDescription>
              {phoneStep === "input" 
                ? "Add your phone number to increase your trust score."
                : "Enter the 6-digit code to verify your number."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {phoneStep === "input" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Use international format (e.g. +44, +1)</p>
                </div>
                <div className="space-y-2">
                  <Label>Send code via</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOtpChannel("sms")}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all text-sm font-medium",
                        otpChannel === "sms"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <MessageSquare className="h-4 w-4" />
                      SMS
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtpChannel("whatsapp")}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-lg border transition-all text-sm font-medium",
                        otpChannel === "whatsapp"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                  </div>
                </div>
                <Button onClick={handlePhoneSendOtp} disabled={phoneLoading || !phoneNumber.trim()} className="w-full gap-2">
                  {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  Send Verification Code
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Code sent to {phoneNumber}
                  </p>
                </div>
                <Button onClick={handlePhoneVerifyOtp} disabled={phoneLoading || otpCode.length !== 6} className="w-full gap-2">
                  {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify Code
                </Button>
                <Button variant="ghost" className="w-full text-xs" onClick={() => { setPhoneStep("input"); setOtpCode(""); }}>
                  ← Change number
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ID Verification Dialog */}
      <Dialog open={activeDialog === "id"} onOpenChange={(v) => !v && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verify Your Identity
            </DialogTitle>
            <DialogDescription>
              Upload a government-issued ID to verify your identity. Your document is stored securely and never shared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload ID Document</Label>
              <p className="text-xs text-muted-foreground">Accepted: Passport, Driver's License, or National ID</p>
              {idFile ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <Upload className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{idFile.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setIdFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
            <Button onClick={handleIdUpload} disabled={idLoading || !idFile} className="w-full gap-2">
              {idLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Submit for Verification
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Verification Dialog */}
      <Dialog open={activeDialog === "payment"} onOpenChange={(v) => !v && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Verify Payment Method
            </DialogTitle>
            <DialogDescription>
              Link a payment method to unlock your payment verification badge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your payment verification badge is automatically activated when you set up your wallet or receive your first payment through the platform.
            </p>
            <Button onClick={() => { setActiveDialog(null); navigate("/thrivepay"); }} className="w-full gap-2">
              <CreditCard className="h-4 w-4" />
              Go to Wallet Setup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Inline trust badge row for match cards and compact views */
export function TrustBadgeRow({ emailVerified, phoneVerified, idVerified, paymentVerified }: Omit<TrustSignalsProps, "isOwnProfile" | "compact">) {
  const verifiedMap: Record<string, boolean> = {
    email: !!emailVerified,
    phone: !!phoneVerified,
    id: !!idVerified,
    payment: !!paymentVerified,
  };
  const verifiedCount = Object.values(verifiedMap).filter(Boolean).length;
  
  if (verifiedCount === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
      <span className="text-[11px] font-medium text-green-600 dark:text-green-400">
        {verifiedCount}/4 verified
      </span>
    </div>
  );
}
