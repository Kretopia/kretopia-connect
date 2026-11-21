import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { COMPOSER_CHIP } from "@/components/kreto/composerStyles";

interface KretoSettingsProps {
  /** Put the composer's model, effort and "what Kreto can see" back to Auto, Balanced and Auto. */
  onResetDefaults: () => void;
  disabled?: boolean;
}

type ActionSettings = { agents_enabled: boolean; auto_run_safe: boolean };
const DEFAULTS: ActionSettings = { agents_enabled: true, auto_run_safe: true };

/**
 * Kreto's settings, in one place beside the composer: whether Kreto may act at all, whether the person's own records run
 * without asking (the server's orch_settings, which the orchestrator reads), memory, and this device's defaults. Anything
 * that reaches other people, goes public or involves money always waits for approval, whatever is set here.
 */
export function KretoSettings({ onResetDefaults, disabled }: KretoSettingsProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ActionSettings | null>(null);
  const [saving, setSaving] = useState<keyof ActionSettings | null>(null);
  const [error, setError] = useState("");
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setError("");
    supabase
      .from("orch_settings")
      .select("agents_enabled, auto_run_safe")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) setError("I couldn't load your settings. Try again in a moment.");
        setSettings({ ...DEFAULTS, ...(data ?? {}) });
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const save = async (key: keyof ActionSettings, value: boolean) => {
    if (!userId || !settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value });
    setSaving(key);
    setError("");
    const row: { user_id: string } & Partial<ActionSettings> = { user_id: userId };
    row[key] = value;
    const { error: writeError } = await supabase.from("orch_settings").upsert(row, { onConflict: "user_id" });
    if (writeError) {
      setSettings(previous);
      setError("That didn't save. Your previous setting still applies.");
    }
    setSaving(null);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setResetDone(false); }}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} aria-label="Kreto settings" className={COMPOSER_CHIP}>
          <SlidersHorizontal className="h-3 w-3" aria-hidden />
          <span className="sr-only sm:not-sr-only">Settings</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kreto settings</DialogTitle>
          <DialogDescription>
            Anything that reaches other people, goes public or involves money always waits for your approval.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3" aria-labelledby="kreto-settings-actions">
          <h3 id="kreto-settings-actions" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</h3>
          {!userId ? (
            <p className="text-xs text-muted-foreground">Sign in to choose what I may do for you.</p>
          ) : !settings ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><KretopiaSpinner className="h-3 w-3" /> Loading your settings</p>
          ) : (
            <>
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium text-foreground">Let me act for you</span>
                  <span className="block text-xs text-muted-foreground">Off: I still answer, but I don't propose or run anything.</span>
                </span>
                <Switch
                  checked={settings.agents_enabled}
                  disabled={saving !== null}
                  onCheckedChange={(v) => save("agents_enabled", v)}
                  aria-label="Let Kreto act for you"
                />
              </label>
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium text-foreground">Run your own records without asking</span>
                  <span className="block text-xs text-muted-foreground">
                    Tasks, reminders, notes and Credits on your own Passport. Off: these wait for your approval too.
                  </span>
                </span>
                <Switch
                  checked={settings.auto_run_safe}
                  disabled={saving !== null || !settings.agents_enabled}
                  onCheckedChange={(v) => save("auto_run_safe", v)}
                  aria-label="Run your own records without asking"
                />
              </label>
            </>
          )}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </section>

        <section className="space-y-2 border-t border-border pt-4" aria-labelledby="kreto-settings-knowledge">
          <h3 id="kreto-settings-knowledge" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What I know</h3>
          <p className="text-xs text-muted-foreground">
            I ask each time before looking outside Kretopia. What I can see in a chat is set from the composer, and memory can be
            switched off there for any chat.
          </p>
          <Link to="/copilot-memory" className="inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary">
            See and delete what I remember
          </Link>
        </section>

        <section className="space-y-2 border-t border-border pt-4" aria-labelledby="kreto-settings-device">
          <h3 id="kreto-settings-device" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this device</h3>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Model, effort and what I can see go back to Auto and Balanced.</p>
            <div className="flex items-center gap-2">
              {resetDone && <span role="status" className="text-xs text-muted-foreground">Done</span>}
              <button
                type="button"
                onClick={() => { onResetDefaults(); setResetDone(true); }}
                className="btn-glass btn-glass-outline rounded-full px-3 py-1 text-xs font-semibold"
              >
                Reset defaults
              </button>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export default KretoSettings;
