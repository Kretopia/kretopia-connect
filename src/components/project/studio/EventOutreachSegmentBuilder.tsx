import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Target, Users, Filter } from "lucide-react";
import { BlastComposerDialog } from "@/components/meetup/BlastComposerDialog";

interface Props {
  project: any;
  currentUserId: string;
}

interface Participant {
  user_id: string;
  status: string;
}
interface ProfileLite {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}
interface Question {
  id: string;
  question: string;
  question_type: string;
}
interface Answer {
  id: string;
  question_id: string;
  user_id: string | null;
  answer: any;
}
interface MatchRow {
  user_a: string;
  user_b: string;
  score: number;
}

const STATUS_OPTIONS = [
  { value: "any", label: "Any RSVP status" },
  { value: "going", label: "Going" },
  { value: "interested", label: "Interested" },
  { value: "maybe", label: "Maybe" },
  { value: "checked_in", label: "Checked-in" },
];

/**
 * Host-only Studio module: build a custom outreach segment by combining
 * RSVP status, role keywords, custom RSVP answer text, and minimum AI
 * match score, then open the BlastComposerDialog scoped to that segment.
 */
export function EventOutreachSegmentBuilder({ project, currentUserId }: Props) {
  const eventId = project?.event_id as string | undefined;
  const isHost = project?.created_by === currentUserId;

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);

  // Filters
  const [status, setStatus] = useState<string>("any");
  const [roleQuery, setRoleQuery] = useState<string>("");
  const [questionId, setQuestionId] = useState<string>("any");
  const [answerQuery, setAnswerQuery] = useState<string>("");
  const [minScore, setMinScore] = useState<number>(0);

  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (!eventId || !isHost) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [pRes, qRes, aRes, mRes] = await Promise.all([
          supabase.from("jam_participants").select("user_id, status").eq("jam_id", eventId),
          (supabase as any).from("event_rsvp_questions").select("id, question, question_type").eq("event_id", eventId).order("position"),
          (supabase as any).from("event_rsvp_answers").select("id, question_id, user_id, answer").eq("event_id", eventId),
          (supabase as any).from("event_guest_matches").select("user_a, user_b, score").eq("event_id", eventId),
        ]);
        if (!alive) return;
        const parts = (pRes.data || []) as Participant[];
        setParticipants(parts);
        setQuestions((qRes.data || []) as Question[]);
        setAnswers((aRes.data || []) as Answer[]);
        setMatches((mRes.data || []) as MatchRow[]);

        const ids = Array.from(new Set(parts.map(p => p.user_id)));
        if (ids.length) {
          const { data: ps } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, role")
            .in("user_id", ids);
          const map: Record<string, ProfileLite> = {};
          (ps || []).forEach((p: any) => { map[p.user_id] = p; });
          if (alive) setProfiles(map);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })().catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [eventId, isHost]);

  // Per-user max match score
  const maxScoreByUser = useMemo(() => {
    const m: Record<string, number> = {};
    matches.forEach(row => {
      m[row.user_a] = Math.max(m[row.user_a] || 0, row.score);
      m[row.user_b] = Math.max(m[row.user_b] || 0, row.score);
    });
    return m;
  }, [matches]);

  const matched = useMemo(() => {
    const roleQ = roleQuery.trim().toLowerCase();
    const ansQ = answerQuery.trim().toLowerCase();

    return participants.filter(p => {
      // Status
      if (status !== "any" && p.status !== status) return false;

      const prof = profiles[p.user_id];
      // Role
      if (roleQ && !(prof?.role || "").toLowerCase().includes(roleQ)) return false;

      // Answer text — require this user has an answer to the chosen Q (or any Q) containing query
      if (ansQ) {
        const userAnswers = answers.filter(a =>
          a.user_id === p.user_id &&
          (questionId === "any" || a.question_id === questionId)
        );
        if (userAnswers.length === 0) return false;
        const hit = userAnswers.some(a => {
          const v = a.answer;
          const flat = Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : JSON.stringify(v ?? "");
          return flat.toLowerCase().includes(ansQ);
        });
        if (!hit) return false;
      } else if (questionId !== "any") {
        // Question selected but no text — require at least an answer to it
        const hasAny = answers.some(a => a.user_id === p.user_id && a.question_id === questionId);
        if (!hasAny) return false;
      }

      // Min match score
      if (minScore > 0 && (maxScoreByUser[p.user_id] || 0) < minScore) return false;

      return true;
    });
  }, [participants, profiles, answers, status, roleQuery, answerQuery, questionId, minScore, maxScoreByUser]);

  const matchedUserIds = matched.map(m => m.user_id);

  const segmentLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(status === "any" ? "All RSVPs" : `Status: ${status}`);
    if (roleQuery.trim()) parts.push(`role~"${roleQuery.trim()}"`);
    if (questionId !== "any") {
      const q = questions.find(q => q.id === questionId);
      if (q) parts.push(`Q: ${q.question.slice(0, 30)}${answerQuery ? ` ~ "${answerQuery.trim()}"` : ""}`);
    } else if (answerQuery.trim()) {
      parts.push(`answer~"${answerQuery.trim()}"`);
    }
    if (minScore > 0) parts.push(`match≥${minScore}`);
    return parts.join(" · ");
  }, [status, roleQuery, questionId, answerQuery, minScore, questions]);

  if (!eventId || !isHost) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Outreach Segments</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Build a custom audience from your RSVPs by role, custom answers, and Smart Match score — then send a tailored blast.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading guests…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider">RSVP status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider">Role contains</Label>
              <Input
                value={roleQuery}
                onChange={e => setRoleQuery(e.target.value)}
                placeholder="e.g. photographer, dj, founder"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider">RSVP question</Label>
              <Select value={questionId} onValueChange={setQuestionId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Any question" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any question</SelectItem>
                  {questions.map(q => (
                    <SelectItem key={q.id} value={q.id}>{q.question.slice(0, 60)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider">Answer contains</Label>
              <Input
                value={answerQuery}
                onChange={e => setAnswerQuery(e.target.value)}
                placeholder="e.g. vegan, intro, after-party"
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider">Min Smart Match score</Label>
                <span className="text-xs text-muted-foreground">{minScore}</span>
              </div>
              <Slider
                value={[minScore]}
                onValueChange={(v) => setMinScore(v[0] ?? 0)}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
              {matches.length === 0 && minScore > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  No Smart Matches generated yet — this filter will exclude everyone until you run matching.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{matchedUserIds.length}</span>
                <span className="text-muted-foreground">in segment</span>
                {participants.length > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 ml-1">
                    of {participants.length}
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="lime"
                disabled={matchedUserIds.length === 0}
                onClick={() => setComposerOpen(true)}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" /> Compose blast
              </Button>
            </div>

            {matched.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                <Filter className="h-4 w-4 inline mr-1" />
                No guests match these filters yet. Try loosening criteria.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
                {matched.slice(0, 60).map(p => {
                  const prof = profiles[p.user_id];
                  const score = maxScoreByUser[p.user_id];
                  return (
                    <div
                      key={p.user_id}
                      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 pl-1 pr-2 py-1"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={prof?.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px]">
                          {(prof?.full_name || "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] truncate max-w-[120px]">
                        {prof?.full_name || "Guest"}
                      </span>
                      {score ? (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1">{score}</Badge>
                      ) : null}
                    </div>
                  );
                })}
                {matched.length > 60 && (
                  <span className="text-[11px] text-muted-foreground self-center">
                    +{matched.length - 60} more
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {composerOpen && (
        <BlastComposerDialog
          open={composerOpen}
          onOpenChange={setComposerOpen}
          eventId={eventId}
          eventTitle={project?.title || "Event"}
          userIds={matchedUserIds}
          segmentLabel={segmentLabel}
        />
      )}
    </div>
  );
}
