import type { ReactNode } from "react";
import { FileDown, PencilLine, QrCode, Share2 } from "lucide-react";

import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { cn } from "@/lib/utils";

interface PassportSmartActionsProps {
  /** 0 to 100, from the Passport's own strength formula. */
  strength: number;
  onEdit: () => void;
  onShare: () => void;
  onShowQR: () => void;
  onDownloadEPK: () => void;
  className?: string;
}

const tileBase =
  "group flex min-h-[64px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-[10px] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--energy)/0.6)] focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const tileTone = {
  primary: "border-transparent bg-primary text-primary-foreground hover:opacity-90",
  quiet: "border-border bg-card text-foreground hover:border-foreground/40",
} as const;

function Tile({
  label,
  ariaLabel,
  title,
  tone = "quiet",
  onClick,
  children,
}: {
  label: string;
  ariaLabel: string;
  title?: string;
  tone?: keyof typeof tileTone;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <li className="min-w-0">
      <button type="button" onClick={onClick} aria-label={ariaLabel} title={title ?? ariaLabel} className={cn(tileBase, tileTone[tone])}>
        {children}
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

/** A ring that fills with the Passport's strength, with Kretopia's K at its centre. */
function StrengthRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 12;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex h-8 w-8 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="stroke-[hsl(var(--energy))] transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <img src={kMarkAsset.url} alt="" draggable={false} className="relative h-3.5 w-3.5 select-none object-contain" />
    </span>
  );
}

/**
 * The owner's Passport actions on one line: how strong it is, edit it, share it,
 * its QR code and its press kit. Each is an icon with a one-word label under
 * it, a 64 px tall target, and the same name a screen reader had before.
 *
 * Strength is not decoration: the ring is the Passport's real strength and
 * pressing it opens the editor, which is the only way to raise it.
 */
export function PassportSmartActions({ strength, onEdit, onShare, onShowQR, onDownloadEPK, className }: PassportSmartActionsProps) {
  const pct = Math.max(0, Math.min(100, Math.round(strength)));
  return (
    <ul aria-label="Passport actions" className={cn("grid grid-cols-5 gap-2", className)}>
      <Tile
        label={`${pct}%`}
        ariaLabel={`Passport Strength ${pct}%. Edit your profile to raise it.`}
        title={`Passport Strength — ${pct}%`}
        onClick={onEdit}
      >
        <StrengthRing value={pct} />
      </Tile>
      <Tile label="Edit" ariaLabel="Edit Profile" tone="primary" onClick={onEdit}>
        <PencilLine className="h-5 w-5" aria-hidden />
      </Tile>
      <Tile label="Share" ariaLabel="Share Passport" onClick={onShare}>
        <Share2 className="h-5 w-5" aria-hidden />
      </Tile>
      <Tile label="QR" ariaLabel="Show QR code" onClick={onShowQR}>
        <QrCode className="h-5 w-5" aria-hidden />
      </Tile>
      <Tile label="Press kit" ariaLabel="Download press kit PDF" onClick={onDownloadEPK}>
        <FileDown className="h-5 w-5" aria-hidden />
      </Tile>
    </ul>
  );
}

export default PassportSmartActions;
