import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, ExternalLink, ShieldCheck, AlertTriangle, X, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditThumb } from "./CreditThumb";
import type { ClaimedCredit } from "./types";

interface Props {
  credits: ClaimedCredit[];
  onBack: () => void;
  onConfirm: (verified: ClaimedCredit[], reportedIds: string[]) => void;
}

/**
 * Step 2.5 — Verification gate.
 * Shows the credits the user just approved and asks them to flag
 * any wrong matches BEFORE we finalize the claim. Trust > speed.
 */
export const VerifyMatchesStep = ({ credits, onBack, onConfirm }: Props) => {
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);

  const prettyHost = (url?: string) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  };

  const toggleReport = (id: string) =>
    setReported((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const verified = useMemo(
    () => credits.filter((c) => !reported.has(c._id)),
    [credits, reported]
  );

  const handleConfirm = () => {
    onConfirm(verified, Array.from(reported));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
            Final check
          </span>
        </div>
        <h2 className="text-xl font-bold">Are these all really you?</h2>
        <p className="text-sm text-muted-foreground">
          Tap the source link to verify. Flag anything that's not yours — we'll
          remove it before saving. Fake or wrong credits hurt everyone's trust.
        </p>
      </div>

      <div className="space-y-2.5">
        {credits.map((c) => {
          const isReported = reported.has(c._id);
          const host = prettyHost(c.url);
          return (
            <div
              key={c._id}
              className={cn(
                "rounded-xl border-2 overflow-hidden transition-all",
                isReported
                  ? "border-destructive/40 bg-destructive/5 opacity-70"
                  : "border-border bg-card"
              )}
            >
              <div className="flex gap-3 p-2.5">
                <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden">
                  <CreditThumb
                    src={c.thumbnail}
                    title={c.title}
                    platform={c.platform || c.source_name}
                    className="absolute inset-0 w-full h-full"
                    iconClassName="h-6 w-6"
                  />
                  {isReported && (
                    <div className="absolute inset-0 bg-destructive/40 flex items-center justify-center">
                      <X className="h-6 w-6 text-destructive-foreground" strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight line-clamp-2",
                      isReported && "line-through"
                    )}
                  >
                    {c.title}
                  </p>
                  {c.role_suggestion && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {c.role_suggestion}
                      {c.year ? ` · ${c.year}` : ""}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.source_name && (
                      <Badge variant="outline" className="text-[9px] py-0 h-4 px-1.5">
                        via {c.source_name}
                      </Badge>
                    )}
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {host || "Open source"}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleReport(c._id)}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold border-t transition-colors",
                  isReported
                    ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "border-border text-muted-foreground hover:bg-muted/60"
                )}
              >
                {isReported ? (
                  <>
                    <Undo2 className="h-3 w-3" />
                    Restore — this is mine
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    Not me — remove
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {reported.size > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive-foreground/90">
          <p className="font-semibold mb-0.5 text-destructive">
            {reported.size} flagged for removal
          </p>
          <p className="text-muted-foreground">
            We won't save these. Our team will also review the source so the
            wrong match doesn't surface again.
          </p>
        </div>
      )}

      <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
        />
        <span className="text-xs leading-snug text-muted-foreground">
          I confirm the {verified.length} remaining credit
          {verified.length === 1 ? "" : "s"} {verified.length === 1 ? "is" : "are"} accurately mine.
          I understand falsely claiming work may result in account removal.
        </span>
      </label>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onBack} size="lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!acknowledged || verified.length === 0}
          className="flex-1"
          size="lg"
        >
          {verified.length === 0
            ? "Nothing to confirm"
            : `Confirm ${verified.length} credit${verified.length === 1 ? "" : "s"}`}
          {verified.length > 0 && acknowledged && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
