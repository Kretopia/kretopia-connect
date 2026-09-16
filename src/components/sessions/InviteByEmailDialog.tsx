import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Upload, Mail, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const extractEmails = (text: string): string[] => {
  if (!text) return [];
  const tokens = text.split(/[\s,;\n\t"']+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const v = t.trim().toLowerCase();
    if (v && EMAIL_RE.test(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  eventTitle: string;
}

export const InviteByEmailDialog = ({ open, onOpenChange, eventId, eventTitle }: Props) => {
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);

  const validEmails = useMemo(() => extractEmails(raw), [raw]);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    try {
      const text = await f.text();
      // Append parsed contents
      setRaw(prev => (prev.trim() ? prev.trim() + "\n" : "") + text);
      toast.success(`Loaded ${f.name}`);
    } catch (e: any) {
      toast.error("Couldn't read file");
    }
  };

  const send = async (testOnly: boolean) => {
    if (!testOnly && validEmails.length === 0) {
      toast.error("Add at least one valid email");
      return;
    }
    if (testOnly) setTesting(true); else setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-invite", {
        body: {
          eventId,
          emails: validEmails,
          personalNote: note.trim() || undefined,
          testOnly,
        },
      });
      if (error) throw error;
      const d = data as any;
      if (testOnly) {
        toast.success("Test invite sent to your inbox");
      } else {
        toast.success(
          `Invites sent — ${d?.delivered ?? 0}/${d?.total ?? 0} delivered`,
        );
        if ((d?.failed ?? 0) > 0) {
          toast.message(`${d.failed} failed`, { description: "We'll retry automatically." });
        }
        onOpenChange(false);
        setRaw("");
        setNote("");
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send invites");
    } finally {
      setSending(false);
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Invite by email
          </DialogTitle>
          <DialogDescription>
            Send a branded invitation to <span className="font-medium text-foreground">{eventTitle}</span>.
            Recipients don't need a Kretopia account — they'll get a link to RSVP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* CSV upload */}
          <div>
            <Label className="text-xs uppercase tracking-wider">Import contacts</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                />
                <div className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition-colors text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Upload CSV or .txt</span>
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              We'll pull every valid email — comma, line, or any separator works.
            </p>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider">
              Or paste emails
            </Label>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={6}
              placeholder="alex@example.com, jamie@studio.co&#10;or one per line…"
              className="mt-1.5 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {validEmails.length > 0 ? (
                <span className="text-foreground font-medium">
                  ✓ {validEmails.length} valid email{validEmails.length === 1 ? "" : "s"} ready
                </span>
              ) : (
                "No valid emails detected yet"
              )}
            </p>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider">
              Personal note <span className="text-muted-foreground normal-case">(optional)</span>
            </Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Would love to have you in the room."
              className="mt-1.5"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => send(true)}
              disabled={sending || testing}
              className="flex-1"
            >
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send test to me
            </Button>
            <Button
              variant="lime"
              onClick={() => send(false)}
              disabled={sending || testing || validEmails.length === 0}
              className="flex-1"
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {validEmails.length > 0 ? `Send ${validEmails.length} invite${validEmails.length === 1 ? "" : "s"}` : "Send invites"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
