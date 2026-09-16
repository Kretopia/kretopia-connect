import { useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, FileText, Image as ImageIcon, Sparkles, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ProfileActivationGateProps {
  /** True when profile already meets discovery requirements */
  isVisible: boolean;
  /** Specific fields the user is missing (e.g. "Profile Picture") */
  missingFields: string[];
  /** Content to render when the profile is complete */
  children: ReactNode;
  /** Surface label used in the headline ("Discover", "Match", etc.) */
  surfaceLabel?: string;
}

const fieldIconMap: Record<string, React.ReactNode> = {
  "Profile Picture": <Camera className="h-4 w-4" />,
  "Bio (20+ characters)": <FileText className="h-4 w-4" />,
  "At least 1 Work Item (Portfolio or Credit)": <ImageIcon className="h-4 w-4" />,
};

/**
 * Hard activation gate. Replaces the soft visibility banner.
 * The profile MUST meet discovery requirements to access the wrapped content.
 * Provides inline social-URL auto-import to lower friction.
 */
export const ProfileActivationGate = ({
  isVisible,
  missingFields,
  children,
  surfaceLabel = "Discover",
}: ProfileActivationGateProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  if (isVisible) return <>{children}</>;

  const handleAutoImport = async () => {
    if (!importUrl.trim() || !user) return;
    setImporting(true);
    try {
      // Step 1: persist the URL on the profile so enrichment can use it as a verified source
      const lower = importUrl.toLowerCase();
      const profileUpdate: Record<string, string> = {};
      if (lower.includes("linkedin.com")) profileUpdate.linkedin_url = importUrl;
      else if (lower.includes("imdb.com")) profileUpdate.imdb_url = importUrl;
      else profileUpdate.website = importUrl;
      await supabase.from("profiles").update(profileUpdate).eq("user_id", user.id);

      // Step 2: scrape page directly for bio/skills/portfolio (analyze-profile-url)
      const { data: scrape, error: scrapeErr } = await supabase.functions.invoke("analyze-profile-url", {
        body: { url: importUrl },
      });
      if (scrapeErr) throw scrapeErr;

      if (scrape?.isLinkedInBlock) {
        toast({
          title: "LinkedIn blocks scraping",
          description: "Try your personal site, IMDb, Behance, or another portfolio URL.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      const data = scrape?.data;
      if (data) {
        const updates: Record<string, any> = {};
        if (data.bio && data.bio.length >= 20) updates.bio = data.bio.slice(0, 500);
        if (data.location) updates.location = data.location;
        if (data.role) updates.role = data.role;
        if (Array.isArray(data.skills) && data.skills.length > 0) {
          updates.professional_skills = data.skills.slice(0, 12);
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("user_id", user.id);
        }
        // Insert portfolio items as credits (verified work)
        if (Array.isArray(data.portfolio_items) && data.portfolio_items.length > 0) {
          const rows = data.portfolio_items.slice(0, 6).map((p: any) => ({
            user_id: user.id,
            project_name: String(p.title || "Untitled").slice(0, 200),
            role: data.role || "Creator",
            url: p.media_url || null,
            thumbnail_url: p.thumbnail_url || null,
            primary_media_url: p.thumbnail_url || p.media_url || null,
            media_type: p.media_type || "image",
            source: "web_verified",
            verification_status: "pending_review",
          }));
          await supabase.from("credits").insert(rows);
        }
      }

      // Step 3: trigger background enrichment for avatar (og:image) + extras
      supabase.functions
        .invoke("enrich-creator-profile", { body: { user_id: user.id, scrape_website: true } })
        .catch(() => {});

      toast({
        title: "Profile imported",
        description: "We pulled what we could verify. Refreshing…",
      });
      // Give the writes a moment to settle before re-checking gate
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      console.error("[ActivationGate] import failed:", e);
      toast({
        title: "Import failed",
        description: e?.message || "Try another URL or complete your profile manually.",
        variant: "destructive",
      });
      setImporting(false);
    }
  };

  return (
    <>
      {/* Render a blurred peek of the content behind so users feel what they're missing */}
      <div className="pointer-events-none select-none blur-md opacity-40 max-h-[60vh] overflow-hidden">
        {children}
      </div>

      <Dialog open onOpenChange={() => {}}>
        <DialogContent
          className="max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">
              Unlock {surfaceLabel}
            </DialogTitle>
            <DialogDescription className="text-center">
              Add a photo, bio, and one piece of work so other creators can find you.
              Takes ~30 seconds.
            </DialogDescription>
          </DialogHeader>

          {/* Missing checklist */}
          <div className="space-y-2">
            {missingFields.map((field) => (
              <div
                key={field}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {fieldIconMap[field] || <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span>{field}</span>
              </div>
            ))}
          </div>

          {/* Auto-import */}
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Label htmlFor="gate-import" className="text-xs font-semibold uppercase tracking-wide text-primary">
              Fast track: import from a link
            </Label>
            <p className="text-xs text-muted-foreground">
              Paste your portfolio, IMDb, Behance, or personal site. We only save what we can verify — no fake details.
            </p>
            <div className="flex gap-2">
              <Input
                id="gate-import"
                type="url"
                placeholder="https://yoursite.com"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                disabled={importing}
                className="text-sm"
              />
              <Button
                onClick={handleAutoImport}
                disabled={importing || !importUrl.trim()}
                size="sm"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
              </Button>
            </div>
          </div>

          <Button
            onClick={() => navigate("/profile")}
            className="w-full"
            variant="outline"
          >
            Complete profile manually
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
