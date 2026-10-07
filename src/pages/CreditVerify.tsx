import { useEffect, useState, type ReactNode } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, ShieldCheck, XCircle, Sparkles, ArrowRight, RefreshCw } from "lucide-react";
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

type Step = "decide" | "claim-role" | "done";

const TESTIMONIAL_MAX = 280;

/** The page is opened by people who may never have heard of Kretopia, so every state carries the brand. */
function Shell({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <div className={`min-h-screen bg-background px-4 py-8 ${centered ? "flex items-center justify-center" : ""}`}>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex justify-center">
          <BrandLogo size="sm" lockup />
        </div>
        {children}
        <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/60">
          Kretopia · The verified record of creative work
        </p>
      </div>
    </div>
  );
}

export default function CreditVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [request, setRequest] = useState<CreditRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("decide");
  const [name, setName] = useState("");
  const [myRole, setMyRole] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<"accepted" | "declined" | null>(null);
  const [wantsClaim, setWantsClaim] = useState(false);

  const loadRequest = async () => {
    setLoading(true);
    setLoadFailed(false);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
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
    } catch {
      // A network/server failure is not the same as "this link is wrong": say so and let them retry.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitAccept = async (finalName: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_credit_endorsement_by_token" as any, {
        _token: token,
        _accepted: true,
        _endorser_name: finalName,
        _relationship: request?.relationship || null,
        _testimonial: note.trim() ? note.trim().slice(0, TESTIMONIAL_MAX) : null,
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

  if (loadFailed) {
    return (
      <Shell centered>
        <Card className="text-center">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-lg font-bold">We couldn't load this request</h1>
            <p className="text-sm text-muted-foreground">
              This looks like a connection problem, not a problem with your link. Try again in a moment.
            </p>
            <Button onClick={() => void loadRequest()} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!request) {
    return (
      <Shell centered>
        <Card className="text-center">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-lg font-bold">This confirmation link isn't valid</h1>
            <p className="text-sm text-muted-foreground">
              {token
                ? "It may have been replaced by a newer link, or copied incorrectly. Ask the person who sent it to share a fresh link from their Kretopia Passport."
                : "The link is missing its code. Open it again from the message or email you received."}
            </p>
            <Button onClick={() => navigate("/")} variant="outline" className="w-full">Go to Kretopia</Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const requesterName = request.requester_name || "this creator";

  if (step === "done") {
    const accepted = outcome === "accepted";
    return (
      <Shell centered>
        <Card className="text-center">
          <CardContent className="p-6 space-y-5">
            {accepted ? (
              <CheckCircle2 className="h-14 w-14 mx-auto text-primary" />
            ) : (
              <XCircle className="h-14 w-14 mx-auto text-muted-foreground" />
            )}
            <div>
              <h1 className="text-xl font-bold">{accepted ? "Credit confirmed" : "Response recorded"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {accepted
                  ? `Thank you. ${requesterName} is notified, and your confirmation now shows on their verified record.`
                  : "Thanks, your answer has been noted. Nothing is shown on their record for this credit."}
              </p>
            </div>
            {accepted && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 text-left">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Were you part of <strong>{request.project_name}</strong> too? Claim your own credit on Kretopia, free.
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
      </Shell>
    );
  }

  // Claim-my-role step (IMDb-style)
  if (step === "claim-role") {
    return (
      <Shell>
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
              <Label htmlFor="claim-name">Your name</Label>
              <Input
                id="claim-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-role">Your role on this project</Label>
              <Input
                id="claim-role"
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
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center underline transition-colors"
              onClick={() => setStep(outcome === "accepted" ? "done" : "decide")}
            >
              Back
            </button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Decide step — one screen: who's asking, what, and the answer
  const needsName = !name.trim();
  return (
    <Shell>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 ring-2 ring-primary/20">
              <AvatarImage src={request.requester_avatar_url || ""} />
              <AvatarFallback>{request.requester_name?.[0] || "K"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Credit confirmation</p>
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

          <div className="space-y-4">
            {needsName && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-name">Your name, as it will appear on their Passport</Label>
                <Input
                  id="confirm-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="confirm-note" className="text-xs">
                One line about their work <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="confirm-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, TESTIMONIAL_MAX))}
                placeholder={`What did ${requesterName} do on this project?`}
                rows={2}
                className="resize-none text-sm"
              />
              {note.length > 0 && (
                <p className="text-right text-[10px] text-muted-foreground">{note.length}/{TESTIMONIAL_MAX}</p>
              )}
            </div>

            <div className="space-y-2">
              <Button
                className="w-full h-auto py-3 flex-col items-start gap-0.5"
                disabled={submitting || needsName}
                onClick={() => submitAccept(name.trim())}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Yes, we worked together
                </span>
                <span className="text-[11px] font-normal opacity-80">
                  {needsName ? "Add your name above to confirm." : "One tap. Done in 5 seconds."}
                </span>
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
                  <Sparkles className="h-4 w-4 text-primary" /> Yes, and I want my credit too
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
          </div>

          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            Your answer becomes part of Kretopia's verified creative record. No account required.
          </p>
        </CardContent>
      </Card>
    </Shell>
  );
}
