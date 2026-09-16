import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { UserPlus, Bookmark, SkipForward, Check, MoreVertical, Flag, Ban, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ReportBlockDialog } from "@/components/user/ReportBlockDialog";

export type RailPeer = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

interface PairRailProps {
  mode: "pair";
  peer: RailPeer;
  icePrompts?: string[];
  iceIdx?: number;
  onCycleIce?: () => void;
  connecting?: boolean;
  connected?: boolean;
  saved?: boolean;
  onConnect: () => void;
  onSave: () => void;
  onSkip: () => void;
}

interface GroupRailProps {
  mode: "group";
  peers: RailPeer[];
  connectedIds: Set<string>;
  savedIds: Set<string>;
  onConnect: (peer: RailPeer) => void;
  onSave: (peer: RailPeer) => void;
}

type Props = PairRailProps | GroupRailProps;

const PeerMenu = ({ peer }: { peer: RailPeer }) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-white hover:bg-white/15"
            aria-label="More actions"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{peer.full_name ?? "Match"}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 mt-3">
            <Button asChild variant="ghost" className="justify-start gap-2 rounded-xl">
              <Link to={`/profile/${peer.id}`} onClick={() => setOpen(false)}>
                <ExternalLink className="h-4 w-4" /> View Creative Passport
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2 rounded-xl text-destructive hover:text-destructive"
              onClick={() => { setOpen(false); setReportOpen(true); }}
            >
              <Flag className="h-4 w-4" /> Report
            </Button>
            <Button
              variant="ghost"
              className="justify-start gap-2 rounded-xl text-destructive hover:text-destructive"
              onClick={() => { setOpen(false); setBlockOpen(true); }}
            >
              <Ban className="h-4 w-4" /> Block & re-match
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <ReportBlockDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetUserId={peer.id}
        targetUserName={peer.full_name ?? "this user"}
        mode="report"
      />
      <ReportBlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        targetUserId={peer.id}
        targetUserName={peer.full_name ?? "this user"}
        mode="block"
      />
    </>
  );
};

export const SpeedActionRail = (props: Props) => {
  if (props.mode === "pair") {
    const { peer, icePrompts = [], iceIdx = 0, onCycleIce, connecting, connected, saved, onConnect, onSave, onSkip } = props;
    return (
      <div className="flex flex-col items-center gap-2 w-full max-w-[380px]">
        {icePrompts.length > 0 && (
          <div className="w-full px-3 py-2 rounded-2xl bg-black/75 border border-white/15 shadow-lg text-white">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wide text-white/60 font-bold">Try this</span>
              <button
                onClick={onCycleIce}
                className="text-[10px] text-white/70 hover:text-[hsl(var(--energy))] transition-colors"
                aria-label="Next prompt"
              >
                Next →
              </button>
            </div>
            <p className="text-[13px] leading-snug">{icePrompts[iceIdx]}</p>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-black/75 border border-white/15 shadow-lg max-w-full">
          <div className="flex items-center gap-1.5 text-white text-xs font-medium pr-1 min-w-0">
            <img
              src={peer.avatar_url ?? "/avatar-silhouette.svg"}
              alt=""
              className="h-5 w-5 rounded-full object-cover shrink-0"
            />
            <span className="truncate max-w-[90px]">{peer.full_name ?? "Match"}</span>
          </div>
          <Button
            size="sm"
            variant="lime"
            className="rounded-full h-7 px-2.5 text-[11px] gap-1"
            onClick={onConnect}
            disabled={connecting || connected}
          >
            {connected ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
            {connected ? "Sent" : "Connect"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full h-7 px-2 text-[11px] gap-1"
            onClick={onSave}
            disabled={saved}
            aria-label="Save"
          >
            {saved ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-7 px-2 text-[11px] gap-1 text-white hover:bg-white/15"
            onClick={onSkip}
            aria-label="Skip to next match"
          >
            <SkipForward className="h-3 w-3" />
          </Button>
          <PeerMenu peer={peer} />
        </div>
      </div>
    );
  }

  // Group mode — horizontal scroll of every participant
  const { peers, connectedIds, savedIds, onConnect, onSave } = props;
  if (!peers.length) return null;
  return (
    <div className="w-full max-w-[min(560px,calc(100vw-24px))]">
      <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-none">
        {peers.map((p) => {
          const isConn = connectedIds.has(p.id);
          const isSaved = savedIds.has(p.id);
          return (
            <div
              key={p.id}
              className="shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl bg-black/75 border border-white/15 shadow-lg text-white min-w-[88px]"
            >
              <img
                src={p.avatar_url ?? "/avatar-silhouette.svg"}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
              <span className="text-[10px] font-medium truncate max-w-[72px]">
                {p.full_name?.split(" ")[0] ?? "Guest"}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="lime"
                  className="h-6 w-6 rounded-full"
                  onClick={() => onConnect(p)}
                  disabled={isConn}
                  aria-label="Connect"
                >
                  {isConn ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-6 w-6 rounded-full"
                  onClick={() => onSave(p)}
                  disabled={isSaved}
                  aria-label="Save"
                >
                  {isSaved ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                </Button>
                <PeerMenu peer={p} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
