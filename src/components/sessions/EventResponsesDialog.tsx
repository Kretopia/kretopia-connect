import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Download, FileQuestion, Mail, Search, User as UserIcon } from "lucide-react";

interface Question {
  id: string;
  question: string;
  question_type: string;
  required: boolean;
  position: number;
  options: any;
}

interface AnswerRow {
  id: string;
  question_id: string;
  user_id: string | null;
  guest_email: string | null;
  answer: any;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
}

/**
 * Host-only — shows every RSVP custom-question response, grouped by
 * question, with the responder's name/avatar (or guest email) attached.
 * RLS already restricts SELECT on event_rsvp_answers to the event host.
 */
export function EventResponsesDialog({ open, onOpenChange, eventId, eventTitle }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: qs, error: qErr }, { data: ans, error: aErr }] = await Promise.all([
          supabase
            .from("event_rsvp_questions")
            .select("id, question, question_type, required, position, options")
            .eq("event_id", eventId)
            .order("position", { ascending: true }),
          supabase
            .from("event_rsvp_answers")
            .select("id, question_id, user_id, guest_email, answer, created_at")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false }),
        ]);
        if (qErr) throw qErr;
        if (aErr) throw aErr;
        if (!alive) return;
        setQuestions((qs ?? []) as Question[]);
        setAnswers((ans ?? []) as AnswerRow[]);

        const userIds = Array.from(
          new Set((ans ?? []).map((r: any) => r.user_id).filter(Boolean)),
        ) as string[];
        if (userIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, username, avatar_url")
            .in("user_id", userIds);
          if (!alive) return;
          const map: Record<string, ProfileLite> = {};
          (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
          setProfiles(map);
        } else {
          setProfiles({});
        }
      } catch (e: any) {
        toast({
          title: "Couldn't load responses",
          description: e?.message ?? "Try again.",
          variant: "destructive",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, eventId, toast]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byQ = new Map<string, AnswerRow[]>();
    questions.forEach((qq) => byQ.set(qq.id, []));
    for (const a of answers) {
      if (q) {
        const text = formatAnswer(a.answer).toLowerCase();
        const prof = a.user_id ? profiles[a.user_id] : undefined;
        const name = (prof?.full_name ?? prof?.username ?? a.guest_email ?? "").toLowerCase();
        if (!text.includes(q) && !name.includes(q)) continue;
      }
      const arr = byQ.get(a.question_id);
      if (arr) arr.push(a);
    }
    return byQ;
  }, [answers, questions, profiles, query]);

  const totalResponders = useMemo(() => {
    const keys = new Set<string>();
    for (const a of answers) keys.add(a.user_id ?? `g:${a.guest_email ?? a.id}`);
    return keys.size;
  }, [answers]);

  const exportCsv = () => {
    if (!questions.length) return;
    const header = ["Responder", "Email", "Submitted", ...questions.map((q) => q.question)];
    // Group answers by responder
    const byResponder = new Map<string, { name: string; email: string; submitted: string; vals: Record<string, string> }>();
    for (const a of answers) {
      const key = a.user_id ?? `g:${a.guest_email ?? a.id}`;
      const prof = a.user_id ? profiles[a.user_id] : undefined;
      const name = prof?.full_name ?? prof?.username ?? (a.guest_email ? a.guest_email.split("@")[0] : "Guest");
      const email = a.guest_email ?? "";
      const existing = byResponder.get(key) ?? { name, email, submitted: a.created_at, vals: {} };
      existing.vals[a.question_id] = formatAnswer(a.answer);
      byResponder.set(key, existing);
    }
    const rows = Array.from(byResponder.values()).map((r) => [
      r.name,
      r.email,
      r.submitted,
      ...questions.map((q) => r.vals[q.id] ?? ""),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-primary" /> Guest responses
          </DialogTitle>
          <DialogDescription>
            {eventTitle} · {totalResponders} {totalResponders === 1 ? "responder" : "responders"} across {questions.length} {questions.length === 1 ? "question" : "questions"}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, email, or answer text…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={loading || !questions.length}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
        </div>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="px-6 py-4 space-y-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12">
                <FileQuestion className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-semibold mb-1">No RSVP questions yet</p>
                <p className="text-xs text-muted-foreground">
                  Add questions from Host tools → Q&amp;A so guests can tell you more when they RSVP.
                </p>
              </div>
            ) : (
              questions.map((q) => {
                const list = grouped.get(q.id) ?? [];
                return (
                  <section key={q.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-snug">{q.question}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                            {q.question_type.replace("_", " ")}
                          </Badge>
                          {q.required && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Required</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {list.length} {list.length === 1 ? "answer" : "answers"}
                      </Badge>
                    </div>

                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-1">
                        {query ? "No answers match your filter." : "No one's answered this yet."}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {list.map((a) => {
                          const prof = a.user_id ? profiles[a.user_id] : undefined;
                          const name = prof?.full_name ?? prof?.username ?? (a.guest_email ? a.guest_email.split("@")[0] : "Guest");
                          const initial = name.slice(0, 1).toUpperCase();
                          const profileHref = prof
                            ? prof.username ? `/u/${prof.username}` : `/profile/${prof.user_id}`
                            : null;
                          return (
                            <li
                              key={a.id}
                              className="flex gap-3 rounded-lg border border-border/60 bg-card p-3"
                            >
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={prof?.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[11px]">{initial}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {profileHref ? (
                                    <Link
                                      to={profileHref}
                                      className="text-sm font-semibold hover:underline truncate"
                                    >
                                      {name}
                                    </Link>
                                  ) : (
                                    <span className="text-sm font-semibold truncate inline-flex items-center gap-1">
                                      <UserIcon className="h-3 w-3 text-muted-foreground" />
                                      {name}
                                    </span>
                                  )}
                                  {!prof && a.guest_email && (
                                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                      <Mail className="h-3 w-3" /> {a.guest_email}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground ml-auto">
                                    {format(new Date(a.created_at), "MMM d, h:mm a")}
                                  </span>
                                </div>
                                <p className="text-sm mt-1 whitespace-pre-wrap break-words text-foreground/90">
                                  {formatAnswer(a.answer) || <span className="italic text-muted-foreground">(empty)</span>}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function formatAnswer(answer: any): string {
  if (answer == null) return "";
  if (typeof answer === "string") return answer;
  if (typeof answer === "number" || typeof answer === "boolean") return String(answer);
  if (Array.isArray(answer)) return answer.map((v) => formatAnswer(v)).filter(Boolean).join(", ");
  if (typeof answer === "object") {
    if ("value" in answer) return formatAnswer((answer as any).value);
    if ("text" in answer) return formatAnswer((answer as any).text);
    try { return JSON.stringify(answer); } catch { return String(answer); }
  }
  return String(answer);
}
