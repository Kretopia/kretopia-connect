import { useEffect, useState } from "react";
import { History, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RecentIntent {
  id: string;
  prompt: string;
  intent: string;
  created_at: string;
}

interface Props {
  onPick: (prompt: string) => void;
  className?: string;
}

const INTENT_LABEL: Record<string, string> = {
  create_workspace: "Workspace",
  find_people: "Match",
  find_gigs: "Gigs",
  outreach: "Outreach",
  profile_epk: "EPK",
  summarize: "Summary",
  chat: "Chat",
};

/**
 * Recent Intents drawer — last 5 things the user asked Thrive to do.
 * Tap to re-run. Sits right under ThrivePromptHero.
 */
export function RecentIntentsDrawer({ onPick, className = "" }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<RecentIntent[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("thrive_intent_logs")
          .select("id, prompt, intent, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8);
        // Dedupe by prompt (keep newest)
        const seen = new Set<string>();
        const unique: RecentIntent[] = [];
        for (const row of (data as RecentIntent[]) || []) {
          const key = row.prompt.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(row);
          if (unique.length >= 5) break;
        }
        setItems(unique);
      } catch (e) {
        console.error("[RecentIntentsDrawer]", e);
      }
    })().catch(() => {});
  }, [user]);

  if (!items.length) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <History className="h-3 w-3 text-muted-foreground" />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Recent with Thrive
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onPick(it.prompt)}
            className="group shrink-0 max-w-[260px] text-left rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:bg-primary/[0.03] transition-colors px-3 py-2"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
                {INTENT_LABEL[it.intent] || it.intent}
              </span>
              <ArrowUpRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs text-foreground/90 truncate">{it.prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
