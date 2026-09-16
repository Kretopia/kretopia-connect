import { Button } from "@/components/ui/button";
import { Share2, Edit, Download, IdCard, UserPlus, MoreHorizontal, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAccountTone } from "@/hooks/useAccountTone";

interface ProfileActionsProps {
  onShare: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onCreatorCard?: () => void;
  isOwner: boolean;
  /** Show the "Publish as Website" entry — requires Creator+ / paid plan. */
  canPublishSite?: boolean;
  /** When true, show "Edit Website" instead of "Publish as Website". */
  hasPublishedSite?: boolean;
}

/**
 * Consolidated profile action row.
 *
 * Owner sees a single primary action (Edit) + Share, with everything else in
 * an overflow menu so the row never overflows. Labels adapt to the user's
 * account tone — creatives see warm "Edit profile" / "Download EPK", while
 * brand/company accounts see "Edit brand page" / "Download brand one-pager".
 *
 * Paid creator accounts get a "Publish as Website" / "Edit Website" entry
 * in the overflow that routes to the one-click site builder.
 */
export const ProfileActions = ({
  onShare,
  onEdit,
  onDownload,
  onCreatorCard,
  isOwner,
  canPublishSite = false,
  hasPublishedSite = false,
}: ProfileActionsProps) => {
  const navigate = useNavigate();
  const { isBusiness, copy } = useAccountTone();

  const editLabel = isBusiness ? "Edit brand page" : "Edit profile";
  const inviteLabel = isBusiness ? "Invite teammates" : "Invite to your circle";
  const inviteRoute = isBusiness ? "/team" : "/creative-circle";

  if (!isOwner) {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button onClick={onShare} variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
        <Button onClick={onDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {copy.download}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Button onClick={onEdit} size="sm">
        <Edit className="h-4 w-4 mr-2" />
        {editLabel}
      </Button>
      <Button onClick={onShare} variant="outline" size="sm">
        <Share2 className="h-4 w-4 mr-2" />
        Share
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="More profile actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onDownload}>
            <Download className="h-4 w-4 mr-2" />
            {copy.download}
          </DropdownMenuItem>
          {!isBusiness && onCreatorCard && (
            <DropdownMenuItem onClick={onCreatorCard}>
              <IdCard className="h-4 w-4 mr-2" />
              Creator Card
            </DropdownMenuItem>
          )}
          {!isBusiness && (
            <DropdownMenuItem onClick={() => navigate(canPublishSite ? "/website-builder" : "/subscription")}>
              <Globe className="h-4 w-4 mr-2" />
              {hasPublishedSite ? "Edit Website" : canPublishSite ? "Publish as Website" : "Publish as Website (Upgrade)"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate(inviteRoute)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {inviteLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

