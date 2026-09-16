import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  invoiceId: string | null;
  invoiceLabel?: string;
  onOpenChange: (open: boolean) => void;
}

type Phase = "drafting" | "review" | "sent" | "error";

/**
 * AI-drafted payment reminder: draft -> user reviews/edits -> user confirms
 * send -> system executes (send-outreach-draft) only on that explicit
 * confirm. The AI never sends anything on its own — it only ever produces
 * text for this drawer to show before a human decides.
 */
export function InvoiceChaseDrawer({ invoiceId, invoiceLabel, onOpenChange }: Props) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("drafting");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<"friendly" | "firm">("friendly");
  const [errorMsg, setErrorMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    setPhase("drafting");
    setErrorMsg("");
    draft(tone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const draft = async (t: "friendly" | "firm") => {
    if (!invoiceId) return;
    setPhase("drafting");
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-chase", {
        body: { invoice_id: invoiceId, tone: t, send: false },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraftId(data.draft.id);
      setSubject(data.draft.subject);
      setBody(data.draft.body);
      setGeneratedAt(new Date());
      setPhase("review");
    } catch (e: any) {
      setErrorMsg(e.message || "Couldn't draft a reminder");
      setPhase("error");
    }
  };

  const handleSend = async () => {
    if (!draftId) return;
    setSending(true);
    try {
      // Persist any edits the user made before triggering the actual send.
      const { error: updateError } = await supabase
        .from("outreach_drafts")
        .update({ subject, body })
        .eq("id", draftId);
      if (updateError) throw updateError;

      const { data, error } = await supabase.functions.invoke("send-outreach-draft", {
        body: { draft_id: draftId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPhase("sent");
      toast({ title: "Reminder sent", description: "The client will get it in their inbox shortly." });
    } catch (e: any) {
      toast({
        title: "Couldn't send",
        description: e.message || "Something went wrong sending the reminder.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={!!invoiceId} onOpenChange={(o) => !o && onOpenChange(false)}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto sm:max-w-lg sm:mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Payment reminder
          </SheetTitle>
          <SheetDescription>
            {invoiceLabel ? `For ${invoiceLabel}` : "Draft"} — review before sending. Nothing goes out until you confirm.
          </SheetDescription>
        </SheetHeader>

        {phase === "drafting" && (
          <div className="py-10 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Drafting a reminder…
          </div>
        )}

        {phase === "error" && (
          <div className="py-6 space-y-3">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={() => draft(tone)}>Try again</Button>
          </div>
        )}

        {phase === "review" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Sparkles className="h-3 w-3" /> AI-generated
              </Badge>
              {generatedAt && (
                <span className="text-[10px] text-muted-foreground">
                  drafted {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <div className="ml-auto flex gap-1">
                <Button
                  size="sm"
                  variant={tone === "friendly" ? "secondary" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => { setTone("friendly"); draft("friendly"); }}
                >
                  Friendly
                </Button>
                <Button
                  size="sm"
                  variant={tone === "firm" ? "secondary" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => { setTone("firm"); draft("firm"); }}
                >
                  Firm
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chase-subject" className="text-xs">Subject</Label>
              <Input id="chase-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chase-body" className="text-xs">Message</Label>
              <Textarea id="chase-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              You can edit the text above — it's sent exactly as it appears here, not the original AI draft.
            </p>
          </div>
        )}

        {phase === "sent" && (
          <div className="py-10 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="font-medium">Reminder sent</p>
            <p className="text-xs text-muted-foreground">
              Sent {new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        )}

        {phase === "review" && (
          <SheetFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send reminder
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
