import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Heart, ScanSearch, Users, Globe2, Orbit } from "lucide-react";
import { ScoutScanButton } from "@/components/scout/ScoutScanButton";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
const KretoNetworkScene = lazy(() => import("@/components/circle/KretoNetworkScene").then(m => ({ default: m.KretoNetworkScene })));
const noConnections: [] = [];
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

/** Kreto Match gives immediate, deterministic guidance from real deck events; no AI request or credits. */
export function MatchPulse() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [universeOpen, setUniverseOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Discover people who share your craft — and creators who bring a different perspective.");
  const scanningRef = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  const scan = () => {
    if (!user) { navigate("/auth?next=/match"); return; }
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setError(null);
    setAnswer("I’m refreshing your deck across places and disciplines, keeping your existing interests safe.");
    window.dispatchEvent(new CustomEvent("match:scan"));
    timeout.current = setTimeout(() => {
      scanningRef.current = false;
      setScanning(false);
      setError("timeout");
      setAnswer("That refresh took too long. Your interests are safe — try again when you’re ready.");
    }, 25000);
  };

  useEffect(() => {
    const onDone = (e: Event) => {
      clearTimeout(timeout.current);
      const detail = (e as CustomEvent<{ count: number; error?: string | null }>).detail;
      setError(detail.error ?? null);
      if (!detail.error) {
        setCount(detail.count);
        setLastScan(new Date());
        setAnswer(detail.count > 0
          ? `${detail.count} people are ready to discover. Open a Passport to see everything we can publicly share.`
          : "No new person is available yet. Your sent interests and connections remain untouched.");
      } else {
        setAnswer("I couldn’t refresh the deck. Nothing you already sent has been lost.");
      }
      scanningRef.current = false;
      setScanning(false);
    };
    window.addEventListener("match:scanned", onDone);
    return () => {
      window.removeEventListener("match:scanned", onDone);
      clearTimeout(timeout.current);
    };
  }, []);

  const ask = (event: FormEvent) => {
    event.preventDefault();
    const query = question.trim();
    if (!query) return;
    const normalized = query.toLowerCase();
    if (/interest|like me|received|who.*me/.test(normalized)) {
      setAnswer("People who already chose Connect are waiting in Received interests. A mutual Connect creates the match.");
      navigate("/match?tab=connected&view=interested");
    } else if (/connect|network|people|creator|collab|project/.test(normalized)) {
      setAnswer("Start with a full Passport, check the facts you share, then Pass or Connect. I never auto-connect anyone.");
      scan();
    } else if (/message|talk|chat/.test(normalized)) {
      setAnswer("Messaging opens after a mutual match. That way, interest never becomes unwanted contact.");
    } else {
      setAnswer("I can help you refresh your deck, review received interests, or understand how mutual matching works.");
    }
    setQuestion("");
  };

  return (
    <section aria-label="Kreto Match" className="min-w-0">
      <div className="py-2 sm:py-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2"><BrandLogo iconOnly size="sm" /><span className="text-xs font-semibold text-muted-foreground">KRETOPIA MATCH</span></div>
            <h2 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">Your Creative <span className="k-gradient-text">Universe</span></h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Globe2 className="h-4 w-4 shrink-0 text-primary" />Across borders. Across disciplines.</p>
          </div>
          <Button variant="outline" size="icon" className="shrink-0 lg:hidden" aria-label="Show Kreto 3D" title="Your creative universe" aria-expanded={universeOpen} onClick={() => setUniverseOpen(v => !v)}><Orbit className="h-5 w-5" /></Button>
        </header>
        <div className={cn("mt-2", universeOpen ? "block" : "hidden lg:block")}>
          <Suspense fallback={<div className="flex h-[300px] items-center justify-center"><KretopiaSpinner className="h-8 w-8" /></div>}>
            <KretoNetworkScene connections={noConnections} onProfile={() => {}} />
          </Suspense>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground" aria-live="polite">{answer}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">{scanning ? "Reading real profile signals…" : error ? "Refresh unavailable" : lastScan ? `${count ?? 0} profiles · checked ${lastScan.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Real people. Mutual interest. Worldwide discovery."}</p>
        <div className="mt-4"><ScoutScanButton finitePulse label={scanning ? "Scanning…" : error ? "Try again" : "Scan now"} busy={scanning} onClick={scan} /></div>
      </div>
      <div className="border-t border-border py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 justify-start gap-2 text-xs" onClick={() => navigate("/match?tab=connected&view=interested")}>
            <Heart className="h-4 w-4 text-primary" aria-hidden /> Who’s interested in me?
          </Button>
          <Button type="button" variant="outline" className="h-10 justify-start gap-2 text-xs" onClick={() => navigate("/match?tab=browse&view=grid")}>
            <Users className="h-4 w-4 text-primary" aria-hidden /> Explore every creator
          </Button>
        </div>
        <form onSubmit={ask} className="flex gap-2" role="search" aria-label="Ask Kreto Match">
          <label htmlFor="kreto-match-question" className="sr-only">Ask Kreto Match about matching</label>
          <Input id="kreto-match-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask Kreto about matching…" className="h-11 min-w-0 bg-background" maxLength={180} />
          <Button type="submit" variant="hero" className="h-11 shrink-0 gap-2 px-4" disabled={!question.trim()}>
            <ScanSearch className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Ask Kreto</span><ArrowRight className="h-4 w-4 sm:hidden" aria-hidden />
          </Button>
        </form>
      </div>
    </section>
  );
}

export default MatchPulse;
