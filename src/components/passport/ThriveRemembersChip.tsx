import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkle } from "lucide-react";

interface MemoryRow {
  id: string;
  kind: string;
  label: string | null;
  body: string | null;
  importance: number | null;
}

const KIND_LABEL: Record<string, string> = {
  rate: "Rates",
  client: "Clients",
  vendor: "Vendors",
  contact: "Contacts",
  preference: "How you work",
  fact: "Notes",
};

/**
 * ThriveRemembersChip — quiet trust signal on the owner's Passport.
 * Shows a small chip with the count of facts Thrive holds about the user;
 * tap opens a sheet listing them grouped by kind.
 *
 * Copy is intentionally restrained — no "AI", no "memory engine". Just
 * "Thrive remembers". The intelligence stays backstage.
 */
export function ThriveRemembersChip() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { count } = await supabase
          .from("thrive_memory")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        setCount(count || 0);
      } catch {
        setCount(0);
      }
    })();
  }, [user?.id]);

  const loadRows = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("thrive_memory")
        .select("id, kind, label, body, importance")
        .eq("user_id", user.id)
        .order("importance", { ascending: false })
        .limit(80);
      setRows((data as MemoryRow[]) || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  if (count === 0) return null;

  const grouped = rows.reduce<Record<string, MemoryRow[]>>((acc, r) => {
    const k = r.kind || "fact";
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (rows.length === 0) loadRows();
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-foreground/[0.04] transition-colors"
      >
        <Sparkle className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
        Kreto remembers <span className="font-semibold text-foreground">{count}</span> {count === 1 ? "thing" : "things"} about you
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkle className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
              What Kreto remembers
            </SheetTitle>
            <SheetDescription>
              The notes, rates, clients and vendors Thrive keeps on hand so you never have to re-explain yourself.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-5 pb-8">
            {loading && <div className="text-sm text-muted-foreground">Pulling your notes…</div>}
            {!loading && rows.length === 0 && (
              <div className="text-sm text-muted-foreground">Nothing yet. Drop a brief or chat with Thrive — it'll start remembering the important bits.</div>
            )}
            {Object.entries(grouped).map(([kind, items]) => (
              <div key={kind}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {KIND_LABEL[kind] || kind}
                  </h3>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{items.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {items.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border bg-card p-2.5">
                      {r.label && <div className="text-sm font-medium leading-tight">{r.label}</div>}
                      {r.body && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{r.body}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default ThriveRemembersChip;
