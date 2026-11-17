import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Heart, ScanSearch, Users } from "lucide-react";
import { ScoutScanButton } from "@/components/scout/ScoutScanButton";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

/** Kreto Match gives immediate, deterministic guidance from real deck events; no AI request or credits. */
export function MatchPulse() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Tell me what you want to create. I’ll help you find the right people.");
  const scanningRef = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  const scan = () => {
    if (!user) { navigate("/auth?next=/match"); return; }
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanning(true);
    setError(null);
    setAnswer("I’m refreshing your deck and bringing the strongest real profile signals forward.");
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
      navigate("/match?tab=connected&view=received");
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
    <section aria-label="Kreto Match" className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="p-4 sm:p-5">
        <div className="flex gap-3 sm:items-center">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 sm:h-24 sm:w-24">
          <KretoCharacter variant="scout" size={76} state={scanning ? "processing" : "attentive"} floatAmplitude={3} floatDuration={4} />
          <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" aria-label="Kreto is ready" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-foreground">Kreto Match</h2>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Your creative scout</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground" aria-live="polite">{answer}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {scanning ? "Reading real profile signals…" : error ? "Refresh unavailable" : lastScan
              ? `${count ?? 0} profiles · checked ${lastScan.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Real people. Mutual interest. Meaningful collaborations."}
          </p>
        </div>
        </div>
        <div className="mt-4"><ScoutScanButton finitePulse label={scanning ? "Scanning…" : error ? "Try again" : "Scan now"} busy={scanning} onClick={scan} /></div>
      </div>
      <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" className="h-10 justify-start gap-2 text-xs" onClick={() => navigate("/match?tab=connected&view=received")}>
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
