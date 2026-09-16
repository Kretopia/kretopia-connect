import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, XCircle, Briefcase, UserPlus } from "lucide-react";
import { Helmet } from "react-helmet-async";

const VerifyOpportunity = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [result, setResult] = useState<{ opportunityId?: string; companyName?: string; claimToken?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token found.");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-guest-opportunity", {
          body: { action: "verify", token },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setResult(data);
        setStatus("success");
      } catch (err: any) {
        console.error("Verification error:", err);
        setErrorMessage(err.message || "Verification failed. The link may have expired.");
        setStatus("error");
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Helmet>
        <title>Verify Opportunity | Kretopia</title>
      </Helmet>

      <Card className="max-w-md w-full text-center">
        {status === "verifying" && (
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl">Verifying...</CardTitle>
            <CardDescription>Hang tight while we activate your listing.</CardDescription>
          </CardHeader>
        )}

        {status === "success" && (
          <>
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">You're live!</CardTitle>
              <CardDescription className="text-base">
                Your opportunity is now live. Creatives can start applying immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Button asChild className="w-full gap-2" size="lg">
                <Link to={`/opportunity/${result?.opportunityId}`}>
                  <Briefcase className="h-4 w-4" />
                  View Your Listing
                </Link>
              </Button>

              {result?.claimToken && (
                <div className="p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/25 space-y-3">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <UserPlus className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-base font-semibold">Claim Your Brand Profile</p>
                  </div>
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    We've set up a <strong>{result?.companyName}</strong> brand page on Kretopia. 
                    Claim it to:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1.5 pl-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      Review & message applicants directly
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      Post unlimited opportunities
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      Accept secure payments through the platform
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      Build your brand reputation with reviews
                    </li>
                  </ul>
                  <Button asChild className="w-full bg-gradient-to-r from-primary to-primary/80" size="lg">
                    <Link to={`/auth?claim=${result.claimToken}`}>
                      Claim Profile — It's Free
                    </Link>
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Takes 30 seconds • No credit card required
                  </p>
                </div>
              )}
            </CardContent>
          </>
        )}

        {status === "error" && (
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Verification failed</CardTitle>
            <CardDescription className="text-base">{errorMessage}</CardDescription>
            <Button variant="outline" asChild className="mt-4">
              <Link to="/post-opportunity">Try posting again</Link>
            </Button>
          </CardHeader>
        )}
      </Card>
    </div>
  );
};

export default VerifyOpportunity;
