import type { CSSProperties, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useSearchStage } from "./searchStage";

interface SearchOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it (rendered as the dialog trigger). */
  trigger: ReactNode;
  /** Accessible name of the dialog; not drawn. */
  title?: string;
  children: ReactNode;
}

/**
 * The search, opened from the top bar: the field floats in the middle of the screen over a strongly blurred and dimmed page, so
 * the field is the only thing in focus whatever the device. Radix keeps focus inside, closes on Escape or a tap on the blur
 * around it, and locks the page behind. The field sits in the middle of the visible area (see searchStage.ts) and hands the
 * room under it to the results through `--k-search-room`.
 *
 * It is not a sheet: it has no slide, no panel, no background and no corner button of its own, the field brings its own surface.
 */
export function SearchOverlay({ open, onOpenChange, trigger, title = "Search Kretopia", children }: SearchOverlayProps) {
  const stage = useSearchStage(open);
  const style = { top: stage.top, "--k-search-room": `${stage.room}px` } as CSSProperties;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "k-search-scrim fixed inset-0 z-50",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-150",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100",
            "motion-reduce:animate-none",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          data-search-stage={stage.mode}
          style={style}
          className={cn(
            // Centred with auto margins, not a translate: the open animation drives `transform` and would knock a translate off centre.
            "k-search-overlay fixed inset-x-0 z-50 mx-auto w-[min(calc(34rem+2cm),calc(100vw-2rem))]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-150",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-100",
            "motion-reduce:animate-none focus-visible:outline-none",
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
