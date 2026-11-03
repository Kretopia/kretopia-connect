import { ArrowRight, FolderInput } from "lucide-react";
import { KretoScene } from "@/components/brand/KretoScene";
import { CardPill, CardShell } from "@/components/cards/CardShell";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
  title: string;
  coverUrl: string | null;
  /** The project's mood colour: tints the stand-in cover. */
  accent: string;
  monogram: string;
  status: { label: string; tone: string };
  workspaceLabel: string | null;
  /** The client, or the description, or "No client set". */
  client: string;
  nextAction: string;
  progress: number;
  /** Already formatted, or null when the project has no deadline. */
  deadline: string | null;
  /** Only when this person may see money for this project. */
  pay: { label: string; dot: string } | null;
  onOpen: () => void;
  /** Only when there is somewhere to move it to. */
  onMove?: () => void;
}

/**
 * One Studio project, as the project variant of CardShell: the cover (its picture, or Kreto's workspace scene tinted with its mood), where it
 * stands, who it is for, the next thing to do, and three facts at most (progress, deadline, money). The whole card opens the project, and
 * "Move to…" is its one secondary action. Who is on it and when it was last touched are on the project, not on its card.
 */
export function ProjectCard({ title, coverUrl, accent, monogram, status, workspaceLabel, client, nextAction, progress, deadline, pay, onOpen, onMove }: ProjectCardProps) {
  return (
    <CardShell
      title={title}
      stretch
      open={{ onClick: onOpen }}
      cover={
        coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted">
            <KretoScene scene="workspace" size="thumb" className="absolute inset-0 h-full w-full opacity-70" />
            <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}55, transparent 70%)` }} />
            <span className="relative rounded-lg bg-card/85 px-3 py-1 text-2xl font-black tracking-tight" style={{ color: accent }}>{monogram}</span>
          </div>
        )
      }
      coverStart={<CardPill className={cn("backdrop-blur-sm", status.tone)}>{status.label}</CardPill>}
      meta={[workspaceLabel, client].filter(Boolean).join(" · ")}
      description={<><ArrowRight className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-primary" aria-hidden />{nextAction}</>}
      tags={[
        <CardPill key="progress">{progress}% complete</CardPill>,
        deadline ? <CardPill key="deadline">Due {deadline}</CardPill> : null,
        pay ? <CardPill key="pay"><span className={cn("h-1.5 w-1.5 rounded-full", pay.dot)} aria-hidden />{pay.label}</CardPill> : null,
      ]}
      secondary={onMove ? { icon: <FolderInput className="h-4 w-4" aria-hidden />, label: `Move ${title} to a folder`, srText: "Move to…", onClick: onMove } : undefined}
    />
  );
}
