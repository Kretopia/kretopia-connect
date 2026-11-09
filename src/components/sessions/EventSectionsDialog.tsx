import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useToast } from "@/hooks/use-toast";
import {
  EVENT_SECTION_KEYS, SECTION_LABELS, SECTION_LIMITS, saveEventSections, type EventSectionKey, type EventSections, type FetchedSections,
} from "@/lib/eventSections";

interface EventSectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  userId: string | null;
  /** What the page loaded: the sections, whether the table exists, and whether reading it failed. */
  loaded: FetchedSections;
  onSaved: (sections: EventSections) => void;
}

const HINTS: Record<EventSectionKey, string> = {
  program: "One entry per line, for example “19:00 Doors”. Shown under Program.",
  venue: "Anything guests should know about the place: entrance, parking, access. Shown under the venue details.",
  policies: "One policy per line. When you write any, it replaces the page's default policy text.",
  faq: "Questions your guests ask. When you write any, they replace the page's default FAQ.",
};

const copy = (sections: EventSections): EventSections =>
  Object.fromEntries(EVENT_SECTION_KEYS.map((key) => [key, { ...sections[key], faq: sections[key].faq.map((item) => ({ ...item })) }])) as EventSections;

/**
 * The host edits the event page's optional sections here: the words of Program, Venue notes, Policies and FAQ, and a switch for each that
 * shows or hides it. Hiding keeps the words. Saving goes to the event's own sections table, limited to the event's creator by the database;
 * until that table exists the dialog says so and does not pretend to save.
 */
export function EventSectionsDialog({ open, onOpenChange, eventId, userId, loaded, onSaved }: EventSectionsDialogProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<EventSections>(() => copy(loaded.sections));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(copy(loaded.sections));
  }, [open, loaded.sections]);

  const blocked = !loaded.available || loaded.loadFailed;
  const update = (key: EventSectionKey, patch: Partial<EventSections[EventSectionKey]>) => setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const save = async () => {
    setSaving(true);
    const result = await saveEventSections(eventId, userId, draft);
    setSaving(false);
    if (result.ok === false) {
      toast({ title: "Page sections not saved", description: result.message, variant: "destructive" });
      return;
    }
    toast({ title: "Page sections saved", description: "Your changes are on the event page now." });
    onSaved(Object.fromEntries(EVENT_SECTION_KEYS.map((key) => [key, { ...draft[key], stored: true }])) as EventSections);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit page sections</DialogTitle>
          <DialogDescription>Write what guests see in each section, and show or hide it. Hiding a section keeps what you wrote.</DialogDescription>
        </DialogHeader>

        {!loaded.available && (
          <p role="status" className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Editing page sections isn't available yet. Nothing you type here can be saved until it is.
          </p>
        )}
        {loaded.available && loaded.loadFailed && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            The current sections could not be loaded, so they cannot be edited safely. Close this and try again.
          </p>
        )}

        <div className="space-y-5">
          {EVENT_SECTION_KEYS.map((key) => {
            const section = draft[key];
            const inputId = `event-section-${key}`;
            return (
              <fieldset key={key} aria-labelledby={`${inputId}-title`} className="space-y-3 rounded-xl border border-border p-4" disabled={blocked || saving}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 id={`${inputId}-title`} className="font-semibold">{SECTION_LABELS[key]}</h3>
                    <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">{HINTS[key]}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Label htmlFor={`${inputId}-visible`} className="text-sm">Show on the event page</Label>
                    <Switch id={`${inputId}-visible`} checked={section.visible} onCheckedChange={(visible) => update(key, { visible })} aria-label={`Show ${SECTION_LABELS[key]} on the event page`} />
                  </div>
                </div>

                {key === "faq" ? (
                  <div className="space-y-3">
                    {section.faq.map((item, index) => (
                      <div key={index} className="space-y-2 rounded-lg bg-muted/30 p-3">
                        <Input
                          value={item.question}
                          maxLength={SECTION_LIMITS.question}
                          placeholder="Question"
                          aria-label={`FAQ question ${index + 1}`}
                          onChange={(e) => update("faq", { faq: section.faq.map((entry, i) => (i === index ? { ...entry, question: e.target.value } : entry)) })}
                        />
                        <Textarea
                          value={item.answer}
                          maxLength={SECTION_LIMITS.answer}
                          rows={2}
                          placeholder="Answer"
                          aria-label={`FAQ answer ${index + 1}`}
                          onChange={(e) => update("faq", { faq: section.faq.map((entry, i) => (i === index ? { ...entry, answer: e.target.value } : entry)) })}
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => update("faq", { faq: section.faq.filter((_, i) => i !== index) })}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />Remove question {index + 1}
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={section.faq.length >= SECTION_LIMITS.faqItems}
                      onClick={() => update("faq", { faq: [...section.faq, { question: "", answer: "" }] })}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />Add a question
                    </Button>
                  </div>
                ) : (
                  <Textarea
                    id={inputId}
                    value={section.text}
                    maxLength={SECTION_LIMITS.text}
                    rows={key === "program" ? 6 : 4}
                    aria-describedby={`${inputId}-hint`}
                    aria-label={SECTION_LABELS[key]}
                    onChange={(e) => update(key, { text: e.target.value })}
                  />
                )}
              </fieldset>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={blocked || saving}>
            {saving ? <KretopiaSpinner className="mr-2 h-4 w-4" /> : null}Save sections
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EventSectionsDialog;
