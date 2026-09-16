import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { KretoMark } from "@/components/brand/KretoMark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface ConfirmedCredit {
  project_name: string;
  role: string;
  year?: number | string;
}

interface KretoPassportBuilderProps {
  role?: string;
  existingBio?: string;
  confirmedCredits: ConfirmedCredit[];
  /** Called only when the user explicitly confirms the drafted content. */
  onConfirm: (result: { bio: string | null; skills: string[] }) => void;
  onCancel: () => void;
}

type StageStatus = "pending" | "running" | "done" | "failed";

/**
 * Kreto builds the Passport — a short, honest sequence run after the user
 * has already confirmed their credits (Phase 3, not yet built — this
 * component expects `confirmedCredits` to already be user-approved).
 *
 * Every stage maps to a real operation:
 * - "Organizing credits" is synchronous and just reflects the count the
 *   caller passed in — no fake delay beyond what's needed to read it.
 * - "Drafting your story" and "Suggesting skills" are real calls to the
 *   existing `generate-content` edge function (same one AIProfileEnhancer
 *   already uses) — nothing new invented server-side.
 *
 * Nothing here is auto-published: the final step shows the draft bio and
 * suggested skills in an editable review, and onConfirm only fires when the
 * user explicitly clicks Confirm. Either stage can fail independently and
 * is retryable without losing the other's result.
 */
export function KretoPassportBuilder({
  role,
  existingBio,
  confirmedCredits,
  onConfirm,
  onCancel,
}: KretoPassportBuilderProps) {
  const [stage, setStage] = useState<"building" | "review">("building");
  const [bioStatus, setBioStatus] = useState<StageStatus>("pending");
  const [skillsStatus, setSkillsStatus] = useState<StageStatus>("pending");
  const [creditsStatus, setCreditsStatus] = useState<StageStatus>("pending");
  const [draftBio, setDraftBio] = useState("");
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const started = useRef(false);

  const runBio = async () => {
    setBioStatus("running");
    try {
      const creditLines = confirmedCredits
        .slice(0, 8)
        .map((c) => `- ${c.role} on "${c.project_name}"${c.year ? ` (${c.year})` : ""}`)
        .join("\n");
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          messages: [
            {
              role: "user",
              content: `Write a 2-3 sentence professional bio for a creative's Passport.
Role: ${role || "Creative professional"}
${existingBio ? `Existing bio to refine: ${existingBio}` : ""}
Confirmed credits:
${creditLines || "None yet"}
Return ONLY the bio text.`,
            },
          ],
        },
      });
      if (error) throw error;
      setDraftBio(data?.content?.trim() || "");
      setBioStatus("done");
    } catch {
      setBioStatus("failed");
    }
  };

  const runSkills = async () => {
    setSkillsStatus("running");
    try {
      const creditLines = confirmedCredits.slice(0, 8).map((c) => c.role).join(", ");
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          messages: [
            {
              role: "user",
              content: `Suggest 6-8 professional skills for this creative.
Role: ${role || "Creative professional"}
Credit roles: ${creditLines || "None yet"}
Return as a JSON array of strings only, e.g. ["Skill 1","Skill 2"].`,
            },
          ],
          type: "suggest",
        },
      });
      if (error) throw error;
      const parsed = data?.content ? JSON.parse(data.content) : [];
      setDraftSkills(Array.isArray(parsed) ? parsed : []);
      setSkillsStatus("done");
    } catch {
      setSkillsStatus("failed");
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    analytics.passportBuildStarted(confirmedCredits.length);
    setCreditsStatus("running");
    const t = setTimeout(() => setCreditsStatus("done"), 500); // real, just brief enough to read
    runBio();
    runSkills();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bioSettled = bioStatus === "done" || bioStatus === "failed";
    const skillsSettled = skillsStatus === "done" || skillsStatus === "failed";
    if (creditsStatus === "done" && bioSettled && skillsSettled) {
      setStage("review");
    }
  }, [creditsStatus, bioStatus, skillsStatus]);

  const StageRow = ({ label, status }: { label: string; status: StageStatus }) => (
    <div className="flex items-center gap-3 text-sm">
      {status === "done" && <Check className="h-4 w-4 text-[hsl(var(--signal-teal))] shrink-0" />}
      {status === "running" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
      {status === "pending" && <div className="h-4 w-4 rounded-full border border-border shrink-0" />}
      {status === "failed" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
      <span className={cn(status === "pending" ? "text-muted-foreground" : "text-foreground")}>{label}</span>
    </div>
  );

  if (stage === "building") {
    return (
      <div className="flex flex-col items-center gap-6 py-10 px-6 text-center">
        <KretoMark size="md" state="active" />
        <div className="space-y-3 w-full max-w-xs text-left">
          <StageRow label={`Organizing ${confirmedCredits.length} confirmed credit${confirmedCredits.length === 1 ? "" : "s"}`} status={creditsStatus} />
          <StageRow label="Drafting your professional story" status={bioStatus} />
          <StageRow label="Suggesting your skills" status={skillsStatus} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold">Here's what Kreto drafted</p>
        <p className="text-xs text-muted-foreground">Nothing is saved yet — review, edit, or remove anything below.</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bio draft</p>
          {bioStatus === "failed" && (
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={runBio}>
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          )}
        </div>
        {bioStatus === "failed" ? (
          <p className="text-xs text-destructive">Couldn't draft a bio — retry, or continue without one.</p>
        ) : (
          <Textarea
            value={draftBio}
            onChange={(e) => setDraftBio(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested skills</p>
          {skillsStatus === "failed" && (
            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={runSkills}>
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          )}
        </div>
        {skillsStatus === "failed" ? (
          <p className="text-xs text-destructive">Couldn't suggest skills — retry, or continue without them.</p>
        ) : draftSkills.length === 0 ? (
          <p className="text-xs text-muted-foreground">No skills suggested.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {draftSkills.map((s, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1">
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() => setDraftSkills((prev) => prev.filter((_, idx) => idx !== i))}
                  className="ml-1 rounded-full hover:bg-foreground/10 px-1"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            analytics.passportBuildCompleted(bioStatus === "done", draftSkills.length);
            onConfirm({ bio: bioStatus === "done" ? draftBio : null, skills: draftSkills });
          }}
        >
          Confirm & apply to Passport
        </Button>
      </div>
    </div>
  );
}

export default KretoPassportBuilder;
