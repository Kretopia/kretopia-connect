import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import { buildApplicationPrompt, describeBasis, draftWithKreto, loadPassportContext, type OpportunityFacts } from "@/lib/kretoDraft";
import { signInHref } from "@/lib/entryChoice";

interface ApplyWithKretoProps {
  opportunity: OpportunityFacts;
  /** The draft, when the caller keeps it (so the same text follows the person from the card to the full apply flow). */
  value?: string;
  onChange?: (next: string) => void;
}

/**
 * Kreto drafts an application from the listing and the person's Passport; the draft lands in a field they edit. Nothing is sent from
 * here: the only things that leave are what the person copies and what they do on the listing themselves.
 */
export function ApplyWithKreto({ opportunity, value, onChange }: ApplyWithKretoProps) {
  const { user } = useAuth();
  const baseId = useId();
  const [local, setLocal] = useState("");
  const text = value ?? local;
  const setText = (next: string) => (onChange ? onChange(next) : setLocal(next));
  const [notes, setNotes] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [basis, setBasis] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const draft = async () => {
    if (!user || drafting) return;
    setDrafting(true);
    setError(null);
    setCopied(false);
    try {
      const passport = await loadPassportContext(user.id);
      const prompt = buildApplicationPrompt({ opportunity, passport, notes });
      const result = await draftWithKreto({
        prompt,
        surface: "gigs",
        surfaceContext: { intent: "application_draft", opportunity_title: opportunity.title, opportunity_company: opportunity.company ?? null },
      });
      setText(result);
      setBasis(describeBasis(passport));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kreto could not draft this. Try again, or write it yourself.");
    } finally {
      setDrafting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Copy did not work here. Select the text and copy it yourself.");
    }
  };

  return (
    <div className="space-y-3" data-testid="apply-with-kreto">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Kreto drafts an application from this listing and your Passport. Edit it, then apply yourself: nothing is sent from here.
      </p>

      {user ? (
        <>
          <div className="space-y-1">
            <label htmlFor={`${baseId}-notes`} className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
              Anything to emphasise? (optional)
            </label>
            <Input id={`${baseId}-notes`} value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. I am free from March, and I have shot at night before" className="h-9 text-xs" disabled={drafting} />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={draft} disabled={drafting} className="gap-1.5" data-testid="kreto-draft-application">
            {drafting ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {drafting ? "Drafting…" : text.trim() ? "Redraft with Kreto" : "Draft with Kreto"}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          <Link to={signInHref("/scout")} className="font-semibold text-foreground underline underline-offset-2">Sign in</Link> to let Kreto draft from your Passport. You can also write your own below.
        </p>
      )}

      <div role="status" aria-live="polite" className="min-h-[1rem] text-[11px] text-muted-foreground">
        {drafting ? "Kreto is drafting…" : basis && text.trim() ? basis : ""}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Textarea
        aria-label="Your application draft"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
        rows={7}
        maxLength={4000}
        placeholder="Your draft will appear here. You can also write it yourself."
        className="resize-y text-sm"
        disabled={drafting}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">{text.trim() ? `${text.trim().split(/\s+/).length} words` : ""}</span>
        <Button type="button" size="sm" variant="ghost" onClick={copy} disabled={!text.trim()} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export default ApplyWithKreto;
