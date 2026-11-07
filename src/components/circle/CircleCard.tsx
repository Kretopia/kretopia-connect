import { useState } from "react";
import { Users, MessageSquare, Lock, Crown, DollarSign, Sparkles } from "lucide-react";
import { CardPill, CardShell } from "@/components/cards/CardShell";
import { cn } from "@/lib/utils";

export interface CircleData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  icon_emoji: string;
  cover_url: string | null;
  member_count: number;
  message_count: number;
  created_by: string;
  created_at: string;
  is_active: boolean;
  is_private: boolean;
  is_paid: boolean;
  price_monthly: number;
  currency: string;
  circle_type: string;
  invite_code: string | null;
  rules: string | null;
  welcome_message?: string | null;
  creator_name?: string;
  creator_avatar?: string;
  is_member?: boolean;
  user_role?: string;
}

const isNew = (createdAt: string) => {
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
};

const getActivityLevel = (messageCount: number) => {
  if (messageCount > 200) return { label: "Very Active" };
  if (messageCount > 50) return { label: "Active" };
  return null;
};

// Deterministic gradient seed from id so each Crew gets a stable signature look
const gradientFor = (seed: string) => {
  const gradients = [
    "from-[hsl(var(--signal-pink)/0.55)] via-[hsl(var(--signal-amber)/0.35)] to-[hsl(var(--signal-teal)/0.55)]",
    "from-[hsl(var(--signal-teal)/0.55)] via-[hsl(var(--signal-pink)/0.35)] to-[hsl(var(--signal-amber)/0.55)]",
    "from-[hsl(var(--signal-amber)/0.55)] via-[hsl(var(--signal-teal)/0.35)] to-[hsl(var(--signal-pink)/0.55)]",
    "from-[hsl(var(--signal-pink)/0.6)] to-[hsl(var(--signal-teal)/0.6)]",
    "from-[hsl(var(--signal-teal)/0.6)] to-[hsl(var(--signal-amber)/0.6)]",
    "from-[hsl(var(--signal-amber)/0.6)] to-[hsl(var(--signal-pink)/0.6)]",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return gradients[Math.abs(hash) % gradients.length];
};

/**
 * A Crew, as the shared card: its cover (the picture, or its signature gradient and emoji) with whether it is new, joined or paid and whether it
 * is private, its title, who runs it and how active it is, what it is about, and how many people and messages it has. The whole card opens the
 * Crew; where that goes is the caller's.
 */
export const CircleCard = ({ circle, onClick }: { circle: CircleData; onClick: () => void }) => {
  const activity = getActivityLevel(circle.message_count);
  const crewIsNew = isNew(circle.created_at);
  const gradient = gradientFor(circle.id);
  const [coverFailed, setCoverFailed] = useState(false);
  const showImage = !!circle.cover_url && !coverFailed;
  const emoji = circle.icon_emoji || "👥";
  const messages = circle.message_count > 999 ? `${(circle.message_count / 1000).toFixed(1)}k` : circle.message_count;

  return (
    <CardShell
      testId={`crew-card-${circle.id}`}
      title={circle.title}
      stretch
      open={{ onClick }}
      cover={
        showImage ? (
          <>
            <img src={circle.cover_url!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setCoverFailed(true)} />
            <span aria-hidden className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center rounded-full bg-card text-2xl ring-2 ring-card">{emoji}</span>
          </>
        ) : (
          <div className={cn("relative flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
            <span aria-hidden className="relative text-5xl opacity-90">{emoji}</span>
          </div>
        )
      }
      coverStart={
        <>
          {crewIsNew ? <CardPill tone="origin"><Sparkles className="h-3 w-3" aria-hidden />New</CardPill> : null}
          {circle.is_member ? (
            <CardPill tone="type">Joined</CardPill>
          ) : circle.is_paid ? (
            <CardPill tone="type"><DollarSign className="h-3 w-3" aria-hidden />{circle.price_monthly}/mo</CardPill>
          ) : null}
          {circle.is_private ? <CardPill tone="type"><Lock className="h-3 w-3" aria-hidden />Private</CardPill> : null}
        </>
      }
      meta={[circle.creator_name ? `by ${circle.creator_name}` : null, activity?.label].filter(Boolean).join(" · ") || null}
      description={circle.description}
      tags={[
        <CardPill key="members"><Users className="h-3 w-3" aria-hidden />{circle.member_count}<span className="sr-only"> members</span></CardPill>,
        circle.message_count > 0 ? <CardPill key="messages"><MessageSquare className="h-3 w-3" aria-hidden />{messages}<span className="sr-only"> messages</span></CardPill> : null,
        circle.user_role === "admin" ? <CardPill key="admin"><Crown className="h-3 w-3" aria-hidden />Admin</CardPill> : null,
      ]}
      primary={{ label: circle.is_member ? "Open crew" : "View crew", onClick: () => onClick() }}
    />
  );
};
