import type { ReactNode } from "react";
import { FileDown, PencilLine, QrCode, Share2 } from "lucide-react";

import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PassportSmartActionsProps {
  /** 0 to 100, from the Passport's own strength formula. */
  strength: number;
  onEdit: () => void;
  onShare: () => void;
  onShowQR: () => void;
  onDownloadEPK: () => void;
  className?: string;
}

const GRADIENT_ID = "k-passport-action-gradient";
/** Icons stroke with the Kretopia logo's exact linear gradient (same stops as --k-text-gradient). */
const gradientStroke = `url(#${GRADIENT_ID})`;

function LogoGradientDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--k-g-1)" }} />
          <stop offset="35%" style={{ stopColor: "var(--k-g-2)" }} />
          <stop offset="65%" style={{ stopColor: "var(--k-g-3)" }} />
          <stop offset="100%" style={{ stopColor: "var(--k-g-4)" }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

const tileBase =
  "group h-16 min-h-[64px] w-full min-w-0 flex-col gap-1 rounded-lg px-1 py-2 text-[10px] leading-none border-border bg-card text-foreground hover:border-foreground/40";

function Tile({
  label,
  ariaLabel,
  title,
  onClick,
  className,
  children,
}: {
  label: ReactNode;
  ariaLabel: string;
  title?: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("min-w-0", className)}>
      <Button variant="outline" type="button" onClick={onClick} aria-label={ariaLabel} title={title ?? ariaLabel} className={tileBase}>
        {children}
        <span className="truncate">{label}</span>
      </Button>
    </li>
  );
}

const iconClass = "h-6 w-6";

/**
 * The owner's Passport actions on one line. The K mark and Edit used to be two
 * tiles opening the same editor; they are now one: the K shows the real
 * strength, a gradient pencil badge says pressing it edits the profile.
 */
export function PassportSmartActions({ strength, onEdit, onShare, onShowQR, onDownloadEPK, className }: PassportSmartActionsProps) {
  const pct = Math.max(0, Math.min(100, Math.round(strength)));
  return (
    <>
      <LogoGradientDefs />
      <ul aria-label="Passport actions" className={cn("grid grid-cols-4 gap-2", className)}>
        <Tile
          label={<>Edit <span className="k-gradient-text font-semibold">{pct}%</span></>}
          ariaLabel={`Edit Profile. Passport Strength ${pct}%.`}
          title={`Edit Profile — Passport Strength ${pct}%`}
          onClick={onEdit}
        >
          <span className="relative inline-flex">
            <img src={kMarkAsset.url} alt="" draggable={false} aria-hidden className="h-6 w-6 select-none object-contain" />
            <span className="absolute -bottom-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
              <PencilLine className="h-2.5 w-2.5" stroke={gradientStroke} aria-hidden />
            </span>
          </span>
        </Tile>
        <Tile label="Share" ariaLabel="Share Passport" onClick={onShare}>
          <Share2 className={iconClass} stroke={gradientStroke} aria-hidden />
        </Tile>
        <Tile label="QR" ariaLabel="Show QR code" onClick={onShowQR}>
          <QrCode className={iconClass} stroke={gradientStroke} aria-hidden />
        </Tile>
        <Tile label="Press kit" ariaLabel="Download press kit PDF" onClick={onDownloadEPK}>
          <FileDown className={iconClass} stroke={gradientStroke} aria-hidden />
        </Tile>
      </ul>
    </>
  );
}

export default PassportSmartActions;
