import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pin, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PadPin {
  id: string;
  kind: "sticky" | "image" | "link";
  content: string | null;
  image_url: string | null;
  color: string;
  generated_by_ai: boolean;
  created_at: string;
}

const COLOR_BG: Record<string, string> = {
  yellow: "bg-[hsl(48_95%_70%)] text-[hsl(30_50%_20%)]",
  pink: "bg-[hsl(340_85%_82%)] text-[hsl(340_55%_25%)]",
  mint: "bg-[hsl(150_60%_75%)] text-[hsl(160_50%_20%)]",
  sky: "bg-[hsl(200_85%_78%)] text-[hsl(210_60%_22%)]",
  lavender: "bg-[hsl(265_75%_82%)] text-[hsl(265_50%_25%)]",
  peach: "bg-[hsl(20_90%_78%)] text-[hsl(15_55%_22%)]",
};

interface PadPreviewSectionProps {
  projectId: string;
  onOpen: () => void;
}

/**
 * Inline preview of the Cork Board (Pad). Hidden when no pins exist
 * to keep the Studio Room clean for new projects.
 */
export function PadPreviewSection({ projectId, onOpen }: PadPreviewSectionProps) {
  const [pins, setPins] = useState<PadPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, count } = await supabase
        .from("project_pins")
        .select("id, kind, content, image_url, color, generated_by_ai, created_at", {
          count: "exact",
        })
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (!active) return;
      setPins((data || []) as PadPin[]);
      setTotal(count ?? (data?.length ?? 0));
      setLoading(false);
    })().catch((e) => console.warn("[pad-preview] load failed", e));

    const channel = supabase
      .channel(`pad-preview:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_pins",
          filter: `project_id=eq.${projectId}`,
        },
        async () => {
          const { data, count } = await supabase
            .from("project_pins")
            .select(
              "id, kind, content, image_url, color, generated_by_ai, created_at",
              { count: "exact" },
            )
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(3);
          setPins((data || []) as PadPin[]);
          setTotal(count ?? (data?.length ?? 0));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Hide entirely when empty (per UX decision)
  if (loading || pins.length === 0) return null;

  return (
    <section className="px-4 py-4">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left group"
        aria-label="Open the Pad"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-sm font-bold">The Pad</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {total} pin{total === 1 ? "" : "s"}
            </span>
          </div>
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-primary group-hover:underline">
            Open
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
          {pins.map((pin) => (
            <div
              key={pin.id}
              className="shrink-0 w-32 h-32 relative"
              style={{ transform: `rotate(${(pin.id.charCodeAt(0) % 5) - 2}deg)` }}
            >
              {pin.kind === "image" && pin.image_url ? (
                <div className="w-full h-full bg-card p-1.5 shadow-md ring-1 ring-border rounded-sm relative">
                  <img
                    src={pin.image_url}
                    alt={pin.content || "pinned"}
                    className="w-full h-full object-cover rounded-sm"
                    draggable={false}
                  />
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-[hsl(0_75%_55%)] ring-2 ring-[hsl(0_60%_35%)] shadow-sm" />
                </div>
              ) : (
                <div
                  className={cn(
                    "w-full h-full p-2 shadow-md rounded-sm relative flex items-start",
                    COLOR_BG[pin.color] || COLOR_BG.yellow,
                  )}
                >
                  {pin.generated_by_ai && (
                    <Sparkles className="absolute top-1 right-1 h-2.5 w-2.5 opacity-60" />
                  )}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-[hsl(0_75%_55%)] ring-2 ring-[hsl(0_60%_35%)] shadow-sm" />
                  <p className="text-[11px] font-semibold leading-snug line-clamp-5">
                    {pin.content || "Empty note"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </button>
    </section>
  );
}
