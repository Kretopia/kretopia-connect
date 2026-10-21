import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileDown, Crown } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { useNavigate } from "react-router-dom";

interface EPKShareToolbarProps {
  profileName: string;
  profileRole: string;
  userId: string;
  epkPdfData?: any; // EPKPdfInput passed from parent
}

export const EPKShareToolbar = ({ profileName, profileRole, userId, epkPdfData }: EPKShareToolbarProps) => {
  const [generating, setGenerating] = useState(false);
  const { subscriptionInfo } = useAuth();
  const navigate = useNavigate();
  const isPro = hasProAccess((subscriptionInfo?.tier || 'free') as any);

  const handleDownloadPdf = async () => {
    if (!isPro) {
      toast.error("Creator plan required", {
        description: "Upgrade to Creator or Creator+ to download your EPK as a professional PDF deck.",
        action: {
          label: "Upgrade",
          onClick: () => navigate("/subscription"),
        },
      });
      return;
    }

    if (!epkPdfData) {
      toast.error("Profile data not ready. Please try again.");
      return;
    }

    setGenerating(true);
    try {
      const { generateEPKPdf } = await import("@/lib/epkPdfGenerator");
      await generateEPKPdf(epkPdfData);
      const { trackDeckEvent } = await import("@/lib/deckMetrics");
      void trackDeckEvent("epk_pdf_downloaded", "passport", { profile_user_id: userId });
      toast.success("EPK PDF downloaded!");
    } catch (error) {
      console.error("EPK PDF generation error:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4">
      <span className="text-xs font-medium text-muted-foreground">Kretopia · Creative Passport PDF</span>
      <Button size="sm" variant="outline" className="gap-2" onClick={handleDownloadPdf} disabled={generating}>
        {generating ? <KretopiaSpinner className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
        {generating ? "Generating…" : "Download PDF"}
        {!isPro && <Crown className="h-3 w-3 text-primary" />}
      </Button>
    </div>
  );
};
