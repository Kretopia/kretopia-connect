import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Inbox as InboxIcon, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudioEmptyState, StudioErrorState } from "@/components/studio-reference/StudioEmptyState";
import { moodAccent, monogram, type StudioProject } from "./studioCardHelpers";

interface MessageRow {
  id: string;
  project_id: string;
  user_id: string | null;
  message: string;
  voice_transcript: string | null;
  created_at: string | null;
}

interface StudioInboxTabProps {
  /** Same already-fetched Studio projects list the Work tab renders —
   *  reused to resolve project_id -> title/mood and to scope the query,
   *  no second projects fetch. */
  projects: StudioProject[];
}

/**
 * Inbox — an aggregate view over every Project room's own conversation
 * (project_messages), one row per Project showing its single latest
 * message, most-recently-active Project first. Per the Studio Blueprint's
 * "persistent contextual conversation + aggregate Inbox" concept (R19):
 * this does not introduce a new conversation model or a cross-project
 * DM -- each room's Chat tab (SimpleProjectChat) remains the only place
 * messages are read in full or sent; this is a jump-off list, not a
 * second inbox with its own state.
 *
 * Deliberately NOT reusing the unrelated global /messages (1:1 DMs) or
 * /inbox pages -- those are person-to-person messages, a different table
 * (`messages`) with no project_id at all. Studio's Inbox is scoped to
 * Project-room conversation only.
 */
export const StudioInboxTab = ({ projects }: StudioInboxTabProps) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendersById, setSendersById] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const load = async () => {
    const ids = projects.map((p) => p.id);
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    setError(null);
    setRows(null);

    // One query, most recent N messages across every visible Project,
    // then keep only the latest row per project_id client-side -- avoids
    // an N+1 "last message per project" fan-out.
    const { data, error: err } = await supabase
      .from("project_messages")
      .select("id, project_id, user_id, message, voice_transcript, created_at")
      .in("project_id", ids)
      .order("created_at", { ascending: false })
      .limit(200);

    if (err) {
      setError(err.message || "Couldn't load Inbox");
      return;
    }

    const latestByProject = new Map<string, MessageRow>();
    for (const row of (data as MessageRow[]) || []) {
      if (!latestByProject.has(row.project_id)) latestByProject.set(row.project_id, row);
    }
    const latest = Array.from(latestByProject.values()).sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
    setRows(latest);

    const userIds = [...new Set(latest.map((r) => r.user_id).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      const map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      for (const p of profiles || []) map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      setSendersById(map);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [projects.map((p) => p.id).join(",")]);

  if (error) {
    return <StudioErrorState description={error} onRetry={load} />;
  }

  if (rows === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <StudioEmptyState
        icon={<InboxIcon className="h-6 w-6" />}
        title="No conversations yet"
        description="Once a Project's Chat has a message, it shows up here — most recently active Project first."
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const project = projectById.get(r.project_id);
        const sender = r.user_id ? sendersById[r.user_id] : null;
        const preview = r.message?.trim() || (r.voice_transcript ? r.voice_transcript.trim() : "") || "Voice message";
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => navigate(`/desk/${r.project_id}?tab=messages`)}
            className="w-full flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-card/70"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: moodAccent(project?.mood) }}
            >
              {project ? monogram(project.title) : "·"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {project?.title ?? "Project"}
                </p>
                {r.created_at && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {sender?.full_name ? `${sender.full_name}: ` : ""}
                {!r.message?.trim() && r.voice_transcript && (
                  <Mic className="mr-1 inline h-3 w-3 align-[-1px]" />
                )}
                {preview}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StudioInboxTab;
