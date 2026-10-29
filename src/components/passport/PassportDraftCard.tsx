import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  FIELD_LABEL,
  FIELD_ORDER,
  REASON_COPY,
  requestPassportDraft,
  savePassportDraft,
  type Decision,
  type DraftField,
  type DraftOutcome,
  type SaveResult,
} from "@/lib/passportDraft";

type Phase = "idle" | "loading" | "ready" | "saving";
type Ready = Extract<DraftOutcome, { status: "ready" }>;

/**
 * "Strengthen your Passport for {surface}". One request asks Kreto to draft a bio, a photo and one work item from what
 * the person already has on Kretopia. Each part is accepted or rejected on its own and only accepted parts are saved,
 * by an explicit click. A part Kreto could not honestly fill says why instead of being invented. Completing the
 * profile by hand stays available, as a quiet link rather than a competing action.
 */
export function PassportDraftCard({ surfaceLabel }: { surfaceLabel: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Ready | null>(null);
  const [decisions, setDecisions] = useState<Partial<Record<DraftField, Decision>>>({});
  const [result, setResult] = useState<SaveResult | null>(null);

  const draftIt = useCallback(async () => {
    setPhase("loading");
    setFailure(null);
    setResult(null);
    const next = await requestPassportDraft((name, opts) => supabase.functions.invoke(name, opts));
    if (next.status === "failed") {
      setOutcome(null);
      setFailure(next.message);
      setPhase("idle");
      return;
    }
    setOutcome(next);
    setDecisions({});
    setPhase("ready");
  }, []);

  const decide = (field: DraftField, d: Decision) => setDecisions((cur) => ({ ...cur, [field]: cur[field] === d ? undefined : d }));

  const accepted = FIELD_ORDER.filter((f) => decisions[f] === "accepted" && outcome?.draft[f]);

  const save = async () => {
    if (!user || !outcome || accepted.length === 0) return;
    setPhase("saving");
    const r = await savePassportDraft(supabase, user.id, outcome.draft, accepted);
    setResult(r);
    if (r.saved.length > 0) {
      toast({ title: "Saved to your Passport", description: r.saved.map((f) => FIELD_LABEL[f]).join(", ") });
      window.dispatchEvent(new CustomEvent("kretopia:profile-updated"));
    }
    // What did not save stays on screen to retry; what did is no longer offered.
    setOutcome((cur) => (cur ? { ...cur, draft: { ...cur.draft, ...Object.fromEntries(r.saved.map((f) => [f, null])) } } : cur));
    setDecisions((cur) => Object.fromEntries(Object.entries(cur).filter(([f]) => !r.saved.includes(f as DraftField))));
    setPhase("ready");
  };

  const shown = outcome ? FIELD_ORDER.filter((f) => outcome.unavailable[f] !== "already_complete" && !result?.saved.includes(f)) : [];

  return (
    <section className="rounded-lg border border-primary/20 bg-card p-4 sm:p-5" aria-labelledby="passport-draft-title">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 id="passport-draft-title" className="text-lg font-semibold text-foreground">Strengthen your Passport for {surfaceLabel}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kreto drafts a bio, a photo and one piece of work from what is already on your profile. Nothing is saved until you accept it. You can still browse now.
          </p>
        </div>
      </div>

      {phase === "loading" && (
        <div className="mt-4" role="status">
          <KretopiaLoader label="Kreto is drafting from your profile" size="sm" />
        </div>
      )}

      {failure && phase !== "loading" && (
        <p className="mt-4 text-sm text-destructive" role="alert">{failure}</p>
      )}

      {(phase === "ready" || phase === "saving") && outcome && (
        <div className="mt-4 space-y-3">
          {shown.length === 0 && <p className="text-sm text-muted-foreground" role="status">Nothing left to draft.</p>}
          {shown.map((field) => {
            const d = outcome.draft;
            const choice = decisions[field];
            return (
              <div key={field} className="rounded-md border border-border bg-muted/30 p-3" data-testid={`draft-${field}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{FIELD_LABEL[field]}</p>
                {field === "bio" && d.bio && <p className="mt-1 text-sm text-foreground">{d.bio.text}</p>}
                {field === "photo" && d.photo && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={d.photo.url} alt="Suggested profile photo" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
                    <p className="text-xs text-muted-foreground">
                      {d.photo.source === "auth_provider" ? "The photo from the account you signed in with." : "An image from your own work."}
                    </p>
                  </div>
                )}
                {field === "work_item" && d.work_item && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{d.work_item.project_name}</p>
                    <p className="text-xs text-muted-foreground">{d.work_item.role} · {d.work_item.source_label}</p>
                    <a href={d.work_item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                      Open link <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                    <p className="text-xs text-muted-foreground">Added as self-reported. It is not verified.</p>
                  </div>
                )}
                {!d[field] && (
                  <p className="mt-1 text-sm text-muted-foreground">{REASON_COPY[outcome.unavailable[field] ?? "nothing_suitable"]}</p>
                )}
                {d[field] && (
                  <div className="mt-3 flex gap-2" role="group" aria-label={`${FIELD_LABEL[field]}: accept or reject`}>
                    <Button type="button" size="sm" variant={choice === "accepted" ? "default" : "outline"} aria-pressed={choice === "accepted"} onClick={() => decide(field, "accepted")} className="min-h-11">
                      <Check className="mr-1 h-4 w-4" aria-hidden /> Accept
                    </Button>
                    <Button type="button" size="sm" variant={choice === "rejected" ? "default" : "outline"} aria-pressed={choice === "rejected"} onClick={() => decide(field, "rejected")} className="min-h-11">
                      <X className="mr-1 h-4 w-4" aria-hidden /> Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {result && result.failed.map((f) => (
            <p key={f.field} className="text-sm text-destructive" role="alert">{FIELD_LABEL[f.field]}: {f.message} Your choice is kept, try saving again.</p>
          ))}
          {outcome.partial && shown.length > 0 && !result && (
            <p className="text-xs text-muted-foreground" role="status">Kreto could draft only part of this from what you already have.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} disabled={accepted.length === 0 || phase === "saving"} className="min-h-11">
              {phase === "saving" ? <KretopiaSpinner className="mr-2 h-4 w-4" /> : null}
              Save accepted{accepted.length > 0 ? ` (${accepted.length})` : ""}
            </Button>
            <Button type="button" variant="ghost" onClick={draftIt} disabled={phase === "saving"} className="min-h-11">Draft again</Button>
          </div>
        </div>
      )}

      {(phase === "idle" || phase === "loading") && (
        <div className="mt-4">
          <Button type="button" onClick={draftIt} disabled={phase === "loading"} className="min-h-11">
            {phase === "loading" ? <KretopiaSpinner className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" aria-hidden />}
            {failure ? "Try again" : "Draft with Kreto"}
          </Button>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Prefer to do it yourself? <Link to="/profile" className="underline">Complete your profile</Link>.
      </p>
    </section>
  );
}
