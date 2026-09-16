import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProviderId, ScopeNode } from "@/lib/studioImport";

export interface ScopeState {
  ids: string[];
  date_from: string | null;
  date_to: string | null;
  include_completed: boolean;
  include_archived: boolean;
  include_comments: boolean;
  include_files: boolean;
  include_members: boolean;
  include_private_channels: boolean;
  include_dms: boolean;
  exclude_members: string[];
  row_type?: string;
  column_map?: Record<string, string>;
}

export const emptyScope = (): ScopeState => ({
  ids: [],
  date_from: null,
  date_to: null,
  include_completed: true,
  include_archived: false,
  include_comments: true,
  include_files: true,
  include_members: false,
  include_private_channels: false,
  include_dms: false,
  exclude_members: [],
});

const CSV_ROW_TYPES = [
  { v: "task", l: "Tasks" },
  { v: "milestone", l: "Milestones" },
  { v: "member", l: "Collaborators" },
  { v: "expense", l: "Expenses" },
  { v: "deliverable", l: "Deliverables" },
];

const CSV_FIELDS = [
  "title", "description", "status", "owner", "start_date", "due_date", "amount", "category", "priority", "external_reference",
];

const FIELD_LABELS: Record<string, string> = {
  title: "Title", description: "Description", status: "Status", owner: "Owner",
  start_date: "Start date", due_date: "Due date", amount: "Budget / amount",
  category: "Category", priority: "Priority", external_reference: "External reference",
};

interface Props {
  provider: ProviderId;
  scopes: ScopeNode[];
  value: ScopeState;
  onChange: (s: ScopeState) => void;
}

export const ScopeStep = ({ provider, scopes, value, onChange }: Props) => {
  const [q, setQ] = useState("");
  const set = (patch: Partial<ScopeState>) => onChange({ ...value, ...patch });

  const selectable = useMemo(
    () => scopes.filter((s) => {
      if (provider === "slack_export") {
        if (s.type === "member") return false;
        if (s.type === "private_channel" && !value.include_private_channels) return false;
        if (s.type === "dm" && !value.include_dms) return false;
        return true;
      }
      if (provider === "monday") return s.type === "board";
      if (provider === "notion") return s.type === "page" || s.type === "database";
      return false;
    }).filter((s) => s.name.toLowerCase().includes(q.toLowerCase())),
    [scopes, provider, q, value.include_private_channels, value.include_dms],
  );

  const toggle = (id: string) =>
    set({ ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id] });

  if (provider === "csv") {
    const headers = scopes.map((s) => s.name);
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs">Each row in this file is a…</Label>
          <Select value={value.row_type ?? "task"} onValueChange={(v) => set({ row_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CSV_ROW_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Match your columns</Label>
          <div className="space-y-2">
            {CSV_FIELDS.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{FIELD_LABELS[f]}</span>
                <Select
                  value={value.column_map?.[f] ?? "__none"}
                  onValueChange={(v) =>
                    set({
                      column_map: {
                        ...(value.column_map ?? {}),
                        ...(v === "__none" ? { [f]: "" } : { [f]: v }),
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Not mapped" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Not mapped</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {provider === "slack_export" && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <Row label="Include private channels" hint="Only if you're authorised to." checked={value.include_private_channels} onChange={(v) => set({ include_private_channels: v })} />
          <Row label="Include direct messages" hint="Off by default — DMs are personal." checked={value.include_dms} onChange={(v) => set({ include_dms: v })} />
          <Row label="Bring people across as suggested collaborators" checked={value.include_members} onChange={(v) => set({ include_members: v })} />
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 pl-9" />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border bg-card p-2">
          {selectable.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">Nothing to choose from here yet.</p>
          )}
          {selectable.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
              <Checkbox checked={value.ids.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{s.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {s.type}
                  {s.meta?.days ? ` · ${s.meta.days} days of history` : ""}
                  {s.meta?.members ? ` · ${s.meta.members} members` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {value.ids.length} selected · we never import a whole account automatically.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={value.date_from ?? ""} onChange={(e) => set({ date_from: e.target.value || null })} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={value.date_to ?? ""} onChange={(e) => set({ date_to: e.target.value || null })} className="h-9" />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <Row label="Completed work" checked={value.include_completed} onChange={(v) => set({ include_completed: v })} />
        <Row label="Archived items" checked={value.include_archived} onChange={(v) => set({ include_archived: v })} />
        {provider !== "slack_export" && (
          <Row label="Comments & updates" checked={value.include_comments} onChange={(v) => set({ include_comments: v })} />
        )}
        <Row label="Files & attachments" checked={value.include_files} onChange={(v) => set({ include_files: v })} />
      </div>
    </div>
  );
};

const Row = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="min-w-0">
      <span className="block text-sm">{label}</span>
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);
