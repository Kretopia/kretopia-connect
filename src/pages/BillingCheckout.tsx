import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { initializePaddle, tokenMatchesEnvironment } from "@/lib/paddleClient";

type View = "no_link" | "not_configured" | "opening" | "failed" | "closed";

/**
 * Kretopia's default payment link for Paddle (subscriptions only). Paddle sends buyers here with `?_ptxn=<transaction>`, for example from
 * a payment-failure or renewal email; Paddle.js opens that transaction itself once it is initialised. The page decides nothing about the
 * member's plan: it only hosts the checkout, and the plan changes when Paddle's signed webhook says so.
 */
export default function BillingCheckout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hasTransaction = /^txn_[0-9a-z]+$/i.test(params.get("_ptxn") ?? "");
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
  const environment = import.meta.env.VITE_PADDLE_ENV as string | undefined;
  const configured = tokenMatchesEnvironment(token, environment);
  const [view, setView] = useState<View>(!hasTransaction ? "no_link" : !configured ? "not_configured" : "opening");

  useEffect(() => {
    if (!hasTransaction || !configured) return;
    let cancelled = false;
    initializePaddle(environment as "sandbox" | "live", token as string, (event) => {
      if (cancelled) return;
      if (event.name === "checkout.completed") navigate("/payment-success?provider=paddle", { replace: true });
      else if (event.name === "checkout.closed") setView("closed");
    }).catch(() => { if (!cancelled) setView("failed"); });
    return () => { cancelled = true; };
  }, [hasTransaction, configured, environment, token, navigate]);

  const copy: Record<Exclude<View, "opening">, { title: string; body: string }> = {
    no_link: { title: "This page opens a secure checkout", body: "It works from a payment link we send you. To subscribe, choose a plan." },
    not_configured: { title: "Checkout isn't available yet", body: "Nothing was charged. Please try again later or contact support." },
    failed: { title: "Checkout could not load", body: "Nothing was charged. Check your connection and try the link again." },
    closed: { title: "Checkout closed", body: "Nothing was charged. Your plan changes only after the payment is confirmed." },
  };

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        {view === "opening" ? (
          <CardContent className="pt-6 text-center" role="status">
            <KretopiaSpinner className="mx-auto mb-4 h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Opening secure checkout…</p>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{copy[view].title}</CardTitle>
              <CardDescription className="mt-2 text-base">{copy[view].body}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild><Link to="/subscription">See plans</Link></Button>
              <p className="text-center text-xs text-muted-foreground">
                <Link className="underline underline-offset-2" to="/terms">Terms</Link> · <Link className="underline underline-offset-2" to="/privacy">Privacy</Link>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
