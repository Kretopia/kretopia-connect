import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FolderKanban, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { moodGradient } from "@/components/project/studio/moodGradient";

interface Stats {
  unreadMessages: number;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string | null;
  updated_at: string;
  mood?: string | null;
  cover_url?: string | null;

  workspace_type?: string | null;
}

/**
 * MorningPulse — Active Studios rail for /.
 *
 * Used to also show a "Morning Brief" line duplicating overdue/due-today/
 * pending-invoice signal that TodayThreeCards' Next Move and Money Signal
 * cards already surface higher up the page -- trimmed to just the one
 * thing here that's genuinely unique: unread-message count (not shown
 * anywhere else on Today) and the Active Studios quick-jump rail.
 */
export const MorningPulse = ({ firstName, greeting }: { firstName: string; greeting: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ unreadMessages: 0 });
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const safe = async <T,>(p: any, fallback: T): Promise<T> => {
        try {
          const r = await p;
          return (r?.data ?? fallback) as T;
        } catch {
          return fallback;
        }
      };

      const [unreadCount, projectsData] = await Promise.all([
        safe<number>(supabase.rpc("get_unread_message_count" as any), 0),
        safe<any[]>(
          (supabase.from("projects") as any)
            .select("id, title, status, updated_at, mood, cover_url, workspace_type")
            .neq("status", "completed")
            .neq("status", "archived")
            .order("updated_at", { ascending: false })
            .limit(3),
          [],
        ),

      ]);

      if (cancelled) return;

      setStats({ unreadMessages: Number(unreadCount) || 0 });
      setProjects(projectsData as ProjectRow[]);
      setLoaded(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!loaded) return null;

  const brief =
    stats.unreadMessages > 0
      ? `${stats.unreadMessages} unread message${stats.unreadMessages === 1 ? "" : "s"}.`
      : projects.length > 0
        ? `Calm morning. ${projects.length} active studio${projects.length === 1 ? "" : "s"} waiting when you are.`
        : "All quiet. A good moment to start something.";

  // If nothing meaningful, render nothing (keeps Home calm for true new users)
  if (stats.unreadMessages === 0 && projects.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5"
    >
      {/* Morning Brief — one calm line, unread messages only (everything else lives in TodayThreeCards above) */}
      <div className="rounded-2xl border border-border/60 bg-card px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--signal-teal))] mb-1">
          {greeting}, {firstName}
        </p>
        <p className="text-sm sm:text-[15px] text-foreground leading-snug">{brief}</p>

        {stats.unreadMessages > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => navigate("/messages")}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent-foreground px-2.5 py-1 text-[11px] font-semibold hover:bg-accent/20 transition-colors"
            >
              <MessageSquare className="h-3 w-3" /> {stats.unreadMessages} unread
            </button>
          </div>
        )}
      </div>

      {/* Active Studios — top 3 */}
      {projects.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
              Active Studios
            </h2>
            <Link
              to="/desk"
              className="text-xs text-[hsl(var(--signal-teal))] font-medium flex items-center gap-1 hover:underline"
            >
              All studios <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex sm:grid sm:grid-cols-3 gap-2.5 overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 scrollbar-hide snap-x snap-mandatory">
            {projects.map((p) => {
              const grad = moodGradient ? moodGradient(p.mood || p.workspace_type || "general") : null;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/desk/${p.id}`)}
                  className="group relative shrink-0 w-[220px] sm:w-auto snap-start rounded-2xl border border-border/60 bg-card hover:border-primary/40 transition-all overflow-hidden text-left"
                >
                  <div
                    className="h-14 w-full"
                    style={{
                      background: grad || "hsl(var(--color-accent) / 0.14)",
                    }}
                  />
                  <div className="p-3">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{p.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                      {p.status || "active"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.section>
  );
};
