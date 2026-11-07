import type { ReactNode } from "react";
import { Fingerprint } from "lucide-react";

import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { cn } from "@/lib/utils";
import { DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { DIALOG_EYEBROW, DIALOG_HEADER, DIALOG_TITLE } from "./dialogBrand.tokens";

/**
 * The full branded header of the Passport QR modal: the K mark and the Kretopia name, the title, one line under it, and the fingerprint
 * watermark. It goes inside a `<DialogContent brand className="p-0">`; the QR modal is its first user. A modal opts into it when its
 * content is a card of its own (a code to scan, a receipt, a result); a form or a list keeps its own header and gets the surface only.
 */
export function DialogBrandHeader({ title, description, className }: { title: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <div className={cn(DIALOG_HEADER, className)}>
      <div aria-hidden className="pointer-events-none absolute right-4 top-5 text-energy/15">
        <Fingerprint className="h-28 w-28" strokeWidth={0.7} />
      </div>
      <DialogHeader className="relative text-left">
        <div className="flex items-center gap-2">
          <img src={kMarkAsset.url} alt="" className="h-7 w-7 object-contain" />
          <span className={DIALOG_EYEBROW}>Kretopia</span>
        </div>
        {/* Explicit, not inherited: the header is the brand even where the surrounding modal has not been told to wear it. */}
        <DialogTitle className={cn("pt-4", DIALOG_TITLE)}>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
    </div>
  );
}
