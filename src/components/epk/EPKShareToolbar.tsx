import { Button } from "@/components/ui/button";
import { FileDown, Crown } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useEpkPdfDownload } from "@/hooks/useEpkPdfDownload";

interface EPKShareToolbarProps {
  profileName: string;
  profileRole: string;
  userId: string;
  epkPdfData?: unknown; // EPKPdfInput passed from parent
}

/**
 * The owner's PDF download on a Passport page whose card has no controls of its own (the public page the owner is looking at).
 * On the owner's own Passport the same download is the PDF button on the card, from the same hook.
 */
export const EPKShareToolbar = ({ userId, epkPdfData }: EPKShareToolbarProps) => {
  const { download, generating, isPro } = useEpkPdfDownload(userId, epkPdfData);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4">
      <span className="text-xs font-medium text-muted-foreground">Kretopia · Creative Passport PDF</span>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => void download()} disabled={generating}>
        {generating ? <KretopiaSpinner className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
        {generating ? "Generating…" : "Download PDF"}
        {!isPro && <Crown className="h-3 w-3 text-primary" />}
      </Button>
    </div>
  );
};
