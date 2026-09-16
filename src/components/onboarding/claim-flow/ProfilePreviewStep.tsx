import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Sparkles, X, ExternalLink, Pencil } from "lucide-react";
import { StudioComingAliveLoader } from "./StudioComingAliveLoader";
import { supabase } from "@/integrations/supabase/client";
import { CreditThumb } from "./CreditThumb";
import { cn } from "@/lib/utils";
import { resolveAvatarFallback, buildBioFallback } from "./profileFallbacks";
import type { ClaimedCredit, DraftProfile } from "./types";

/** Heuristic: looks like a real person name (2+ capitalized words, no slashes/dashes). */
const looksLikePersonName = (s?: string) => {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (/[/\\|]/.test(t)) return false;
  // At least two whitespace-separated words, each starting with a letter
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((p) => /^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(p));
};

interface Props {
  query: string;
  selectedCredits: ClaimedCredit[];
  onBack: () => void;
  onConfirm: (profile: DraftProfile, credits: ClaimedCredit[]) => void;
}

/** Step 3: live read-only profile preview, edit/remove anything. */
export const ProfilePreviewStep = ({ query, selectedCredits, onBack, onConfirm }: Props) => {
  const [building, setBuilding] = useState(true);
  const [profile, setProfile] = useState<DraftProfile>({});
  const [credits, setCredits] = useState<ClaimedCredit[]>(selectedCredits);

  // Best guess at a person name: only accept the query itself if it looks like one.
  // Never fall back to a role word ("Artist", "DJ/Producer").
  const seedName = useMemo(() => (looksLikePersonName(query) ? query.trim() : ""), [query]);
  const needsName = !profile.full_name?.trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = selectedCredits.find((c) => c.url && /^https?:\/\//.test(c.url))?.url;
        const { data } = await supabase.functions.invoke("ai-autofill-profile", {
          body: { full_name: seedName || query, url, current_role: selectedCredits[0]?.role_suggestion },
        });
        if (cancelled) return;
        const p = data?.profile || {};
        const aiName = looksLikePersonName(p.full_name) ? p.full_name.trim() : "";
        const websiteGuess = p.website || url || undefined;
        const draft: DraftProfile = {
          full_name: aiName || seedName || "",
          role: p.role || selectedCredits[0]?.role_suggestion || "",
          bio: p.bio || "",
          location: p.location || selectedCredits[0]?.location || "",
          skills: Array.isArray(p.skills) ? p.skills.slice(0, 6) : [],
          avatar_url: p.avatar_url || undefined,
          website: websiteGuess,
        };
        // Avatar fallback chain (og:image → first credit thumbnail)
        draft.avatar_url = await resolveAvatarFallback(draft.avatar_url, websiteGuess, selectedCredits);
        // Bio fallback (templated from role + top credits, no fabrication)
        if (!draft.bio?.trim()) draft.bio = buildBioFallback(draft, selectedCredits) || "";
        setProfile(draft);
      } catch (e) {
        console.warn("[ClaimFlow] enrichment soft-failed", e);
        setProfile({ full_name: seedName, role: selectedCredits[0]?.role_suggestion || "" });
      } finally {
        if (!cancelled) setBuilding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, selectedCredits, seedName]);

  const removeCredit = (id: string) => setCredits((prev) => prev.filter((c) => c._id !== id));

  if (building) {
    return <StudioComingAliveLoader />;
  }

  return (
    <div className="space-y-4">
      {/* Clear instruction header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 3 of 4 · Review &amp; edit
          </p>
        </div>
        <h2 className="text-xl font-bold leading-tight">
          {needsName ? "Add your name to continue" : "Does this look right?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {needsName
            ? "We couldn't detect your name from the search — type it below. You can also tweak your role, bio, and credits."
            : "Edit anything by tapping it. When you're happy, save and we'll send a magic link to your email."}
        </p>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20">
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            <AvatarFallback className="text-lg font-bold">
              {profile.full_name?.trim().charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                Your name
                {needsName && <span className="text-destructive">*</span>}
              </Label>
              <div className="relative">
                <Input
                  value={profile.full_name || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Fernando Lavado"
                  className={cn(
                    "h-9 text-base font-semibold pr-8",
                    needsName && "border-primary ring-2 ring-primary/30"
                  )}
                  autoFocus={needsName}
                />
                <Pencil className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Your role
              </Label>
              <Input
                value={profile.role || ""}
                onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))}
                placeholder="e.g. Director, Producer, Designer"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Bio</Label>
          <Textarea
            value={profile.bio || ""}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            placeholder="Add a short professional bio…"
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        {profile.skills && profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Credits */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {credits.length} verified credit{credits.length === 1 ? "" : "s"} · tap × to remove
        </p>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {credits.map((c) => (
            <div
              key={c._id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card/60 p-2"
            >
              <CreditThumb
                src={c.thumbnail}
                title={c.title}
                platform={c.platform || c.source_name}
                className="h-10 w-10 rounded shrink-0"
                iconClassName="h-4 w-4"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{c.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {c.role_suggestion || c.platform || "Credit"}
                  {c.year ? ` · ${c.year}` : ""}
                </p>
              </div>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="View source"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={() => removeCredit(c._id)}
                className="text-muted-foreground hover:text-destructive p-1"
                aria-label="Remove credit"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {credits.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1">
              No credits — you can add them later from your profile.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onBack} size="lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => onConfirm(profile, credits)}
          disabled={needsName}
          className="flex-1"
          size="lg"
        >
          {needsName ? "Add your name to continue" : "Save & send magic link"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
