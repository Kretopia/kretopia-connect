import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Flag, Ban, UserX } from 'lucide-react';
import { ReportBlockDialog } from './ReportBlockDialog';

interface UserActionMenuProps {
  targetUserId: string;
  targetUserName: string;
  onBlocked?: () => void;
  triggerClassName?: string;
}

export function UserActionMenu({
  targetUserId,
  targetUserName,
  onBlocked,
  triggerClassName,
}: UserActionMenuProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={triggerClassName || 'h-8 w-8'}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive focus:text-destructive">
            <Flag className="h-4 w-4 mr-2" />
            Report User
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setBlockOpen(true)} className="text-destructive focus:text-destructive">
            <Ban className="h-4 w-4 mr-2" />
            Block User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportBlockDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetUserId={targetUserId}
        targetUserName={targetUserName}
        mode="report"
        onBlocked={onBlocked}
      />

      <ReportBlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        targetUserId={targetUserId}
        targetUserName={targetUserName}
        mode="block"
        onBlocked={onBlocked}
      />
    </>
  );
}
