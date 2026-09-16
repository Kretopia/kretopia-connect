import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Lock, Crown, DollarSign, TrendingUp, Sparkles } from "lucide-react";
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
  if (messageCount > 200) return { label: "Very Active", color: "text-orange-500" };
  if (messageCount > 50) return { label: "Active", color: "text-emerald-500" };
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

export const CircleCard = ({ circle, onClick }: { circle: CircleData; onClick: () => void }) => {
  const activity = getActivityLevel(circle.message_count);
  const crewIsNew = isNew(circle.created_at);
  const gradient = gradientFor(circle.id);
  const [coverFailed, setCoverFailed] = useState(false);
  const showImage = !!circle.cover_url && !coverFailed;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:border-primary/40 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5"
      onClick={onClick}
    >
      {/* Cover (image or signature gradient) */}
      <div className="relative h-32 w-full overflow-hidden">
        {showImage ? (
          <img
            src={circle.cover_url!}
            alt=""
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br", gradient)}>
            {/* Subtle grain overlay via radial */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
            <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-90 drop-shadow-md">
              {circle.icon_emoji || "👥"}
            </div>
          </div>
        )}
        {/* Bottom fade for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/70 to-transparent" />

        {/* Top-right pill chips */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {crewIsNew && (
            <Badge className="text-[9px] px-1.5 py-0 bg-primary text-primary-foreground gap-0.5 backdrop-blur-sm">
              <Sparkles className="h-2.5 w-2.5" /> New
            </Badge>
          )}
          {circle.is_member ? (
            <Badge className="text-[10px] px-2 py-0.5 bg-primary/90 text-primary-foreground border-0">Joined</Badge>
          ) : circle.is_paid ? (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-amber-400/60 text-amber-100 bg-amber-500/30 backdrop-blur-sm">
              <DollarSign className="h-2.5 w-2.5 mr-0.5" />{circle.price_monthly}/mo
            </Badge>
          ) : null}
        </div>

        {/* Top-left privacy */}
        {circle.is_private && (
          <div className="absolute top-2.5 left-2.5 rounded-full bg-black/40 backdrop-blur-sm p-1 z-10">
            <Lock className="h-3 w-3 text-white" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-4 -mt-8 relative">
        <div className="flex items-end gap-3 mb-2">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-card border-2 border-card shadow-lg flex items-center justify-center text-2xl">
              {circle.icon_emoji || "👥"}
            </div>
            {activity && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card">
                <div className="w-full h-full rounded-full bg-emerald-500 animate-ping opacity-75" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h3 className="font-bold text-base leading-tight truncate">{circle.title}</h3>
            {circle.creator_name && (
              <p className="text-[11px] text-muted-foreground truncate">by {circle.creator_name}</p>
            )}
          </div>
        </div>

        {circle.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{circle.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {circle.member_count}
          </span>
          {circle.message_count > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> {circle.message_count > 999 ? `${(circle.message_count / 1000).toFixed(1)}k` : circle.message_count}
            </span>
          )}
          {circle.user_role === "admin" && (
            <span className="flex items-center gap-1 text-amber-600">
              <Crown className="h-3 w-3" /> Admin
            </span>
          )}
          {activity && (
            <span className={cn("flex items-center gap-1 ml-auto font-medium", activity.color)}>
              <TrendingUp className="h-3 w-3" /> {activity.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
