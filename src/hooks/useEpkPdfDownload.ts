import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { hasProAccess, type SubscriptionTier } from "@/lib/subscriptionConfig";
import type { EPKPdfInput } from "@/lib/epkPdfGenerator";

/**
 * The direct PDF of a Passport, with the plan check and the messages it always had. One place for it, because two surfaces offer it:
 * the PDF button on the owner's Passport card, and the toolbar the owner gets on the public page (where the card has no controls).
 * The PDF library is loaded only when the download is pressed.
 */
export function useEpkPdfDownload(userId: string | undefined, epkPdfData: unknown) {
  const [generating, setGenerating] = useState(false);
  const { subscriptionInfo } = useAuth();
  const navigate = useNavigate();
  const isPro = hasProAccess((subscriptionInfo?.tier || "free") as SubscriptionTier);

  const download = useCallback(async () => {
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
      // The page assembles the input (profile, credits, awards, press, stats, reviews); the generator reads what it needs from it.
      await generateEPKPdf(epkPdfData as EPKPdfInput);
      const { trackDeckEvent } = await import("@/lib/deckMetrics");
      void trackDeckEvent("epk_pdf_downloaded", "passport", { profile_user_id: userId });
      toast.success("EPK PDF downloaded!");
    } catch (error) {
      console.error("EPK PDF generation error:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [isPro, epkPdfData, navigate, userId]);

  return { download, generating, isPro };
}
