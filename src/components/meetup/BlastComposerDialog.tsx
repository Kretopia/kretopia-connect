import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TEMPLATES: { value: string; label: string; subject: string; body: string }[] = [
  {
    value: "custom",
    label: "Custom message",
    subject: "",
    body: "",
  },
  {
    value: "announcement",
    label: "📣 Announcement",
    subject: "Important update about {{eventTitle}}",
    body: "<p>Hey there,</p><p>We have an update about the event. Read on below.</p><p>[Your message here]</p>",
  },
  {
    value: "reminder_24h",
    label: "⏰ 24-hour reminder",
    subject: "Tomorrow: {{eventTitle}}",
    body: "<p>Just a quick reminder — {{eventTitle}} is happening tomorrow.</p><p>Here's everything you need to know:</p><ul><li>Doors / start time</li><li>Location</li><li>What to bring</li></ul><p>Can't wait to see you there.</p>",
  },
  {
    value: "day_of",
    label: "🎉 Day-of message",
    subject: "Today is the day — {{eventTitle}}",
    body: "<p>It's happening today!</p><p>See you soon.</p>",
  },
  {
    value: "thank_you",
    label: "🙏 Thank-you note",
    subject: "Thanks for coming to {{eventTitle}}",
    body: "<p>Thank you so much for being part of {{eventTitle}}. It wouldn't have been the same without you.</p><p>We'd love to hear your thoughts — drop us a line anytime.</p>",
  },
  {
    value: "feedback",
    label: "💬 Request feedback",
    subject: "Quick favor — your thoughts on {{eventTitle}}?",
    body: "<p>Hope you enjoyed {{eventTitle}}.</p><p>Could you spare 60 seconds to share what worked, what didn't, and what you'd want next time?</p>",
  },
  {
    value: "cancellation",
    label: "⚠️ Cancellation",
    subject: "{{eventTitle}} has been cancelled",
    body: "<p>Unfortunately, we have to cancel {{eventTitle}}.</p><p>[Reason and refund / next-steps info here]</p><p>Thank you for understanding.</p>",
  },
];

const SEGMENTS = [
  { value: "all", label: "Everyone (RSVPs + ticket holders)" },
  { value: "rsvp", label: "RSVPs only" },
  { value: "paid", label: "Paid ticket holders only" },
  { value: "waitlist", label: "Waitlist" },
  { value: "checked_in", label: "Checked-in attendees" },
  { value: "no_show", label: "No-shows" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  eventTitle: string;
  onSent?: () => void;
  /** Optional override: send to these specific user IDs instead of a named segment. */
  userIds?: string[];
  /** Human-readable label for the override segment (stored on the blast record). */
  segmentLabel?: string;
}

export const BlastComposerDialog = ({ open, onOpenChange, eventId, eventTitle, onSent, userIds, segmentLabel }: Props) => {
  const [template, setTemplate] = useState("custom");
  const [segment, setSegment] = useState("all");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [ctaText, setCtaText] = useState("View Event");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);

  const applyTemplate = (val: string) => {
    setTemplate(val);
    const t = TEMPLATES.find(t => t.value === val);
    if (t && val !== "custom") {
      setSubject(t.subject.replace(/\{\{eventTitle\}\}/g, eventTitle));
      setBodyHtml(t.body.replace(/\{\{eventTitle\}\}/g, eventTitle));
    }
  };

  const send = async (testOnly: boolean) => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    if (testOnly) setTesting(true); else setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-blast", {
        body: { eventId, subject, bodyHtml, template, segment, ctaText, testOnly, userIds, segmentLabel },
      });
      if (error) throw error;
      const d = data as any;
      if (testOnly) {
        toast.success("Test email sent to your inbox");
      } else {
        toast.success(`Blast sent — ${d?.delivered ?? 0}/${d?.total ?? 0} delivered`);
        onSent?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send blast");
    } finally {
      setSending(false);
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New Email Blast</DialogTitle>
          <DialogDescription>
            Send an announcement, reminder, or thank-you to your event audience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs uppercase tracking-wider">Template</Label>
            <Select value={template} onValueChange={applyTemplate}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {userIds && userIds.length > 0 ? (
            <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
              <Label className="text-xs uppercase tracking-wider">Audience</Label>
              <p className="text-sm font-medium mt-0.5">
                {segmentLabel || "Custom segment"} · {userIds.length} {userIds.length === 1 ? "guest" : "guests"}
              </p>
            </div>
          ) : (
            <div>
              <Label className="text-xs uppercase tracking-wider">Audience</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs uppercase tracking-wider">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Reminder: doors open at 7pm"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider">Message (HTML supported)</Label>
            <Textarea
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              placeholder="<p>Hey there,</p><p>Quick update...</p>"
              rows={8}
              className="mt-1.5 font-mono text-xs"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider">CTA button text</Label>
            <Input
              value={ctaText}
              onChange={e => setCtaText(e.target.value)}
              placeholder="View Event"
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
              disabled={sending || testing}
              className="flex-1"
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send to audience
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
