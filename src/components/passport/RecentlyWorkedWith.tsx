import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Person {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * RecentlyWorkedWith — IMDb-style social proof strip.
 * Pulls unique collaborators across this user's most recent credits and shows
 * an avatar stack. Tap a face → that person's Passport.
 *
 * Public-safe: only relies on credits + profiles (already RLS-readable).
 */
export function RecentlyWorkedWith({
  userId,
  limit = 12,
  className,
}: {
  userId: string;
  limit?: number;
  className?: string;
}) {
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: credits } = await supabase
        .from("credits")
        .select("collaborator_user_ids, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40)
        .then((r) => r, () => ({ data: null } as any));

      const ids = new Set<string>();
      (credits || []).forEach((c: any) => {
        (c.collaborator_user_ids || []).forEach((id: string) => {
          if (id && id !== userId) ids.add(id);
        });
      });
      if (ids.size === 0) {
        if (!cancelled) setPeople([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", Array.from(ids).slice(0, limit))
        .then((r) => r, () => ({ data: null } as any));
      if (!cancelled) setPeople((profs as Person[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  if (!people || people.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-border bg-card px-3 py-3", className)}>
      <div className="flex items-center gap-1.5 mb-2">
        <Users className="h-3.5 w-3.5 text-[hsl(var(--signal-teal))]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Recently worked with
        </span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {people.map((p) => (
          <button
            key={p.user_id}
            type="button"
            onClick={() => navigate(`/profile/${p.user_id}`)}
            className="flex flex-col items-center gap-1 shrink-0 w-14 group"
          >
            <Avatar className="h-11 w-11 ring-1 ring-border group-hover:ring-[hsl(var(--signal-teal))] transition-colors">
              <AvatarImage src={p.avatar_url || undefined} alt={p.full_name || "Collaborator"} />
              <AvatarFallback className="text-[10px]">
                {(p.full_name || "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-foreground/80 truncate w-full text-center leading-tight">
              {(p.full_name || "Creator").split(" ")[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default RecentlyWorkedWith;
