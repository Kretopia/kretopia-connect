import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Unlink } from "lucide-react";
import type { Lead } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  leads: Lead[];
  onLink: (leadId: string | null) => void;
}

export const LinkLeadDialog = ({ open, onClose, leads, onLink }: Props) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Link Lead to Sequence</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No leads yet — add leads first</p>
          ) : (
            <>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm h-auto py-2" onClick={() => onLink(null)}>
                <Unlink className="h-4 w-4 text-muted-foreground" /> No lead (unlink)
              </Button>
              {leads.map((lead) => (
                <Button key={lead.id} variant="ghost" className="w-full justify-start gap-2 text-sm h-auto py-2" onClick={() => onLink(lead.id)}>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.email || "No email"}{lead.company ? ` · ${lead.company}` : ""}</p>
                  </div>
                </Button>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
