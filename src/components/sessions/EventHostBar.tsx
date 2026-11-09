import { Ban, CheckCircle, Crown, Download, MoreVertical, Pencil, ScanLine, Share2, Sparkles, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface EventHostBarProps {
  isPast: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  onEdit: () => void;
  onEditSections: () => void;
  onCheckIn: () => void;
  onShare: () => void;
  onBackstage: () => void;
  onCohosts: () => void;
  onRecap: () => void;
  onDownloadGuestList: () => void;
  onMarkComplete: () => void;
  onCancelEvent: () => void;
}

/**
 * The host's own tools, right under the event's header and before the page's content. The page draws this for the event's creator only;
 * what each button does is still decided by the server (every write is limited to the creator's own event). The everyday actions are
 * buttons; the rest are one menu away.
 */
export function EventHostBar({
  isPast, isCompleted, isCancelled,
  onEdit, onEditSections, onCheckIn, onShare, onBackstage, onCohosts, onRecap, onDownloadGuestList, onMarkComplete, onCancelEvent,
}: EventHostBarProps) {
  return (
    <section aria-label="Host tools" className="rounded-2xl border border-border bg-card p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h2 className="text-sm font-semibold">Host tools</h2>
          <p className="text-xs text-muted-foreground">Only you see this.</p>
        </div>
        <Button type="button" size="sm" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />Edit event</Button>
        <Button type="button" size="sm" variant="outline" onClick={onEditSections}><LayoutList className="mr-1.5 h-3.5 w-3.5" aria-hidden />Edit page sections</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCheckIn}><ScanLine className="mr-1.5 h-3.5 w-3.5" aria-hidden />Check-in</Button>
        <Button type="button" size="sm" variant="outline" onClick={onShare}><Share2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />Share / QR</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline" aria-label="More host tools"><MoreVertical className="mr-1.5 h-3.5 w-3.5" aria-hidden />More</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onBackstage}><Sparkles className="mr-2 h-4 w-4" />Open Backstage</DropdownMenuItem>
            <DropdownMenuItem onClick={onCohosts}><Crown className="mr-2 h-4 w-4" />Manage Co-hosts</DropdownMenuItem>
            <DropdownMenuItem onClick={onRecap}><Sparkles className="mr-2 h-4 w-4" />Post Update / Recap</DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadGuestList}><Download className="mr-2 h-4 w-4" />Download Guest List</DropdownMenuItem>
            {((!isPast && !isCompleted) || !isCancelled) && <DropdownMenuSeparator />}
            {!isPast && !isCompleted && (
              <DropdownMenuItem onClick={onMarkComplete}><CheckCircle className="mr-2 h-4 w-4" />Mark Complete</DropdownMenuItem>
            )}
            {!isCancelled && (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onCancelEvent}><Ban className="mr-2 h-4 w-4" />Cancel Event</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}

export default EventHostBar;
