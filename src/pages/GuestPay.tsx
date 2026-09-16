import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wallet, Plus, LogOut, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  clearGuestToken,
  createGuestTopup,
  fetchGuestWallet,
  formatCents,
  getGuestToken,
  requestGuestCode,
  startGuestSession,
  type GuestTopup,
  type GuestWallet,
} from "@/lib/guestWallet";
import { SEO } from "@/components/SEO";

const PRESETS = [10, 25, 50, 100];

export default function GuestPay() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [hasToken, setHasToken] = useState<boolean>(() => !!getGuestToken());
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<GuestWallet | null>(null);
  const [topups, setTopups] = useState<GuestTopup[]>([]);
  const [amount, setAmount] = useState<string>("25");
  const [redirecting, setRedirecting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchGuestWallet();
      setWallet(data.wallet);
      setTopups(data.topups);
    } catch (err) {
      // Likely expired token — drop back to email screen
      clearGuestToken();
      setHasToken(false);
      const msg = err instanceof Error ? err.message : "Session expired";
      toast({ title: "Sign in again", description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasToken) {
      refresh().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // Handle return from Stripe
  useEffect(() => {
    const status = params.get("topup");
    if (!status) return;
    if (status === "success") {
      toast({ title: "Payment received", description: "Your balance has been updated." });
      // Webhook may take a moment — poll briefly
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts += 1;
        await refresh().catch(() => {});
        if (attempts >= 5) clearInterval(poll);
      }, 1500);
    } else if (status === "cancelled") {
      toast({ title: "Top-up cancelled", description: "No charge was made." });
    }
    params.delete("topup");
    params.delete("id");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      if (!codeSent) {
        await requestGuestCode(email.trim());
        setCodeSent(true);
        toast({ title: "Check your email", description: "We sent you a 6-digit code." });
      } else {
        await startGuestSession(email.trim(), code.trim());
        setCode("");
        setCodeSent(false);
        setHasToken(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start session";
      toast({ title: "Couldn't continue", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTopUp = async () => {
    const amt = Number(amount);
    if (!amt || amt < 1 || amt > 1000) {
      toast({ title: "Enter $1–$1000", variant: "destructive" });
      return;
    }
    setRedirecting(true);
    try {
      const { url } = await createGuestTopup(amt);
      window.location.href = url;
    } catch (err) {
      setRedirecting(false);
      const msg = err instanceof Error ? err.message : "Could not start top-up";
      toast({ title: "Top-up failed", description: msg, variant: "destructive" });
    }
  };

  const handleSignOut = () => {
    clearGuestToken();
    setHasToken(false);
    setWallet(null);
    setTopups([]);
    setEmail("");
    setCode("");
    setCodeSent(false);
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <SEO
        title="Guest Wallet | Kretopia"
        description="Top up a prepaid balance to use at Kretopia events and partner merchants."
      />

      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-4">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Guest Wallet</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {!hasToken ? (
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="text-lg font-semibold">Get started</h2>
                <p className="text-sm text-muted-foreground">
                  Add a balance with Apple Pay, Google Pay, or card. Bring it to any Kretopia event.
                </p>
              </div>
              <form onSubmit={handleStartSession} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={codeSent}
                    required
                  />
                </div>
                {codeSent && (
                  <div className="space-y-1.5">
                    <Label htmlFor="code">Verification code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      placeholder="6-digit code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      autoComplete="one-time-code"
                      required
                    />
                    <button
                      type="button"
                      className="text-xs text-white/60 hover:text-[#FF2DA1] underline transition-colors"
                      onClick={() => {
                        setCodeSent(false);
                        setCode("");
                      }}
                    >
                      Use a different email
                    </button>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Continuing…</>
                  ) : codeSent ? (
                    "Verify & continue"
                  ) : (
                    "Email me a code"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  We email a one-time code to confirm the address is yours. No password needed.
                </p>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-1 p-5 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
                {loading && !wallet ? (
                  <Loader2 className="mx-auto my-2 h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-4xl font-bold tabular-nums">
                    {formatCents(wallet?.balance_cents ?? 0, wallet?.currency)}
                  </p>
                )}
                {wallet?.email && (
                  <p className="text-xs text-muted-foreground">{wallet.email}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h3 className="text-sm font-semibold">Add funds</h3>
                  <p className="text-xs text-muted-foreground">
                    Pay with Apple Pay, Google Pay, or card.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={amount === String(p) ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAmount(String(p))}
                    >
                      ${p}
                    </Button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="text-xs">Custom amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={1000}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <Button onClick={handleTopUp} className="w-full" disabled={redirecting}>
                  {redirecting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
                  ) : (
                    <><Plus className="mr-2 h-4 w-4" />Add ${amount || "0"}</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {topups.length > 0 && (
              <Card>
                <CardContent className="space-y-2 p-5">
                  <h3 className="text-sm font-semibold">Recent top-ups</h3>
                  <ul className="divide-y">
                    {topups.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {t.status === "succeeded" ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : t.status === "pending" ? (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="tabular-nums">
                            {formatCents(t.amount_cents, t.currency)}
                          </span>
                        </div>
                        <span className="text-xs capitalize text-muted-foreground">
                          {t.status} · {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out of guest wallet
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
