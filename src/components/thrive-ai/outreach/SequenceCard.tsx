import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown, Clock, Link2, Loader2, Mail, Pause, Play, PlusCircle, Send, Sparkles, Trash2,
} from "lucide-react";
import { STATUS_STYLES, type Lead, type Sequence, type SequenceEmail } from "./types";

interface Props {
  seq: Sequence;
  emails: SequenceEmail[];
  linkedLead: Lead | null;
  sending: string | null;
  generating: boolean;
  onSendNext: () => void;
  onLinkLead: () => void;
  onUpdateStatus: (status: string) => void;
  onDeleteSequence: () => void;
  onAddEmailStep: () => void;
  onGenerate: () => void;
  onDeleteEmail: (id: string) => void;
}

export const SequenceCard = ({
  seq, emails, linkedLead, sending, generating,
  onSendNext, onLinkLead, onUpdateStatus, onDeleteSequence, onAddEmailStep, onGenerate, onDeleteEmail,
}: Props) => {
  const pendingEmails = emails.filter((e) => e.status === "pending").length;

  return (
    <Collapsible>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform [[data-state=open]>&]:rotate-180" />
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{seq.name}</span>
                <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[seq.status]}`}>
                  {seq.status}
                </Badge>
              </div>
              {linkedLead && (
                <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> {linkedLead.name}{linkedLead.email ? ` · ${linkedLead.email}` : ""}
                </p>
              )}
              {!linkedLead && seq.recipient_email && (
                <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {seq.recipient_email}
                </p>
              )}
              {seq.description && (<p className="text-xs text-muted-foreground truncate">{seq.description}</p>)}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {emails.length} email{emails.length !== 1 ? "s" : ""} · {seq.completed_steps}/{seq.total_steps} sent
                {pendingEmails > 0 && ` · ${pendingEmails} pending`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {pendingEmails > 0 && (linkedLead?.email || seq.recipient_email) && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSendNext} disabled={sending === seq.id} title="Send next email">
                  {sending === seq.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 text-primary" />}
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onLinkLead} title="Link lead">
                <Link2 className="h-3.5 w-3.5" />
              </Button>
              {seq.status === "draft" && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUpdateStatus("active")} title="Activate">
                  <Play className="h-3.5 w-3.5 text-green-500" />
                </Button>
              )}
              {seq.status === "active" && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUpdateStatus("paused")} title="Pause">
                  <Pause className="h-3.5 w-3.5 text-yellow-500" />
                </Button>
              )}
              {seq.status === "paused" && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUpdateStatus("active")} title="Resume">
                  <Play className="h-3.5 w-3.5 text-green-500" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={onDeleteSequence}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
            {emails.map((email) => (
              <div key={email.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                  {email.step_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{email.subject}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{email.body}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {email.delay_days > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> +{email.delay_days}d delay
                      </span>
                    )}
                    <Badge className={`text-[9px] px-1 py-0 ${email.status === "sent" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                      {email.status}
                    </Badge>
                    {email.sent_at && (
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(email.sent_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/50 hover:text-destructive shrink-0" onClick={() => onDeleteEmail(email.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={onAddEmailStep}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Step
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI Draft
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
