import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Image as ImageIcon, Film, Pin, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  circleId: string;
}

interface LibraryItem {
  id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  is_pinned: boolean;
  media_url: string;
  media_type: string | null;
  author?: { full_name: string | null; avatar_url: string | null };
}

const iconFor = (type: string | null) => {
  if (!type) return FileText;
  if (type.startsWith("image")) return ImageIcon;
  if (type.startsWith("video")) return Film;
  return FileText;
};

export const CircleLibraryTab = ({ circleId }: Props) => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("spark_room_messages")
        .select("id, user_id, content, created_at, is_pinned, media_url, media_type")
        .eq("room_id", circleId)
        .not("media_url", "is", null)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data || []) as LibraryItem[];
      const ids = Array.from(new Set(rows.map(r => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", ids);
        const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
        rows.forEach(r => { r.author = map.get(r.user_id) as any; });
      }
      setItems(rows);
    } catch (e) {
      console.error("library load", e);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => { load().catch(() => null); }, [load]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const pinned = items.filter(i => i.is_pinned);
  const rest = items.filter(i => !i.is_pinned);

  if (!items.length) {
    return (
      <div className="text-center py-12 px-6 text-sm text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p>No files shared yet.</p>
        <p className="text-xs mt-1">Files shared in the Room appear here automatically.</p>
      </div>
    );
  }

  const renderItem = (i: LibraryItem) => {
    const Icon = iconFor(i.media_type);
    const isImage = i.media_type?.startsWith("image");
    return (
      <a
        key={i.id}
        href={i.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors"
      >
        {isImage ? (
          <img src={i.media_url} alt="" className="w-full aspect-square object-cover" loading="lazy" />
        ) : (
          <div className="aspect-square flex items-center justify-center bg-muted">
            <Icon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="p-2">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {i.is_pinned && <Pin className="h-2.5 w-2.5 text-primary" />}
            <span className="truncate">{i.author?.full_name || "Member"}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</div>
        </div>
      </a>
    );
  };

  return (
    <div className="px-4 space-y-4">
      {pinned.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
            <Pin className="h-3 w-3" /> Pinned
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{pinned.map(renderItem)}</div>
        </section>
      )}
      {rest.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">All files</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{rest.map(renderItem)}</div>
        </section>
      )}
    </div>
  );
};
