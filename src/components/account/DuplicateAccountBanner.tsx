import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { X, UserCog } from "lucide-react";
import {
  useDuplicateAccountCandidates,
  dismissDuplicateCandidate,
  type DuplicateCandidate,
} from "@/hooks/useDuplicateAccounts";
import { MergeAccountsDialog } from "./MergeAccountsDialog";

/**
 * Banner shown on Home when we detect a likely-duplicate account for the user.
 * Tap "Yes, merge" → opens the secure merge dialog with dual OTP.
 */
export const DuplicateAccountBanner = () => {
  const { data: candidates, refetch } = useDuplicateAccountCandidates();
  const [active, setActive] = useState<DuplicateCandidate | null>(null);
  const [open, setOpen] = useState(false);

  const top = candidates?.[0];
  if (!top) return null;

  return (
    <>
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={top.avatar_url ?? undefined} />
          <AvatarFallback>
            {(top.full_name?.trim()?.[0] || "?").toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">Looks like you, twice</p>
          <p className="text-xs text-muted-foreground truncate">
            {(top.full_name || "").split(/\s+/)[0] || "This account"} · {top.masked_email}
          </p>
          <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">
            We'll send a code to both inboxes before combining anything.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => {
                setActive(top);
                setOpen(true);
              }}
              className="h-8"
            >
              <UserCog className="h-3.5 w-3.5 mr-1" />
              Yes, that's me
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => {
                dismissDuplicateCandidate(top.candidate_user_id);
                refetch();
              }}
            >
              Not me
            </Button>
          </div>
        </div>
        <button
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            dismissDuplicateCandidate(top.candidate_user_id);
            refetch();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <MergeAccountsDialog
        open={open}
        onOpenChange={setOpen}
        candidate={active}
        onMerged={() => refetch()}
      />
    </>
  );
};
