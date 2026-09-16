import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Trash2, Plus, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";
import { formatDistanceToNow } from "date-fns";

type Memory = {
  id: string;
  kind: string;
  content: string;
  source: string | null;
  confidence: number;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
};

const KIND_OPTIONS = [
  "fact",
  "preference",
  "relationship",
  "working_style",
  "money",
  "project",
  "goal",
  "dislike",
];

const KIND_COLOR: Record<string, string> = {
  preference: "bg-primary/10 text-primary",
  relationship: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  working_style: "bg-primary/10 text-primary dark:text-primary",
  money: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  project: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  goal: "bg-primary/10 text-primary dark:text-primary",
  dislike: "bg-destructive/10 text-destructive",
  fact: "bg-muted text-muted-foreground",
};

export default function CopilotMemory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState("preference");
  const [newContent, setNewContent] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("copilot_memories")
      .select("id, kind, content, source, confidence, use_count, last_used_at, created_at")
      .eq("user_id", user.id)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Couldn't load memories");
    } else {
      setMemories((data ?? []) as Memory[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const addMemory = async () => {
    if (!user || !newContent.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("embed-copilot-memory", {
        body: { kind: newKind, content: newContent.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.deduped ? "Merged with an existing memory" : "Saved to memory");
      setNewContent("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setAdding(false);
    }
  };

  const deleteMemory = async (id: string) => {
    if (!confirm("Delete this memory? Kreto will forget it.")) return;
    const { error } = await supabase.from("copilot_memories").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete");
    } else {
      setMemories((m) => m.filter((x) => x.id !== id));
      toast.success("Forgotten");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO title="Copilot Memory · Kretopia" description="Manage what Kreto remembers about you." />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <header className="flex items-start gap-3 mb-6">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Copilot Memory</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Things Kreto has learned about you. She uses these to give better,
              more personal answers across the platform. You're in control — edit or delete anything.
            </p>
          </div>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> Teach it something
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Select value={newKind} onValueChange={setNewKind}>
                <SelectTrigger className="col-span-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="col-span-2"
                placeholder="e.g. Prefers morning calls before 11am"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                maxLength={600}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newContent.trim()) addMemory();
                }}
              />
            </div>
            <Button
              onClick={addMemory}
              disabled={!newContent.trim() || adding}
              size="sm"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save memory
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {memories.length} {memories.length === 1 ? "memory" : "memories"}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : memories.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No memories yet. Have a few real conversations with Kreto —
              it'll learn the things that matter and they'll show up here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <Card key={m.id} className="group">
                <CardContent className="p-3 flex items-start gap-3">
                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${KIND_COLOR[m.kind] ?? KIND_COLOR.fact}`}
                  >
                    {m.kind.replace("_", " ")}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{m.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {m.source === "manual" ? "Added by you" : "Learned from chat"}
                      {" · "}
                      Saved {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      {m.use_count > 0 && ` · used ${m.use_count}×`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                    onClick={() => deleteMemory(m.id)}
                    aria-label="Delete memory"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Memory is private to your account. We never share it.
        </p>
      </div>
    </div>
  );
}
