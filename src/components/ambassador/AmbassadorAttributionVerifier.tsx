import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Link as LinkIcon } from "lucide-react";
import {
  getAttributionStatus,
  retryAttachment,
  type AttributionStatus,
} from "@/lib/ambassadorAttribution";
import { useAuth } from "@/hooks/useAuth";
import { APP_URL } from "@/lib/constants";
import { toast } from "sonner";

interface Props {
  /** Ambassador's own code, when viewing from the dashboard. Lets us self-test the link. */
  ownAmbassadorCode?: string | null;
}

const STAGE_META: Record<
  AttributionStatus["stage"],
  { label: string; tone: "ok" | "warn" | "error" | "neutral"; help: string }
> = {
  none: {
    label: "No referral code captured",
    tone: "neutral",
    help: "Open a share link with ?amb=CODE in this browser to test capture.",
  },
  captured: {
    label: "Code captured, waiting for sign-up",
    tone: "warn",
    help: "The ?amb code is stored. It will attach to the profile on first sign-in.",
  },
  attached: {
    label: "Attributed ✅",
    tone: "ok",
    help: "This account is correctly credited to the ambassador.",
  },
  invalid: {
    label: "Code not recognised",
    tone: "error",
    help: "No ambassador exists for that code. The code will be cleared.",
  },
  already_set: {
    label: "Already attributed to a different ambassador",
    tone: "warn",
    help: "We never overwrite an existing attribution.",
  },
};

export function AmbassadorAttributionVerifier({ ownAmbassadorCode }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<AttributionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const s = await getAttributionStatus(user?.id ?? null);
    setStatus(s);
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch((e) => {
      console.error("[Verifier] load failed", e);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onRetry = async () => {
    if (!user) return;
    setRunning(true);
    try {
      const s = await retryAttachment(user.id);
      setStatus(s);
      toast.success("Attribution re-checked");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not re-run attribution");
    } finally {
      setRunning(false);
    }
  };

  const testOwnLink = async () => {
    if (!ownAmbassadorCode) return;
    try {
      sessionStorage.setItem("thrivein_amb_code", ownAmbassadorCode);
      try { localStorage.setItem("thrivein_amb_code_persist", ownAmbassadorCode); } catch { /* ignore */ }
      toast.success("Simulated capture — refreshing");
      await refresh();
    } catch {
      toast.error("Could not simulate capture");
    }
  };

  const meta = status ? STAGE_META[status.stage] : null;
  const toneClass =
    meta?.tone === "ok"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : meta?.tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : meta?.tone === "error"
      ? "border-destructive/40 bg-destructive/5"
      : "border-border/50";

  const Icon = meta?.tone === "ok" ? CheckCircle2 : meta?.tone === "error" || meta?.tone === "warn" ? AlertTriangle : LinkIcon;

  return (
    <Card className={toneClass}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          Attribution check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading || !status ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking…
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={meta!.tone === "ok" ? "default" : "outline"}>
                  {meta!.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{meta!.help}</p>
            </div>

            <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-xs">
              <dt className="text-muted-foreground">Captured code</dt>
              <dd className="font-mono">{status.capturedCode ?? "—"}</dd>
              <dt className="text-muted-foreground">Profile code</dt>
              <dd className="font-mono">{status.profileCode ?? "—"}</dd>
              {status.ambassadorName && (
                <>
                  <dt className="text-muted-foreground">Resolves to</dt>
                  <dd>{status.ambassadorName}</dd>
                </>
              )}
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={refresh} disabled={running}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Re-check
              </Button>
              {user && status.stage === "captured" && (
                <Button size="sm" onClick={onRetry} disabled={running}>
                  {running && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Run attach
                </Button>
              )}
              {ownAmbassadorCode && (
                <Button size="sm" variant="ghost" onClick={testOwnLink}>
                  Simulate my link
                </Button>
              )}
              {ownAmbassadorCode && (
                <a
                  className="text-xs underline text-muted-foreground self-center"
                  href={`${APP_URL}/?amb=${ownAmbassadorCode}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open share URL ↗
                </a>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AmbassadorAttributionVerifier;
