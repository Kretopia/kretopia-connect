import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Link as LinkIcon, Video, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Label shown on the "ring now" option, e.g. "Ring Aaliyah now" or "Ring project members". */
  instantLabel: string;
  instantHint?: string;
  linkLabel?: string;
  linkHint?: string;
  onPickInstant: () => void;
  onPickLink: () => void;
  starting?: boolean;
}

/**
 * Google Meet-style chooser shown when the user taps a call icon.
 * Two clear options: get a shareable link, or ring people right now.
 * Prevents the "dropped into a lonely lobby" surprise.
 */
export const CallStartChooser = ({
  open,
  onOpenChange,
  instantLabel,
  instantHint = "Calls them on the platform straight away.",
  linkLabel = "Get a meeting link to share",
  linkHint = "Start a room with a link you can drop in WhatsApp, email — anywhere.",
  onPickInstant,
  onPickLink,
  starting = false,
}: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 max-h-[85vh]"
      >
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <SheetTitle>Start a video call</SheetTitle>
          <SheetDescription>
            Pick how you want to bring people in.
          </SheetDescription>
        </SheetHeader>
        <div
          className="px-3 pb-5 space-y-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        >
          <button
            type="button"
            onClick={onPickLink}
            disabled={starting}
            className="w-full flex items-start gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
          >
            <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <LinkIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{linkLabel}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {linkHint}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onPickInstant}
            disabled={starting}
            className="w-full flex items-start gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
          >
            <span className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              {starting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{instantLabel}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {instantHint}
              </span>
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
