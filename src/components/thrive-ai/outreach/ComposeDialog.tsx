import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Image, Loader2, Mail, Paperclip, Send, Sparkles, Video } from "lucide-react";
import type { Lead } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  composeLead: Lead | null;
  composeForm: { to: string; subject: string; body: string };
  setComposeForm: (f: { to: string; subject: string; body: string }) => void;
  attachments: File[];
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  generating: boolean;
  sending: string | null;
  mediaUploading: boolean;
  onGenerate: () => void;
  onSend: () => void;
  onMediaInsert: (file: File, type: "image" | "video") => void;
}

export const ComposeDialog = ({
  open, onClose, composeLead, composeForm, setComposeForm,
  attachments, setAttachments, generating, sending, mediaUploading,
  onGenerate, onSend, onMediaInsert,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {composeLead ? `Email ${composeLead.name}` : "Quick Send Email"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>To *</Label>
            <Input value={composeForm.to} onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })} placeholder="recipient@example.com" type="email" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI Generate
            </Button>
          </div>
          <div>
            <Label>Subject *</Label>
            <Input value={composeForm.subject} onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })} placeholder="Subject line" />
          </div>
          <div>
            <Label>Body *</Label>
            <Textarea value={composeForm.body} onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })} placeholder="Write your message..." rows={8} />
            <div className="flex gap-1.5 mt-1.5">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" disabled={mediaUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onMediaInsert(f, "image"); e.target.value = ""; }} />
                <Badge variant="outline" className="gap-1 text-[10px] cursor-pointer hover:bg-muted">
                  <Image className="h-3 w-3" /> Embed Image
                </Badge>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="video/*" className="hidden" disabled={mediaUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onMediaInsert(f, "video"); e.target.value = ""; }} />
                <Badge variant="outline" className="gap-1 text-[10px] cursor-pointer hover:bg-muted">
                  <Video className="h-3 w-3" /> Add Video Link
                </Badge>
              </label>
              {mediaUploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Attachments</Label>
            <input type="file" multiple className="text-xs mt-1" onChange={(e) => {
              if (e.target.files) setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
            }} />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {attachments.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                    {f.name}
                    <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">Files will be uploaded and linked in the email</p>
          </div>
          <Button className="w-full gap-1.5" onClick={onSend}
            disabled={!composeForm.to.trim() || !composeForm.subject.trim() || !composeForm.body.trim() || sending === "compose"}>
            {sending === "compose" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Email</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
