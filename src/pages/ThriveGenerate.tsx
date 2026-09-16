import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Share2, RefreshCw, ArrowLeft, Wand2 } from "lucide-react";
import { DeckRenderer, type DeckContent } from "@/components/thrive/DeckRenderer";
import { DECK_THEMES, defaultThemeFor, type DeckTheme } from "@/lib/deckThemes";
import { exportDeckToPDF } from "@/lib/deckExport";
import { SEO } from "@/components/SEO";
import { BrandVaultChip } from "@/components/brand-vault/BrandVaultChip";

type Intent =
  | "sponsor_deck" | "pitch_deck" | "business_plan" | "client_proposal"
  | "treatment" | "rate_card" | "moodboard_deck" | "one_pager" | "letter_of_intent";

const INTENTS: { id: Intent; label: string; hint: string }[] = [
  { id: "sponsor_deck", label: "Sponsor Deck", hint: "Pitch sponsors on your event or content" },
  { id: "client_proposal", label: "Client Proposal", hint: "Win a client with a specific plan + price" },
  { id: "letter_of_intent", label: "Letter of Intent", hint: "Branded letterhead — formal LOI to a partner, sponsor or govt body" },
  { id: "pitch_deck", label: "Pitch Deck", hint: "Investor pitch for your product or studio" },
  { id: "business_plan", label: "Business Plan", hint: "Full strategy + financials deck" },
  { id: "treatment", label: "Treatment", hint: "Director's treatment for a film/video" },
  { id: "rate_card", label: "Rate Card", hint: "Premium packaging of your services" },
  { id: "moodboard_deck", label: "Moodboard", hint: "Image-led concept deck" },
  { id: "one_pager", label: "One-Pager", hint: "Single dense page — hook, value, ask" },
];

export default function ThriveGenerate() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { user } = useAuth();

  const initialIntent = (sp.get("intent") as Intent) || "sponsor_deck";
  const initialBrief = sp.get("brief") || "";

  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [brief, setBrief] = useState(initialBrief);
  const [theme, setTheme] = useState<DeckTheme>(defaultThemeFor(initialIntent));
  const [themeManuallySet, setThemeManuallySet] = useState(false);
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<any>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  // Auto-pair theme to intent unless the user has manually chosen one.
  useEffect(() => {
    if (!themeManuallySet) setTheme(defaultThemeFor(intent));
  }, [intent, themeManuallySet]);

  useEffect(() => {
    if (!projectId) return;
    supabase.from("projects").select("title, description, workspace_type")
      .eq("id", projectId).maybeSingle()
      .then(({ data }) => setProject(data), () => {});
  }, [projectId]);

  const generate = async () => {
    if (!brief.trim() && !project) {
      toast.error("Tell Kreto what this is for.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("thrive-document-engine", {
        body: {
          intent,
          project_id: projectId || null,
          user_brief: brief.trim() || `Generate a ${intent.replace("_", " ")} for the Studio "${project?.title}".`,
          theme,
          document_id: doc?.id || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDoc(data.document);
      toast.success(doc ? "Regenerated" : "Drafted");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const publishAndShare = async () => {
    if (!doc) return;
    try {
      const { data, error } = await supabase
        .from("thrive_documents")
        .update({ status: "published" })
        .eq("id", doc.id)
        .select()
        .single();
      if (error) throw error;
      setDoc(data);
      const url = `${window.location.origin}/deck/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied", { description: url });
    } catch (e: any) {
      toast.error(e?.message || "Couldn't publish");
    }
  };

  const downloadPDF = async () => {
    if (!renderRef.current || !doc) return;
    toast.loading("Building PDF…", { id: "pdf" });
    try {
      await exportDeckToPDF(renderRef.current.querySelector("#thrive-deck-root") as HTMLElement, `${doc.title || "deck"}.pdf`);
      toast.success("PDF ready", { id: "pdf" });
    } catch (e: any) {
      toast.error(e?.message || "PDF export failed", { id: "pdf" });
    }
  };

  const content = doc?.content as DeckContent | null;

  return (
    <div className="min-h-screen bg-background accent-scout">
      <SEO title="Thrive · Executive Producer" description="Generate decks, proposals, rate cards, and treatments inside your Studio." />

      <header className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(projectId ? `/desk/${projectId}` : "/desk")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Executive Producer</div>
            <h1 className="text-sm font-semibold truncate">
              {doc?.title || (project?.title ? `New doc for "${project.title}"` : "New document")}
            </h1>
          </div>
          {doc && (
            <>
              <Button variant="outline" size="sm" onClick={downloadPDF}>
                <Download className="h-4 w-4 mr-1.5" />PDF
              </Button>
              <Button size="sm" onClick={publishAndShare}>
                <Share2 className="h-4 w-4 mr-1.5" />Share
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-[320px_1fr] gap-6">
        {/* Composer */}
        <aside className="space-y-4">
          <Card className="p-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">What are you making?</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {INTENTS.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setIntent(it.id)}
                  className={`text-left p-2 rounded-md border transition ${intent === it.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <div className="text-xs font-semibold">{it.label}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-2">{it.hint}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Brief</label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={`Paste your prompt, talking points, or just tell Kreto what you need.\n\ne.g. "Sponsor deck for our 500-person summit in Aug. Target: lifestyle brands. Tone: bold, no fluff."`}
              className="mt-2 min-h-[160px] text-sm"
            />
            <Button onClick={generate} disabled={loading} className="w-full mt-3">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : doc ? <RefreshCw className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {loading ? "Drafting…" : doc ? "Regenerate" : "Draft it"}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              Kreto pulls your Passport, recent credits and memory automatically. Mention only what's new.
            </p>
            {projectId && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Brand</span>
                <BrandVaultChip projectId={projectId} />
              </div>
            )}
          </Card>

          {doc && (
            <Card className="p-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Look</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(Object.keys(DECK_THEMES) as DeckTheme[]).map((t) => (
                  <button
                    key={t}
                    onClick={async () => {
                      setTheme(t);
                      setThemeManuallySet(true);
                      await supabase.from("thrive_documents").update({ theme: t }).eq("id", doc.id);
                      setDoc({ ...doc, theme: t });
                    }}
                    title={DECK_THEMES[t].description}
                    className={`p-2 rounded-md border text-xs font-medium transition ${theme === t || doc.theme === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  >
                    {DECK_THEMES[t].name}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {content?.next_steps && content.next_steps.length > 0 && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Wand2 className="h-3 w-3" /> Kreto suggests next
              </div>
              <ul className="space-y-2">
                {content.next_steps.map((s: string, i: number) => (
                  <li key={i} className="text-xs text-foreground/85 flex gap-2">
                    <span className="text-primary">→</span>{s}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="cursor-pointer" onClick={() => navigate("/scout")}>Find sponsors</Badge>
                <Badge variant="outline" className="cursor-pointer" onClick={() => navigate(`/desk/${projectId || ""}`)}>Add to Desk</Badge>
                <Badge variant="outline" className="cursor-pointer" onClick={() => navigate("/thrivepay")}>Send quote</Badge>
              </div>
            </Card>
          )}
        </aside>

        {/* Preview */}
        <main ref={renderRef}>
          {!doc && (
            <Card className="p-12 text-center">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h2 className="text-lg font-semibold mb-1">Tell me what you need.</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                I'll draft a first version using everything I already know about you — your credits, co-signs, rates, recent work.
                You stay in the driver's seat.
              </p>
            </Card>
          )}
          {doc && content && (
            <DeckRenderer doc={content} theme={(doc.theme as DeckTheme) || theme} coverImageUrl={doc.cover_image_url} authorName={user?.user_metadata?.full_name} />
          )}
        </main>
      </div>
    </div>
  );
}
