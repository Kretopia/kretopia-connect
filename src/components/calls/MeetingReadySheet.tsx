import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2, Video, Clock, Users, Calendar, Apple } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  buildGoogleCalendarUrl,
  downloadIcs,
  type CalendarEventInput,
} from "@/lib/calendarLinks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shareUrl: string | null;
  /** Called when the user taps "Join now". Should open the call lobby. */
  onJoin: () => void;
  /** Optional — renders a "From contacts" button that calls this. */
  onInviteContacts?: () => void;
  title?: string;
  /** Hint shown under the title, e.g. "Link works for 4 hours." */
  hint?: string;
  joinLabel?: string;
  /**
   * Optional — when provided, renders Add to Google / Apple Calendar buttons.
   * Pass for scheduled meetings. The shareUrl is auto-injected as the location
   * if not already set.
   */
  calendarEvent?: Omit<CalendarEventInput, "location"> & { location?: string };
}

/**
 * Mobile-first "your room is ready" sheet.
 * Shows the shareable link FIRST so the host can copy / send before joining.
 * Replaces the old pattern of stacking a share Dialog behind the live call sheet.
 */
export const MeetingReadySheet = ({
  open,
  onOpenChange,
  shareUrl,
  onJoin,
  onInviteContacts,
  title = "Your call is ready",
  hint = "Share this link — guests can join without an account. Link works for 4 hours.",
  joinLabel = "Join now",
  calendarEvent,
}: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Long-press the link to select it.",
        variant: "destructive",
      });
    }
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Kretopia call",
          text: "Tap to join — no signup needed:",
          url: shareUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      void copy();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 max-h-[90vh] sm:max-w-md sm:mx-auto"
      >
        <SheetHeader className="px-5 pt-5 pb-2 text-left">
          <SheetTitle className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <Video className="h-4 w-4" />
            </span>
            {title}
          </SheetTitle>
          <SheetDescription>{hint}</SheetDescription>
        </SheetHeader>

        <div
          className="px-5 pb-5 pt-3 space-y-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        >
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareUrl ?? "Generating link…"}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="font-mono text-xs h-11"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={copy}
              disabled={!shareUrl}
              aria-label="Copy link"
              className="h-11 w-11 shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Link works for 4 hours.
          </div>

          {onInviteContacts && (
            <Button
              type="button"
              variant="outline"
              onClick={onInviteContacts}
              className="w-full h-12 gap-2 rounded-full"
            >
              <Users className="h-4 w-4" />
              Invite from contacts
            </Button>
          )}

          {calendarEvent && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Add to your calendar
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="h-12 gap-2"
                >
                  <a
                    href={buildGoogleCalendarUrl({
                      ...calendarEvent,
                      location: calendarEvent.location ?? shareUrl ?? undefined,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Calendar className="h-4 w-4" />
                    Google
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadIcs(
                      {
                        ...calendarEvent,
                        location: calendarEvent.location ?? shareUrl ?? undefined,
                      },
                      `${calendarEvent.title.replace(/[^\w-]+/g, "_")}.ics`,
                    )
                  }
                  className="h-12 gap-2"
                >
                  <Apple className="h-4 w-4" />
                  Apple / .ics
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Apple Calendar, Outlook & Yahoo all open the .ics file.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={nativeShare}
              disabled={!shareUrl}
              className="h-12 gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button
              type="button"
              onClick={onJoin}
              disabled={!shareUrl}
              className="h-12 gap-2"
              variant="hero"
            >
              <Video className="h-4 w-4" />
              {joinLabel}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
