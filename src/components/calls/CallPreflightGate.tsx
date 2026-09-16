import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, Copy, ExternalLink, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runCallPreflight, type PreflightResult } from "@/lib/callPreflight";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** When provided, the fallback can copy / open this URL in another browser. */
  shareUrl?: string | null;
  onCancel: () => void;
  /** Children only render when preflight passes. */
  children: React.ReactNode;
}

/**
 * Runs a quick preflight before rendering the call lobby. Catches the most
 * common reasons calls fail silently for users:
 * - In-app webviews (Instagram, TikTok, Facebook, LinkedIn, etc.)
 * - Sandboxed / cross-origin iframes with blocked third-party storage
 * - Browsers without WebRTC or getUserMedia
 * - Insecure (http) contexts
 * - Outdated browsers our video provider doesn't support
 *
 * On failure, shows a clear, mobile-first explanation + a copy/open-link
 * fallback so the user can switch to a real browser without losing the
 * meeting URL.
 */
export const CallPreflightGate = ({ shareUrl, onCancel, children }: Props) => {
  const { toast } = useToast();
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    runCallPreflight().then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!result) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b0b0f] text-white gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-white/70">Checking your device…</p>
      </div>
    );
  }

  if (result.ok) return <>{children}</>;

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Long-press the link to select it.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0b0b0f] text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">
          Can't start the call here
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="h-9 w-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center text-center gap-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="h-14 w-14 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold leading-snug max-w-sm">
          {result.reason}
        </h2>

        {shareUrl && (
          <p className="text-xs text-white/50 max-w-sm">
            Copy the link below and open it in Safari, Chrome, Firefox, or Edge to
            join.
          </p>
        )}

        {shareUrl && (
          <div className="w-full max-w-sm space-y-2">
            <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 font-mono text-[11px] text-white/80 break-all text-left">
              {shareUrl}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={copy}
                className="h-11 gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> {result.ctaLabel ?? "Copy link"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}
                className="h-11 gap-2"
                variant="hero"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </div>
          </div>
        )}

        {!shareUrl && (
          <Button
            type="button"
            onClick={onCancel}
            className="mt-2"
            variant="outline"
          >
            Close
          </Button>
        )}

        {result.issues.length > 1 && (
          <details className="text-[11px] text-white/40 mt-2">
            <summary className="cursor-pointer">Technical details</summary>
            <ul className="mt-2 list-disc list-inside text-left">
              {result.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
              {result.browser?.name && (
                <li>
                  browser: {result.browser.name}
                  {result.browser.mobile ? " (mobile)" : ""}
                </li>
              )}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
};
