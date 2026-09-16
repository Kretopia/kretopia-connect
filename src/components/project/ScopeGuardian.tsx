import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, ShieldAlert, ShieldCheck, ShieldQuestion,
  Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Target, DollarSign, FileWarning, MessageSquareWarning,
  Copy, Check, Milestone, ArrowRight, Info
} from "lucide-react";
import { FreeTierGate } from "@/components/FreeTierGate";
import { useAuth } from "@/hooks/useAuth";

interface ScopeGuardianProps {
  projectId: string;
  project: any;
  milestones: any[];
  onMilestonesGenerated?: () => void;
}

type BriefAnalysis = {
  risk_score: number;
  risk_level: string;
  flags: { text: string; issue: string; suggestion: string; severity: string }[];
  missing_elements: string[];
  recommended_additions: string[];
  summary: string;
};

type MilestoneResult = {
  milestones: {
    title: string;
    description: string;
    percentage: number;
    phase: string;
    deliverables: string[];
  }[];
  total_phases: number;
  revision_policy: string;
  payment_schedule_notes: string;
};

type ScopeDriftResult = {
  verdict: string;
  confidence: number;
  explanation: string;
  original_scope_reference: string;
  recommended_action: string;
  change_order: {
    needed: boolean;
    suggested_title: string;
    estimated_impact: string;
    professional_response: string;
  };
};

const RISK_CONFIG = {
  low: { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10", label: "Low Risk" },
  medium: { icon: ShieldQuestion, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Medium Risk" },
  high: { icon: ShieldAlert, color: "text-orange-500", bg: "bg-orange-500/10", label: "High Risk" },
  critical: { icon: Shield, color: "text-red-500", bg: "bg-red-500/10", label: "Critical Risk" },
};

const VERDICT_CONFIG = {
  in_scope: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "In Scope ✓" },
  out_of_scope: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10", label: "Out of Scope ✗" },
  borderline: { icon: Info, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Borderline" },
};

export function ScopeGuardian({ projectId, project, milestones, onMilestonesGenerated }: ScopeGuardianProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("analyze");
  const [loading, setLoading] = useState(false);
  const [briefText, setBriefText] = useState(project?.description || "");
  const [clientMessage, setClientMessage] = useState("");
  const [briefAnalysis, setBriefAnalysis] = useState<BriefAnalysis | null>(null);
  const [milestoneResult, setMilestoneResult] = useState<MilestoneResult | null>(null);
  const [scopeDrift, setScopeDrift] = useState<ScopeDriftResult | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const { user } = useAuth();
  const callScopeGuardian = async (action: string, extra: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scope-guardian`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, projectId, brief: briefText, ...extra }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      const data = await resp.json();
      return data.result;
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const analyzeBrief = async () => {
    if (!briefText.trim()) {
      toast({ title: "Enter a brief", description: "Paste or type your project brief to analyze.", variant: "destructive" });
      return;
    }
    const result = await callScopeGuardian("analyze_brief");
    if (result) setBriefAnalysis(result);
  };

  const generateMilestones = async () => {
    if (!briefText.trim()) {
      toast({ title: "Enter a brief", description: "Describe the project to generate milestones.", variant: "destructive" });
      return;
    }
    const result = await callScopeGuardian("generate_milestones");
    if (result) setMilestoneResult(result);
  };

  const checkScopeDrift = async () => {
    if (!clientMessage.trim()) {
      toast({ title: "Enter a message", description: "Paste the client's message to analyze.", variant: "destructive" });
      return;
    }
    const result = await callScopeGuardian("check_scope_drift", {
      message: clientMessage,
      milestones: milestones.map(m => ({ title: m.title, description: m.description })),
    });
    if (result) setScopeDrift(result);
  };

  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
    toast({ title: "Copied!", description: "Professional response copied to clipboard" });
  };

  const createMilestonesFromResult = async () => {
    if (!milestoneResult?.milestones?.length) return;
    setLoading(true);
    try {
      for (const ms of milestoneResult.milestones) {
        await supabase.from('milestones').insert({
          project_id: projectId,
          created_by: user?.id || '',
          title: ms.title,
          description: `${ms.description}\n\nDeliverables:\n${ms.deliverables.map(d => `• ${d}`).join('\n')}`,
          amount: 0,
          status: 'pending',
          escrow_status: 'none',
        });
      }
      toast({ title: "Milestones created!", description: `${milestoneResult.milestones.length} milestones added to your project.` });
      onMilestonesGenerated?.();
    } catch (err: any) {
      toast({ title: "Failed to create milestones", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FreeTierGate feature="aiBriefs" featureLabel="Scope Guardian" description="Upgrade to Pro for scope protection, milestone generation, and scope creep detection.">
      <div className="space-y-4">
        {/* Hero header */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  AI Scope Guardian
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="h-3 w-3" /> AI
                  </Badge>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Protect your revenue. Prevent scope creep. Get paid for every hour.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brief input */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-primary" />
              Project Brief / Scope
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Paste your project brief, scope document, or describe what was agreed upon with the client..."
              rows={4}
              className="mb-2"
            />
            <p className="text-[11px] text-muted-foreground">
              This is your source of truth. The AI uses this to analyze risks and detect scope creep.
            </p>
          </CardContent>
        </Card>

        {/* Action tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="analyze" className="gap-1 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Analyze</span> Risk
            </TabsTrigger>
            <TabsTrigger value="milestones" className="gap-1 text-xs">
              <Milestone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Generate</span> Milestones
            </TabsTrigger>
            <TabsTrigger value="drift" className="gap-1 text-xs">
              <MessageSquareWarning className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Scope</span> Check
            </TabsTrigger>
          </TabsList>

          {/* ── ANALYZE BRIEF ── */}
          <TabsContent value="analyze" className="mt-3 space-y-3">
            <Button onClick={analyzeBrief} disabled={loading || !briefText.trim()} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              {loading ? "Analyzing..." : "Analyze Brief for Risks"}
            </Button>

            {briefAnalysis && (
              <Card className="border-border/50">
                <CardContent className="pt-4 space-y-4">
                  {/* Risk score */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const config = RISK_CONFIG[briefAnalysis.risk_level as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
                        const Icon = config.icon;
                        return (
                          <>
                            <div className={`h-10 w-10 rounded-full ${config.bg} flex items-center justify-center`}>
                              <Icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div>
                              <p className={`font-bold ${config.color}`}>{config.label}</p>
                              <p className="text-xs text-muted-foreground">Risk Score: {briefAnalysis.risk_score}/100</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {/* Score ring */}
                    <div className="relative h-14 w-14">
                      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                        <circle cx="28" cy="28" r="24" fill="none" strokeWidth="4"
                          strokeDasharray={`${(briefAnalysis.risk_score / 100) * 150.8} 150.8`}
                          className={RISK_CONFIG[briefAnalysis.risk_level as keyof typeof RISK_CONFIG]?.color || "text-yellow-500"}
                          strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                        {briefAnalysis.risk_score}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">{briefAnalysis.summary}</p>
                  <Separator />

                  {/* Flags */}
                  {briefAnalysis.flags?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Scope Creep Flags ({briefAnalysis.flags.length})
                      </h4>
                      <div className="space-y-2">
                        {briefAnalysis.flags.map((flag, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-1.5">
                            <div className="flex items-start gap-2">
                              <Badge variant={flag.severity === "high" ? "destructive" : "secondary"} className="text-[10px] shrink-0 mt-0.5">
                                {flag.severity}
                              </Badge>
                              <p className="text-sm font-medium">"{flag.text}"</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{flag.issue}</p>
                            <p className="text-xs text-green-600 dark:text-green-400">✓ {flag.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing elements */}
                  {briefAnalysis.missing_elements?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Missing from Brief</h4>
                      <ul className="space-y-1">
                        {briefAnalysis.missing_elements.map((el, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-red-500 shrink-0">✗</span>
                            <span className="text-muted-foreground">{el}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended additions */}
                  {briefAnalysis.recommended_additions?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Recommended Additions</h4>
                      <ul className="space-y-1">
                        {briefAnalysis.recommended_additions.map((add, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-primary shrink-0">+</span>
                            <span className="text-muted-foreground">{add}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── GENERATE MILESTONES ── */}
          <TabsContent value="milestones" className="mt-3 space-y-3">
            <Button onClick={generateMilestones} disabled={loading || !briefText.trim()} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Milestone className="h-4 w-4" />}
              {loading ? "Generating..." : "Generate Smart Milestones"}
            </Button>

            {milestoneResult && (
              <Card className="border-border/50">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{milestoneResult.milestones.length} Milestones Generated</h4>
                    <Button size="sm" onClick={createMilestonesFromResult} disabled={loading} className="gap-1.5 text-xs">
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      Add to Project
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {milestoneResult.milestones.map((ms, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] shrink-0">{ms.phase}</Badge>
                            <span className="text-sm font-medium">{ms.title}</span>
                          </div>
                          <Badge className="text-xs gap-1">
                            <DollarSign className="h-3 w-3" />
                            {ms.percentage}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{ms.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {ms.deliverables.map((d, j) => (
                            <Badge key={j} variant="secondary" className="text-[10px]">✓ {d}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {milestoneResult.revision_policy && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <h5 className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        Revision Policy
                      </h5>
                      <p className="text-xs text-muted-foreground">{milestoneResult.revision_policy}</p>
                    </div>
                  )}

                  {milestoneResult.payment_schedule_notes && (
                    <p className="text-xs text-muted-foreground italic">{milestoneResult.payment_schedule_notes}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── SCOPE DRIFT CHECK ── */}
          <TabsContent value="drift" className="mt-3 space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Client Message</label>
              <Textarea
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                placeholder={`Paste the client's message here, e.g.:\n"Hey, can we also add a dark mode and 3 extra pages to the website?"`}
                rows={3}
              />
            </div>

            <Button onClick={checkScopeDrift} disabled={loading || !clientMessage.trim() || !briefText.trim()} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareWarning className="h-4 w-4" />}
              {loading ? "Analyzing..." : "Check if In Scope"}
            </Button>

            {scopeDrift && (
              <Card className="border-border/50">
                <CardContent className="pt-4 space-y-4">
                  {/* Verdict */}
                  <div className="flex items-center gap-3">
                    {(() => {
                      const config = VERDICT_CONFIG[scopeDrift.verdict as keyof typeof VERDICT_CONFIG] || VERDICT_CONFIG.borderline;
                      const Icon = config.icon;
                      return (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${config.bg} w-full`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <div>
                            <p className={`font-bold text-sm ${config.color}`}>{config.label}</p>
                            <p className="text-xs text-muted-foreground">Confidence: {scopeDrift.confidence}%</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <p className="text-sm text-muted-foreground">{scopeDrift.explanation}</p>

                  {scopeDrift.original_scope_reference && (
                    <div className="p-2 rounded bg-muted/30">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Scope reference:</span> {scopeDrift.original_scope_reference}
                      </p>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <h5 className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-primary" />
                      Recommended Action
                    </h5>
                    <p className="text-xs text-muted-foreground">{scopeDrift.recommended_action}</p>
                  </div>

                  {/* Change order */}
                  {scopeDrift.change_order?.needed && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h5 className="text-sm font-semibold flex items-center gap-1.5">
                          <DollarSign className="h-4 w-4 text-green-500" />
                          Change Order Needed
                        </h5>
                        {scopeDrift.change_order.suggested_title && (
                          <p className="text-sm"><strong>Title:</strong> {scopeDrift.change_order.suggested_title}</p>
                        )}
                        {scopeDrift.change_order.estimated_impact && (
                          <p className="text-xs text-muted-foreground">
                            <strong>Impact:</strong> {scopeDrift.change_order.estimated_impact}
                          </p>
                        )}

                        {scopeDrift.change_order.professional_response && (
                          <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="text-xs font-semibold text-green-600 dark:text-green-400">
                                Professional Response (copy & send)
                              </h6>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => copyResponse(scopeDrift.change_order.professional_response)}
                              >
                                {copiedResponse ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedResponse ? "Copied" : "Copy"}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {scopeDrift.change_order.professional_response}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </FreeTierGate>
  );
}
