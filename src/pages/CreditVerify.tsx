import { useEffect, useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, ShieldCheck, XCircle, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type CreditRequest = {
  id: string;
  credit_id: string;
  status: string;
  relationship: string | null;
  endorser_name: string | null;
  project_name: string;
  role: string;
  year: number | null;
  requester_name: string | null;
  requester_avatar_url: string | null;
};

type Step = "decide" | "confirm-name" | "claim-role" | "done";

export default function CreditVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [request, setRequest] = useState<CreditRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("decide");
  const [name, setName] = useState("");
  const [myRole, setMyRole] = useState("");
  const [outcome, setOutcome] = useState<"accepted" | "declined" | null>(null);
  const [wantsClaim, setWantsClaim] = useState(false);

  useEffect(() => {
    loadRequest().catch(() => {
      toast.error("Couldn't load verification link");
      setLoading(false);
    });
  }, [token]);

  const loadRequest = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_credit_endorsement_by_token" as any, { _token: token });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setRequest(row as CreditRequest);
      setName(row.endorser_name || "");
      if (row.status !== "pending") {
        setOutcome(row.status === "accepted" ? "accepted" : "declined");
        setStep("done");
      }
    }
    setLoading(false);
  };

  const submitAccept = async (finalName: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_credit_endorsement_by_token" as any, {
        _token: token,
        _accepted: true,
        _endorser_name: finalName,
        _relationship: request?.relationship || null,
        _testimonial: null,
      });
      if (error) throw error;
      if (data && typeof data === "object" && "success" in data && !data.success) {
        throw new Error(String(data.error || "Unable to submit"));
      }
      setOutcome("accepted");
      // If they wanted to claim their own credit too, stash it for after signup
      if (wantsClaim && request && myRole.trim()) {
        sessionStorage.setItem(
          "thrivein_pending_claim",
          JSON.stringify({
            project_name: request.project_name,
            role: myRole.trim(),
          })
        );
        // Small delay so the success state renders, then route to signup
        toast.success("Confirmed! Now save your own credit ✨");
        setTimeout(() => {
          navigate(
            `/auth?next=${encodeURIComponent("/profile?claimed=1")}&claim_role=${encodeURIComponent(myRole.trim())}`
          );
        }, 900);
        return;
      }
      toast.success("Credit verified — thank you");
      setStep("done");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecline = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_credit_endorsement_by_token" as any, {
        _token: token,
        _accepted: false,
        _endorser_name: name || null,
        _relationship: null,
        _testimonial: null,
      });
      if (error) throw error;
      if (data && typeof data === "object" && "success" in data && !data.success) {
        throw new Error(String(data.error || "Unable to submit"));
      }
      setOutcome("declined");
      setStep("done");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 px-6">
        <CreativeLoader size="page" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-lg font-bold">Verification link not found</h1>
            <p className="text-sm text-muted-foreground">This link may be invalid or already used.</p>
            <Button onClick={() => navigate("/")} className="w-full">Go to Kretopia</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    const accepted = outcome === "accepted";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-6 space-y-5">
            {accepted ? (
              <CheckCircle2 className="h-14 w-14 mx-auto text-primary" />
            ) : (
              <XCircle className="h-14 w-14 mx-auto text-muted-foreground" />
            )}
            <div>
              <h1 className="text-xl font-bold">{accepted ? "Credit verified" : "Response recorded"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {accepted
                  ? `Thanks — your co-sign strengthens ${request.requester_name || "this creator"}'s verified record.`
                  : "Thanks — your response has been noted."}
              </p>
            </div>
            {accepted && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 text-left">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Were you part of <strong>{request.project_name}</strong> too? Claim your own credit on Kretopia — free.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setStep("claim-role");
                    setWantsClaim(true);
                  }}
                >
                  Add my credit <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Explore Kretopia
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirm name step (after "Yes, we worked together")
  if (step === "confirm-name") {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-md">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
                <h1 className="text-lg font-bold">One quick thing</h1>
                <p className="text-sm text-muted-foreground">
                  How should your co-sign appear on {request.requester_name || "their"} Passport?
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <Button
                className="w-full"
                disabled={submitting || !name.trim()}
                onClick={() => submitAccept(name.trim())}
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirm & co-sign
              </Button>
              <button
                className="text-xs text-white/60 hover:text-[hsl(var(--energy))] w-full text-center underline transition-colors"
                onClick={() => setStep("decide")}
              >
                Back
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Claim-my-role step (IMDb-style)
  if (step === "claim-role") {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-md">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="text-center space-y-2">
                <Sparkles className="h-10 w-10 mx-auto text-primary" />
                <h1 className="text-lg font-bold">Claim your credit</h1>
                <p className="text-sm text-muted-foreground">
                  Add yourself to <strong>{request.project_name}</strong>. We'll save it to your Kretopia Passport after you sign up.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Your name</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Your role on this project</Label>
                <Input
                  value={myRole}
                  onChange={(e) => setMyRole(e.target.value)}
                  placeholder="Director, Client, Stylist, Producer..."
                />
              </div>
              <Button
                className="w-full"
                disabled={submitting || !name.trim() || !myRole.trim()}
                onClick={() => {
                  setWantsClaim(true);
                  if (outcome === "accepted") {
                    // Already accepted — just stash + redirect
                    sessionStorage.setItem(
                      "thrivein_pending_claim",
                      JSON.stringify({ project_name: request.project_name, role: myRole.trim() })
                    );
                    navigate(
                      `/auth?next=${encodeURIComponent("/profile?claimed=1")}&claim_role=${encodeURIComponent(myRole.trim())}`
                    );
                  } else {
                    submitAccept(name.trim());
                  }
                }}
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirm & claim my role <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <button
                className="text-xs text-white/60 hover:text-[hsl(var(--energy))] w-full text-center underline transition-colors"
                onClick={() => setStep(outcome === "accepted" ? "done" : "decide")}
              >
                Back
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Decide step — the 3-button hybrid
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                <AvatarImage src={request.requester_avatar_url || ""} />
                <AvatarFallback>{request.requester_name?.[0] || "K"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Credit verification</p>
                <h1 className="text-lg font-bold leading-tight">
                  {request.requester_name || "A creator"} says you worked together
                </h1>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground text-base">{request.project_name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {request.requester_name || "They"} claim{request.requester_name ? "s" : ""} the role of <strong>{request.role}</strong>
                    {request.year ? ` · ${request.year}` : ""}
                  </p>
                  {request.relationship && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your relationship: <span className="capitalize">{request.relationship}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Can you confirm?</p>

              <Button
                className="w-full h-auto py-3 flex-col items-start gap-0.5"
                disabled={submitting}
                onClick={() => (name.trim() ? submitAccept(name.trim()) : setStep("confirm-name"))}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Yes, we worked together
                </span>
                <span className="text-[11px] font-normal opacity-80">One tap. Done in 5 seconds.</span>
              </Button>

              <Button
                variant="outline"
                className="w-full h-auto py-3 flex-col items-start gap-0.5 border-primary/30 hover:bg-primary/5"
                disabled={submitting}
                onClick={() => {
                  setWantsClaim(true);
                  setStep("claim-role");
                }}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> Yes — and I want my credit too
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Claim your role on this project (IMDb-style).
                </span>
              </Button>

              <Button
                variant="ghost"
                className="w-full h-auto py-2.5 text-muted-foreground"
                disabled={submitting}
                onClick={submitDecline}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Not me / I can't confirm
              </Button>
            </div>

            <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
              Your confirmation becomes part of Kretopia's verified creative record. Takes 5 seconds. No account required.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
