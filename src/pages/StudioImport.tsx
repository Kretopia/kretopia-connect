import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProviderPicker } from "@/components/import/ProviderPicker";
import { ConnectStep } from "@/components/import/ConnectStep";
import { ScopeStep, emptyScope, type ScopeState } from "@/components/import/ScopeStep";
import { MappingStep } from "@/components/import/MappingStep";
import { ProgressStep } from "@/components/import/ProgressStep";
import { KretoSuggestions } from "@/components/import/KretoSuggestions";
import {
  IMPORT_PROVIDERS,
  analyzeImport,
  fetchConnections,
  listScopes,
  runImport,
  startOAuth,
  uploadImportFile,
  type ImportJob,
  type ImportMapping,
  type ProviderId,
  type ScopeNode,
} from "@/lib/studioImport";

const STEPS = ["Source", "Connect", "Choose", "Review", "Import"];

const NEW_PROJECT = "__new";

export default function StudioImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [uploadPath, setUploadPath] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);

  const [scopes, setScopes] = useState<ScopeNode[]>([]);
  const [scope, setScope] = useState<ScopeState>(emptyScope());

  const [jobId, setJobId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [mappings, setMappings] = useState<ImportMapping[]>([]);

  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [projectId, setProjectId] = useState<string>(params.get("project") ?? NEW_PROJECT);
  const [newTitle, setNewTitle] = useState("");
  const [finished, setFinished] = useState<ImportJob | null>(null);

  const meta = useMemo(() => IMPORT_PROVIDERS.find((p) => p.id === provider) ?? null, [provider]);

  const refreshConnections = useCallback(async () => {
    const rows = await fetchConnections().catch(() => []);
    setConnected(rows.filter((r: any) => r.connection_status === "active").map((r: any) => r.provider));
  }, []);

  useEffect(() => { refreshConnections(); }, [refreshConnections]);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, title")
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setProjects(data ?? []));
  }, []);

  // Returning from OAuth
  useEffect(() => {
    const p = params.get("provider") as ProviderId | null;
    if (params.get("connected") === "1" && p) {
      setProvider(p);
      setStep(2);
      refreshConnections();
      params.delete("connected");
      setParams(params, { replace: true });
      toast({ title: "Connected", description: "Now choose what to bring across." });
    } else if (params.get("error")) {
      toast({ title: "Couldn't connect", description: params.get("error") ?? undefined, variant: "destructive" });
      params.delete("error");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load scopes when entering step 2
  useEffect(() => {
    if (step !== 2 || !provider) return;
    let alive = true;
    setBusy(true);
    listScopes({ provider, upload_path: uploadPath })
      .then((r) => { if (alive) setScopes(r.scopes ?? []); })
      .catch((e) => toast({ title: "Couldn't read that source", description: e.message, variant: "destructive" }))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, provider, uploadPath]);

  const handleConnect = async () => {
    if (!provider) return;
    setBusy(true);
    try {
      const { url } = await startOAuth(provider, `${window.location.origin}/studio/import?provider=${provider}`);
      window.location.href = url;
    } catch (e: any) {
      toast({ title: "Couldn't start that", description: e.message, variant: "destructive" });
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const path = await uploadImportFile(user.id, file);
      setUploadPath(path);
      setUploadName(file.name);
      setStep(2);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyze = async () => {
    if (!provider) return;
    setBusy(true);
    try {
      const res = await analyzeImport({
        provider,
        upload_path: uploadPath,
        project_id: projectId === NEW_PROJECT ? null : projectId,
        scope: scope as unknown as Record<string, unknown>,
      });
      setJobId(res.job_id);
      setCounts(res.counts ?? {});
      setWarnings(res.warnings ?? []);
      setSourceName(res.source_name || meta?.name || "your source");
      setMappings(res.mappings ?? []);
      if (!newTitle) setNewTitle(res.source_name || `${meta?.name} import`);
      setStep(3);
    } catch (e: any) {
      toast({ title: "Couldn't preview that", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async (retryOnly = false) => {
    if (!jobId) return;
    setBusy(true);
    try {
      await runImport({
        job_id: jobId,
        mappings,
        project_id: projectId === NEW_PROJECT ? null : projectId,
        new_project_title: newTitle || sourceName,
        retry_only: retryOnly,
      });
      setStep(4);
    } catch (e: any) {
      toast({ title: "Couldn't start the import", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return !!provider;
    if (step === 1) return meta?.auth === "oauth" ? connected.includes(provider!) : !!uploadPath;
    if (step === 2) return provider === "csv" ? !!scope.column_map?.title : scope.ids.length > 0;
    return true;
  };

  return (
    <div className="accent-studios container mx-auto max-w-2xl px-3 py-4 pb-32 sm:px-4 md:pb-12">
      <SEO
        title="Studio Import — Bring your work into Kretopia"
        description="Import projects, tasks and history from Notion, monday.com, Slack exports or a CSV straight into your Kretopia Studio."
      />

      <header className="mb-5 flex items-start gap-2">
        <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8 shrink-0" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-[-0.03em]">
            Bring your work <span className="italic text-[hsl(var(--signal-teal))]">into Studio</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {STEPS[step]} · step {step + 1} of {STEPS.length}
          </p>
        </div>
      </header>

      <div className="mb-5 flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 0 && (
        <ProviderPicker
          value={provider}
          connected={connected}
          onSelect={(id) => { setProvider(id); setUploadPath(null); setUploadName(null); setScope(emptyScope()); setStep(1); }}
        />
      )}

      {step === 1 && provider && (
        <ConnectStep
          provider={provider}
          connected={connected.includes(provider)}
          busy={busy}
          uploadName={uploadName}
          onConnect={handleConnect}
          onFile={handleFile}
        />
      )}

      {step === 2 && provider && (
        busy && scopes.length === 0
          ? <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading your source…</div>
          : <ScopeStep provider={provider} scopes={scopes} value={scope} onChange={setScope} />
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs">Bring it into</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_PROJECT}>A brand new Studio</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {projectId === NEW_PROJECT && (
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Name this Studio" className="h-9" />
            )}
          </div>
          <MappingStep counts={counts} warnings={warnings} sourceName={sourceName} mappings={mappings} onChange={setMappings} />
        </div>
      )}

      {step === 4 && jobId && (
        <div className="space-y-5">
          <ProgressStep jobId={jobId} onDone={setFinished} onRetry={() => handleRun(true)} />
          {finished && (
            <>
              <KretoSuggestions jobId={jobId} />
              <Button className="w-full" onClick={() => navigate(finished.project_id ? `/desk/${finished.project_id}` : "/desk")}>
                Open the Studio <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}

      {step < 4 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Read-only · nothing is changed at the source
          </p>
          {(step !== 1 || meta?.auth === "oauth") && (
            <Button
              disabled={!canAdvance() || busy}
              onClick={() => (step === 2 ? handleAnalyze() : step === 3 ? handleRun() : setStep(step + 1))}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {step === 3 ? "Bring it in" : step === 2 ? "Preview" : "Continue"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
