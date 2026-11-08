import type { ReactNode } from "react";
import { Calendar, MapPin, Users } from "lucide-react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { KretoScene } from "@/components/brand/KretoScene";
import { CardPill, CardShell, type CardAction, type CardIconAction, type CardTarget } from "@/components/cards/CardShell";

export interface EventCardProps {
  testId?: string;
  title: string;
  coverUrl: string | null;
  /** "Sound Stage", "Showcase": what kind of event it is, on the cover. */
  kindLabel: string;
  kindIcon: ReactNode;
  /** Said in words on the cover, never by colour alone. */
  live: boolean;
  host?: { name: string | null; avatarUrl: string | null } | null;
  /** Already worded: "Live now", "In 3 hours", "Fri, Nov 6 · 7:00PM". */
  when: string;
  /** "12/40", or "12" when there is no limit; null when nobody counts. */
  attendance?: string | null;
  /** One short thing worth knowing ("Only 3 spots left"). */
  note?: string | null;
  /** More labels on the cover after the kind and live: a ticket price. */
  coverExtra?: ReactNode;
  /** Where it is, and how far: one more fact after when and how many. */
  venue?: ReactNode;
  open: CardTarget;
  /** Absent when there is nothing to do (an event that has ended, or one the viewer hosts). */
  primary?: CardAction;
  /** One icon action beside the primary (share). */
  secondary?: CardIconAction;
}

/**
 * An event, as the event variant of CardShell: a Stage on the grid. The cover (its picture, or Kreto's Sound Stages scene) with the kind of
 * event, whether it is live, and who hosts it; the title; the host as the one meta line; when and how many as the facts; and one action. The
 * whole card opens the event.
 */
export function EventCard({ testId, title, coverUrl, kindLabel, kindIcon, live, host, when, attendance, note, coverExtra, venue, open, primary, secondary }: EventCardProps) {
  return (
    <CardShell
      testId={testId}
      title={title}
      stretch
      open={open}
      cover={
        <>
          {coverUrl ? <img src={coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <KretoScene scene="soundstages" size="thumb" className="h-full w-full" />}
          {host?.avatarUrl ? (
            <Avatar className="absolute bottom-3 left-3 h-9 w-9 ring-2 ring-card">
              <AvatarImage src={host.avatarUrl} alt="" />
            </Avatar>
          ) : null}
        </>
      }
      coverStart={
        <>
          <CardPill tone="type">{kindIcon}{kindLabel}</CardPill>
          {live ? <CardPill className="border-transparent bg-destructive text-destructive-foreground uppercase motion-safe:animate-pulse"><span aria-hidden>●</span>Live</CardPill> : null}
          {coverExtra}
        </>
      }
      meta={host?.name ? `Host: ${host.name}` : null}
      description={note}
      tags={[
        <CardPill key="when"><Calendar className="h-3 w-3" aria-hidden />{when}</CardPill>,
        attendance ? <CardPill key="attendance"><Users className="h-3 w-3" aria-hidden />{attendance}</CardPill> : null,
        venue ? <CardPill key="venue" className="max-w-full"><MapPin className="h-3 w-3 shrink-0" aria-hidden /><span className="min-w-0 truncate">{venue}</span></CardPill> : null,
      ]}
      primary={primary}
      secondary={secondary}
    />
  );
}
