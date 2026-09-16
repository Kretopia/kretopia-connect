import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Shield,
  Key,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Why connect Gmail?", icon: Mail },
  { title: "Enable 2FA", icon: Shield },
  { title: "Create App Password", icon: Key },
  { title: "Connect", icon: CheckCircle2 },
];

export function EmailSetupWizard({ onComplete }: { onComplete?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    if (!email || !password) {
      toast.error("Please enter both email and app password");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: {
          action: "test_gmail",
          gmail_email: email,
          gmail_app_password: password,
        },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Gmail connected successfully!");
      setConnected(true);
      queryClient.invalidateQueries({ queryKey: ["user_email_settings"] });
      setTimeout(() => onComplete?.(), 1500);
    } catch (e: any) {
      console.error(e);
      toast.error("Connection failed. Double-check your credentials and try again.");
    } finally {
      setTesting(false);
    }
  };

  const copySearchTerm = () => {
    navigator.clipboard.writeText("App passwords");
    toast.success("Copied to clipboard!");
  };

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Progress bar */}
      <div className="flex items-center gap-0 bg-muted/30 p-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step || connected;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => !connected && i <= step && setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all",
                  isActive && "bg-primary text-primary-foreground",
                  isDone && !isActive && "text-primary",
                  !isActive && !isDone && "text-muted-foreground"
                )}
              >
                {isDone && !isActive ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-px mx-1", isDone ? "bg-primary" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      <CardContent className="p-5">
        {/* Step 0: Why connect */}
        {step === 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Send emails from your own Gmail</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your Gmail to send outreach, follow-ups, and campaigns directly from your address. Recipients see <strong>your name</strong> — not a generic sender.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { emoji: "✉", title: "Your brand", desc: "Emails come from your address" },
                { emoji: "", title: "Better delivery", desc: "Higher inbox placement rates" },
                { emoji: "", title: "Secure", desc: "We never see your Google password" },
              ].map((item) => (
                <div key={item.title} className="p-3 rounded-lg bg-muted/50 text-center">
                  <span className="text-xl">{item.emoji}</span>
                  <p className="text-sm font-medium mt-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-accent/50 border border-accent flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                We use a <strong>Google App Password</strong> — a special 16-character code that only works for Kretopia. Your actual Google password is never shared or stored.
              </p>
            </div>

            <Button className="w-full gap-2" onClick={() => setStep(1)}>
              Let's set it up <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Enable 2FA */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <Badge variant="outline" className="mb-2 text-xs">Step 1 of 3</Badge>
              <h3 className="font-semibold text-base">Enable 2-Factor Authentication</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Google requires 2FA to be enabled before you can create App Passwords. If you already have it on, skip to the next step.
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
                <p className="text-sm">
                  Go to{" "}
                  <a
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5 font-medium"
                  >
                    Google Account Security <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
                <p className="text-sm">Find <strong>"2-Step Verification"</strong> and turn it on</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
                <p className="text-sm">Follow Google's prompts to verify with your phone number</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button className="flex-1 gap-2" onClick={() => setStep(2)}>
                I've enabled 2FA <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Create App Password */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <Badge variant="outline" className="mb-2 text-xs">Step 2 of 3</Badge>
              <h3 className="font-semibold text-base">Create an App Password</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Now create a special password just for Kretopia. This keeps your main password safe.
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
                <p className="text-sm">
                  Go to{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline inline-flex items-center gap-0.5 font-medium"
                  >
                    Google App Passwords <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
                <div className="text-sm">
                  <p>In the "App name" field, type <strong>Kretopia</strong> and click <strong>Create</strong></p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
                <div className="text-sm space-y-1">
                  <p>Google will show a <strong>16-character password</strong> like:</p>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 bg-background rounded text-xs font-mono tracking-widest">abcd efgh ijkl mnop</code>
                  </div>
                  <p className="text-xs text-muted-foreground">Copy this — you'll paste it in the next step!</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-muted-foreground">
              <strong className="text-foreground">Can't find App Passwords?</strong> Search "App passwords" in Google Account settings. If it's not showing, make sure 2FA is enabled first.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button className="flex-1 gap-2" onClick={() => setStep(3)}>
                I have my App Password <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Connect */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {connected ? (
              <div className="text-center py-6 space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="font-semibold text-lg">You're all set!</h3>
                <p className="text-sm text-muted-foreground">
                  Your Gmail is connected. You can now send outreach emails directly from Kretopia.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Badge variant="outline" className="mb-2 text-xs">Step 3 of 3</Badge>
                  <h3 className="font-semibold text-base">Enter your credentials</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Paste your Gmail address and the App Password you just created.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium">Gmail Address</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">App Password (16 characters)</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx"
                        className="pr-10 font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full w-10"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      This is NOT your Google password — it's the 16-character code from the previous step
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleConnect}
                  disabled={testing || !email || !password}
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Testing connection...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Test & Connect Gmail
                    </>
                  )}
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-1 flex-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
