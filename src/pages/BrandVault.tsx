import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, FolderLock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { BrandVaultEditor } from "@/components/brand-vault/BrandVaultEditor";

/**
 * Phase C — Brand Vault hub.
 *
 * Manages the user's persistent brand identity that every Thrive-generated
 * doc inherits. Two scopes:
 *   1. Personal default (no project_id) — used everywhere.
 *   2. Per-Studio brand (project_id set) — overrides default inside that Studio.
 */
export default function BrandVault() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const projectId = sp.get("project");
  const [projects, setProjects] = useState<Array<{ id: string; title: string; hasVault: boolean }>>([]);
  const [tab, setTab] = useState<"default" | "project">(projectId ? "project" : "default");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rows } = await supabase
        .from("projects")
        .select("id, title")
        .eq("created_by", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      const { data: vaults } = await supabase
        .from("brand_vaults")
        .select("project_id")
        .eq("user_id", user.id)
        .not("project_id", "is", null);
      const vaultProjects = new Set((vaults || []).map((v: any) => v.project_id));
      setProjects((rows || []).map((p: any) => ({ ...p, hasVault: vaultProjects.has(p.id) })));
    })();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Brand Vault · Kretopia" description="Your persistent brand. Every deck, proposal and treatment Kreto generates inherits it." />

      <header className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Brand Vault
            </div>
            <h1 className="text-base font-bold tracking-tight">Your brand, on every doc</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <Card className="p-4 bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
          <p className="text-sm leading-relaxed text-foreground/85">
            Set your logo, colours, fonts and voice once. Every deck, proposal,
            treatment and rate card Kreto generates uses it automatically —
            so you stop starting from scratch.
          </p>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="default" className="flex-1">Personal default</TabsTrigger>
            <TabsTrigger value="project" className="flex-1">Per-Studio overrides</TabsTrigger>
          </TabsList>

          <TabsContent value="default" className="mt-4">
            <BrandVaultEditor projectId={null} />
          </TabsContent>

          <TabsContent value="project" className="mt-4 space-y-3">
            {projectId ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <FolderLock className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    Editing brand for this Studio only.
                  </p>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs"
                    onClick={() => navigate("/brand-vault")}>
                    Clear filter
                  </Button>
                </div>
                <BrandVaultEditor projectId={projectId} />
              </>
            ) : (
              <Card className="p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Pick a Studio to give it its own brand. Defaults to your personal brand.
                </p>
                <div className="space-y-1.5">
                  {projects.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4 text-center">No Studios yet.</p>
                  )}
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/brand-vault?project=${p.id}`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition text-left"
                    >
                      <FolderLock className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm font-medium truncate">{p.title}</span>
                      {p.hasVault && (
                        <Badge variant="secondary" className="text-[10px]">Has brand</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
