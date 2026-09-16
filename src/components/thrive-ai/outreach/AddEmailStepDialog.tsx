import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  emailForm: { subject: string; body: string; delay_days: number };
  setEmailForm: (f: { subject: string; body: string; delay_days: number }) => void;
  generating: boolean;
  isAdding: boolean;
  onGenerate: () => void;
  onAdd: () => void;
}

export const AddEmailStepDialog = ({
  open, onClose, emailForm, setEmailForm, generating, isAdding, onGenerate, onAdd,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Email Step</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI Generate
            </Button>
          </div>
          <div>
            <Label>Subject Line *</Label>
            <Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder="e.g. Quick intro — love your work!" />
          </div>
          <div>
            <Label>Email Body *</Label>
            <Textarea value={emailForm.body} onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} placeholder="Write your email content..." rows={6} />
          </div>
          <div>
            <Label>Delay (days after previous step)</Label>
            <Input type="number" min={0} value={emailForm.delay_days} onChange={(e) => setEmailForm({ ...emailForm, delay_days: parseInt(e.target.value) || 0 })} />
          </div>
          <Button className="w-full" onClick={onAdd} disabled={!emailForm.subject.trim() || !emailForm.body.trim() || isAdding}>
            {isAdding ? "Adding..." : "Add Step"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
