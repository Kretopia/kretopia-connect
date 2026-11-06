import type { ReactNode } from "react";
import { Crown, FileDown, FileText, PencilLine, QrCode, Share2 } from "lucide-react";

import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PassportSmartActionsProps {
  onEdit: () => void;
  onShare: () => void;
  onShowQR: () => void;
  onDownloadEPK: () => void;
  /** The direct PDF download of the Passport. The tile is drawn only when the card can do it. */
  pdf?: {
    onDownload: () => void;
    busy?: boolean;
    /** The PDF needs a paid plan: a crown says so, and pressing the tile explains. */
    locked?: boolean;
  };
  className?: string;
}

const tileBase =
  "group h-16 min-h-[64px] w-full min-w-0 flex-col gap-1 rounded-lg px-1 py-2 text-[10px] leading-none border-border bg-card text-foreground hover:border-foreground/40";

function Tile({
  label,
  ariaLabel,
  title,
  onClick,
  disabled,
  children,
}: {
  label: ReactNode;
  ariaLabel: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="min-w-0">
      <Button variant="outline" type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} title={title ?? ariaLabel} className={tileBase}>
        {children}
        <span className="truncate">{label}</span>
      </Button>
    </li>
  );
}

// The icons draw in the text colour (white in Midnight, the foreground in Daylight), all the same: the buttons are one family.
const iconClass = "h-6 w-6";

/**
 * The owner's Passport actions on one line: Edit, Share, QR, the press kit and, when the card can make it, the PDF. The Edit tile
 * says "Edit" and nothing else (it used to carry the Passport's strength as a percentage).
 */
export function PassportSmartActions({ onEdit, onShare, onShowQR, onDownloadEPK, pdf, className }: PassportSmartActionsProps) {
  return (
    <ul aria-label="Passport actions" className={cn("grid gap-2", pdf ? "grid-cols-5" : "grid-cols-4", className)}>
      <Tile label="Edit" ariaLabel="Edit Passport" onClick={onEdit}>
        <PencilLine className={iconClass} aria-hidden />
      </Tile>
      <Tile label="Share" ariaLabel="Share Passport" onClick={onShare}>
        <Share2 className={iconClass} aria-hidden />
      </Tile>
      <Tile label="QR" ariaLabel="Show QR code" onClick={onShowQR}>
        <QrCode className={iconClass} aria-hidden />
      </Tile>
      <Tile label="Press kit" ariaLabel="Download press kit PDF" onClick={onDownloadEPK}>
        <FileText className={iconClass} aria-hidden />
      </Tile>
      {pdf && (
        <Tile
          label="PDF"
          ariaLabel={pdf.busy ? "Generating PDF" : "Download PDF"}
          title={pdf.locked ? "Download PDF (Creator plan)" : undefined}
          onClick={pdf.onDownload}
          disabled={pdf.busy}
        >
          {pdf.busy ? (
            <KretopiaSpinner className={iconClass} />
          ) : (
            <span className="relative inline-flex">
              <FileDown className={iconClass} aria-hidden />
              {pdf.locked && <Crown className="absolute -right-2 -top-1.5 h-3 w-3" aria-hidden />}
            </span>
          )}
        </Tile>
      )}
    </ul>
  );
}

export default PassportSmartActions;
