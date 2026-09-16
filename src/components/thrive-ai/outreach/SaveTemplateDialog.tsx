import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  templateName: string;
  setTemplateName: (s: string) => void;
  bulkSubject: string;
  onSave: () => void;
}

export const SaveTemplateDialog = ({ open, onOpenChange, templateName, setTemplateName, bulkSubject, onSave }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Save Email Template</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Template Name</Label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Brand Collab Intro" />
          </div>
          <p className="text-[10px] text-muted-foreground">Subject: {bulkSubject || "—"}</p>
          <Button className="w-full" onClick={onSave} disabled={!templateName.trim()}>
            <Save className="h-4 w-4 mr-1.5" /> Save Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
