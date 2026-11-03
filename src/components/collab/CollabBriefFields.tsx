import { useId, useState } from "react";
import { Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import {
  BRIEF_FIELD_LABEL,
  BRIEF_MAX_CHARS,
  BRIEF_MIN_CHARS,
  cleanBriefText,
  validateCollabBrief,
  type BriefErrors,
  type BriefField,
  type BriefValue,
  type CollabBrief,
} from "@/lib/collabBrief";
import { buildCollabBriefPrompt, draftWithKreto, loadPassportContext, parseCollabDraft, type ProjectFacts, type RecipientFacts } from "@/lib/kretoDraft";
import { cn } from "@/lib/utils";

interface CollabBriefFieldsProps {
  value: BriefValue;
  onChange: (next: BriefValue) => void;
  recipient: RecipientFacts;
  project?: ProjectFacts | null;
  /** True once the person has tried to send: the fields then say what is missing. */
  showErrors?: boolean;
  disabled?: boolean;
}

const PLACEHOLDER: Record<BriefField, string> = {
  summary: "What are you making, for whom, and what would you ask of them?",
  reason: "What about their work or skills makes them the right person for it?",
};

/**
 * The brief a collaboration request must carry: what the project is, and why this person. Two required fields, written by hand or drafted
 * by Kreto from the sender's Passport and then edited. Nothing is sent from here; the form's submit button decides, and refuses a brief
 * that validateCollabBrief refuses.
 */
export function CollabBriefFields({ value, onChange, recipient, project, showErrors = false, disabled = false }: CollabBriefFieldsProps) {
  const { user } = useAuth();
  const baseId = useId();
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [before, setBefore] = useState<BriefValue | null>(null);

  const checked = validateCollabBrief(value);
  const errors: BriefErrors = "errors" in checked ? checked.errors : {};

  const draft = async () => {
    if (!user || drafting) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const passport = await loadPassportContext(user.id);
      const prompt = buildCollabBriefPrompt({ recipient, passport, project, notes: { summary: value.summary, reason: value.reason } });
      const text = await draftWithKreto({ prompt, surface: "profile", surfaceContext: { intent: "collaboration_request", recipient: recipient.name } });
      const brief: CollabBrief | null = parseCollabDraft(text);
      if (!brief) throw new Error("Kreto's draft could not be read. Try again, or write it yourself.");
      setBefore(value);
      onChange({ summary: brief.summary, reason: brief.reason });
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Kreto could not draft this. Write it yourself or try again.");
    } finally {
      setDrafting(false);
    }
  };

  const field = (name: BriefField) => {
    const id = `${baseId}-${name}`;
    const length = cleanBriefText(value[name]).length;
    const error = showErrors ? errors[name] : undefined;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm font-semibold">
          {BRIEF_FIELD_LABEL[name]} <span aria-hidden className="text-destructive">*</span>
        </Label>
        <Textarea
          id={id}
          value={value[name]}
          onChange={(e) => onChange({ ...value, [name]: e.target.value.slice(0, BRIEF_MAX_CHARS * 2) })}
          placeholder={PLACEHOLDER[name]}
          rows={3}
          required
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          disabled={disabled || drafting}
          className="resize-none text-sm"
        />
        <div className="flex items-start justify-between gap-3 text-xs">
          <p id={`${id}-help`} className={cn("text-muted-foreground", length > 0 && length < BRIEF_MIN_CHARS && "text-foreground")}>
            At least {BRIEF_MIN_CHARS} characters.
          </p>
          <span className={cn("tabular-nums", length > BRIEF_MAX_CHARS ? "text-destructive" : "text-muted-foreground")}>
            {length}/{BRIEF_MAX_CHARS}
          </span>
        </div>
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="sr-only">Brief for {recipient.name}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {recipient.name} will read this before deciding. Write it yourself, or let Kreto draft it from your Passport and edit it.
        </p>
        <div className="flex items-center gap-2">
          {before ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(before); setBefore(null); }} className="gap-1.5">
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              Restore mine
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={draft} disabled={!user || drafting || disabled} className="gap-1.5" data-testid="draft-with-kreto">
            {drafting ? <KretopiaSpinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {drafting ? "Drafting…" : "Draft with Kreto"}
          </Button>
        </div>
      </div>
      {draftError ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {draftError}
        </p>
      ) : null}
      {field("summary")}
      {field("reason")}
    </fieldset>
  );
}

export default CollabBriefFields;
