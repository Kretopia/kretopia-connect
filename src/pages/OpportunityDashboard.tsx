import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, MapPin, DollarSign, User, Users, Star, Sparkles, Mail, Eye, Edit, Crown, Trophy, TrendingUp, Filter, LayoutGrid, List, BarChart3, ChevronDown, ChevronUp, ExternalLink, Clock, Share2, ArrowLeft, Video, Loader2 } from "lucide-react";
import { ShareProfileDialog } from "@/components/profile/ShareProfileDialog";
import { useStartDirectCall } from "@/hooks/useStartDirectCall";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PostOpportunityDialog } from "@/components/PostOpportunityDialog";
import { EditOpportunityDialog } from "@/components/EditOpportunityDialog";
import { FreeTierGate } from "@/components/FreeTierGate";
import { ApplicantPipeline } from "@/components/opportunity/ApplicantPipeline";
import { CompBoard } from "@/components/opportunity/CompBoard";
import { OpportunityAnalytics } from "@/components/opportunity/OpportunityAnalytics";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { cn } from "@/lib/utils";

interface Applicant {
  id: string;
  applicant_id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  cover_letter: string;
  portfolio_links?: string[];
  status: string;
  created_at: string;
  expected_rate?: string;
  availability?: string;
  ai_match_score?: number;
  match_reasons?: string[];
  professional_skills?: string[];
}

interface Opportunity {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  applications_count: number;
  new_applications: number;
}

const PIPELINE_STATUSES = ['pending', 'shortlisted', 'accepted', 'rejected'] as const;

const OpportunityDashboard = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [editingOpportunityId, setEditingOpportunityId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');
  const [dashboardTab, setDashboardTab] = useState<'applicants' | 'analytics'>('applicants');
  const autoAnalyzedRef = useRef<Set<string>>(new Set());
  const { user, loading: authLoading, subscriptionInfo } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPro = hasProAccess(subscriptionInfo.tier as any);
  const requestedOpportunityId = searchParams.get('opportunity');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // This page is only meaningful when reviewing applicants for a specific gig.
    // Without a target gig, send users to the unified Gig Manager instead.
    if (!requestedOpportunityId) {
      navigate('/manage-opportunities', { replace: true });
      return;
    }

    fetchOpportunities();
  }, [user, authLoading, navigate, requestedOpportunityId]);

  useEffect(() => {
    if (selectedOppId) {
      // Clear stale applicants from previously selected gig before loading new ones
      setApplicants([]);
      fetchApplicants(selectedOppId);
    }
  }, [selectedOppId]);

  const fetchOpportunities = async () => {
    if (!user) return;

    // First get all opportunities
    const { data: oppsData, error: oppsError } = await supabase
      .from('opportunities')
      .select('id, title, type, status, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (oppsError) {
      console.error('Error fetching opportunities:', oppsError);
      toast.error('Failed to load opportunities');
      setLoading(false);
      return;
    }

    // Get application counts for each opportunity
    const formatted = await Promise.all(
      (oppsData || []).map(async (opp: any) => {
        const { count } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('opportunity_id', opp.id);

        return {
          id: opp.id,
          title: opp.title,
          type: opp.type,
          status: opp.status,
          created_at: opp.created_at,
          applications_count: count || 0,
          new_applications: 0,
        };
      })
    );

    setOpportunities(formatted);
    if (formatted.length > 0) {
      const initialOpportunityId = formatted.some((opp) => opp.id === requestedOpportunityId)
        ? requestedOpportunityId
        : formatted[0].id;
      setSelectedOppId(initialOpportunityId);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!requestedOpportunityId || opportunities.length === 0 || requestedOpportunityId === selectedOppId) {
      return;
    }

    if (opportunities.some((opp) => opp.id === requestedOpportunityId)) {
      setSelectedOppId(requestedOpportunityId);
    }
  }, [requestedOpportunityId, opportunities, selectedOppId]);

  const handleOpportunityChange = (opportunityId: string) => {
    setSelectedOppId(opportunityId);
    setSearchParams({ opportunity: opportunityId }, { replace: true });
  };

  const fetchApplicants = async (opportunityId: string) => {
    setLoading(true);
    
    // Fetch applications first
    const { data: appsData, error: appsError } = await supabase
      .from('applications')
      .select('id, applicant_id, cover_letter, portfolio_links, status, created_at, expected_rate, availability, comp_card_snapshot')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });

    if (appsError) {
      console.error('Error fetching applicants:', appsError);
      toast.error('Failed to load applications');
      setLoading(false);
      return;
    }

    const apps = appsData || [];
    
    // Fetch profiles separately using the applicant IDs
    const applicantIds = [...new Set(apps.map(a => a.applicant_id))];
    let profilesMap: Record<string, any> = {};
    
    if (applicantIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role, professional_skills')
        .in('user_id', applicantIds);
      
      if (profilesData) {
        profilesMap = Object.fromEntries(profilesData.map(p => [p.user_id, p]));
      }
    }

    const formatted = apps.map((app: any) => {
      const profile = profilesMap[app.applicant_id];
      return {
        id: app.id,
        applicant_id: app.applicant_id,
        full_name: profile?.full_name || 'Unknown',
        avatar_url: profile?.avatar_url,
        role: profile?.role || 'Creator',
        cover_letter: app.cover_letter,
        portfolio_links: app.portfolio_links,
        status: app.status,
        created_at: app.created_at,
        expected_rate: app.expected_rate,
        availability: app.availability,
        professional_skills: profile?.professional_skills || [],
        comp_card_snapshot: app.comp_card_snapshot,
      };
    });
    setApplicants(formatted);
    setLoading(false);
  };

  const analyzeWithAI = useCallback(async () => {
    if (!selectedOppId || applicants.length === 0) return;

    setAnalyzingAI(true);
    try {
      const { data: oppData } = await supabase
        .from('opportunities')
        .select('title, description, skills, requirements')
        .eq('id', selectedOppId)
        .single();

      if (!oppData) throw new Error('Opportunity not found');

      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          type: 'ranking',
          messages: [
            {
              role: 'user',
              content: `Score and rank these applicants for the opportunity. Be generous with scores (60+ is good match).

OPPORTUNITY:
Title: ${oppData.title}
Description: ${oppData.description}
Required Skills: ${oppData.skills?.join(', ') || 'Not specified'}
Requirements: ${oppData.requirements || 'Not specified'}

APPLICANTS:
${applicants.map((a, i) => `${i}. ${a.full_name} - ${a.role}
Skills: ${a.professional_skills?.join(', ') || 'None listed'}
Cover Letter: ${a.cover_letter?.substring(0, 200)}...
Rate: ${a.expected_rate || 'Not specified'}
Availability: ${a.availability || 'Not specified'}`).join('\n\n')}

For each applicant, provide:
1. Match score (0-100) - Be generous, most should be 60+
2. 3 specific reasons why they're a good/bad match
3. 1 risk or concern (if any)

Return ONLY valid JSON array:
[{"index": 0, "score": 85, "reasons": ["Strong skill match", "Relevant portfolio", "Good availability"], "risk": "No concern"}]`
            }
          ],
        }
      });

      if (error) throw error;

      const content = data?.content;
      if (!content) throw new Error('No content returned');

      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const scores = JSON.parse(jsonStr);
      
      const scoredApplicants = applicants.map((applicant, index) => {
        const scoreData = scores.find((s: any) => s.index === index);
        return {
          ...applicant,
          ai_match_score: scoreData?.score || 50,
          match_reasons: scoreData?.reasons || [],
          ai_risk: scoreData?.risk || null,
        };
      });

      scoredApplicants.sort((a, b) => (b.ai_match_score || 0) - (a.ai_match_score || 0));
      setApplicants(scoredApplicants);
      setSortBy('score');
      toast.success('Smart ranking complete!');
    } catch (error) {
      console.error('AI analysis error:', error);
      toast.error('Smart Match analysis failed');
    } finally {
      setAnalyzingAI(false);
    }
  }, [selectedOppId, applicants]);

  // Auto-trigger AI ranking for Pro users when applicants load
  useEffect(() => {
    if (isPro && selectedOppId && applicants.length > 0 && !analyzingAI && !autoAnalyzedRef.current.has(selectedOppId)) {
      autoAnalyzedRef.current.add(selectedOppId);
      analyzeWithAI();
    }
  }, [isPro, selectedOppId, applicants.length]);

  const notifyApplicantStatusChange = async (
    applicantUserId: string,
    newStatus: 'accepted' | 'rejected' | 'shortlisted',
    gigTitle: string,
    gigId: string,
    projectId?: string,
  ) => {
    try {
      const { APP_URL } = await import('@/lib/constants');
      const gigUrl = `${APP_URL}/opportunity/${gigId}`;
      const projectUrl = projectId ? `${APP_URL}/desk/${projectId}` : undefined;

      // Get applicant profile for personalization
      const { data: applicantProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', applicantUserId)
        .maybeSingle();

      // Email (resolved server-side via userId)
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'application-status-update',
          recipientUserId: applicantUserId,
          idempotencyKey: `app-status-${gigId}-${applicantUserId}-${newStatus}`,
          templateData: {
            applicantName: applicantProfile?.full_name || 'there',
            gigTitle,
            gigUrl,
            projectUrl,
            status: newStatus,
          },
        },
      }).catch((err) => console.error('[notifyApplicantStatusChange] email dispatch failed:', err));

      // Push only — the in-app row is written server-side by
      // accept_application_and_create_studio / notify_application_status
      // (a direct client insert here is silently rejected by
      // notifications' RLS — see HIRE_LOOP_AUDIT.md).
      const { sendPushNotification } = await import('@/lib/pushNotifications');
      const titleMap = {
        accepted: "You're hired! 🎉",
        shortlisted: "You've been shortlisted ⭐",
        rejected: 'Application update',
      } as const;
      const bodyMap = {
        accepted: `You got the gig: ${gigTitle}`,
        shortlisted: `You made the shortlist for: ${gigTitle}`,
        rejected: `The poster chose someone else for: ${gigTitle}`,
      } as const;
      await sendPushNotification({
        userId: applicantUserId,
        title: titleMap[newStatus],
        body: bodyMap[newStatus],
        type: 'opportunity',
        link: newStatus === 'accepted' && projectId ? `/desk/${projectId}` : `/opportunity/${gigId}`,
        // The in-app row is always written server-side now — accepted via
        // accept_application_and_create_studio, shortlisted/rejected via
        // notify_application_status.
        skipInApp: true,
      });
    } catch (err) {
      console.error('[notifyApplicantStatusChange] failed:', err);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    const applicant = applicants.find(a => a.id === applicationId);
    const opp = opportunities.find(o => o.id === selectedOppId);

    // Canonical acceptance: one atomic server-side step
    // (authorize -> create Studio -> grant access -> single deduped notification)
    if (newStatus === 'accepted') {
      const { data, error } = await supabase.rpc('accept_application_and_create_studio', {
        _application_id: applicationId,
      });
      const result = data as
        | { success: boolean; error?: string; project_id?: string; studio_created?: boolean }
        | null;

      if (error || !result?.success) {
        toast.error(
          result?.error === 'not_authorized'
            ? "You can't accept applicants on this opportunity"
            : 'Failed to accept applicant — nothing was changed. Try again.',
        );
        return;
      }

      setApplicants(prev =>
        prev.map(a => (a.id === applicationId ? { ...a, status: newStatus } : a)),
      );

      // Side-channels (email + push) are best-effort and only fire on the
      // first successful acceptance, so retries never double-notify.
      if (result.studio_created && applicant && opp) {
        notifyApplicantStatusChange(
          applicant.applicant_id,
          'accepted',
          opp.title,
          opp.id,
          result.project_id,
        ).catch(() => {});
      }

      toast.success(
        result.studio_created
          ? `Application accepted! Studio "${opp?.title ?? ''}" created.`
          : 'Already accepted — opening the existing Studio.',
        {
          action: {
            label: 'Open Studio',
            onClick: () => navigate(`/desk/${result.project_id}`),
          },
        },
      );
      return;
    }

    const { error } = await supabase
      .from('applications')
      .update({ status: newStatus })
      .eq('id', applicationId);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    setApplicants(prev => prev.map(a => 
      a.id === applicationId ? { ...a, status: newStatus } : a
    ));

    // Notify on shortlist / reject — in-app leg via RPC (a direct client
    // insert is rejected by notifications' RLS), email/push leg client-side.
    if ((newStatus === 'shortlisted' || newStatus === 'rejected') && applicant && opp) {
      supabase.rpc('notify_application_status', { _application_id: applicationId, _status: newStatus })
        .then(({ error: notifyError }) => {
          if (notifyError) console.error('[notify_application_status] failed:', notifyError);
        });
      notifyApplicantStatusChange(applicant.applicant_id, newStatus, opp.title, opp.id).catch(() => {});
    }

    toast.success(`Application ${newStatus}`);
  };

  const getMatchBadge = (score?: number) => {
    if (!score) return null;
    if (score >= 80) return <Badge className="bg-primary text-primary-foreground"><Star className="w-3 h-3 mr-1" />Perfect Match</Badge>;
    if (score >= 70) return <Badge className="bg-accent text-accent-foreground">Great Match</Badge>;
    if (score >= 60) return <Badge variant="outline" className="border-primary/50 text-primary">Good Match</Badge>;
    return <Badge variant="secondary">Fair Match</Badge>;
  };

  const renderApplicantCard = (applicant: Applicant) => (
    <ApplicantCard
      key={applicant.id}
      applicant={applicant}
      getMatchBadge={getMatchBadge}
      onStatusChange={updateApplicationStatus}
      navigate={navigate}
    />
  );

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Skeleton className="h-10 w-64 mb-4" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card className="border-border/60 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Opportunities Posted</h3>
            <p className="text-muted-foreground mb-4">
              Create your first opportunity to start receiving applications
            </p>
            <PostOpportunityDialog
              open={showPostDialog}
              onOpenChange={setShowPostDialog}
              onSuccess={() => {
                fetchOpportunities();
                setShowPostDialog(false);
              }}
              trigger={
                <Button>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Post Opportunity
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedOpp = opportunities.find(o => o.id === selectedOppId);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 -ml-2 mb-3 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => navigate('/manage-opportunities')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Gig Manager
      </Button>

      <div className="mb-4 space-y-1">
        <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">
          Applicant Review
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">
          Applicants
        </h1>
        <p className="text-sm text-muted-foreground">
          Review and manage applications for this opportunity
        </p>
      </div>
      <div className="mb-6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="mb-6 flex flex-col sm:flex-row gap-2">
        <Select value={selectedOppId || undefined} onValueChange={handleOpportunityChange}>
          <SelectTrigger className="w-full md:w-96">
            <SelectValue placeholder="Select opportunity" />
          </SelectTrigger>
          <SelectContent>
            {opportunities.map(opp => (
              <SelectItem key={opp.id} value={opp.id}>
                {opp.title} ({opp.applications_count} applications)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedOppId && (
          <Button
            variant="outline"
            onClick={() => setEditingOpportunityId(selectedOppId)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {selectedOpp && (
        <>
          {/* Dashboard Tab Toggle */}
          <div className="mb-4 inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card">
            <button
              type="button"
              onClick={() => setDashboardTab('applicants')}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                dashboardTab === 'applicants'
                  ? "bg-background text-[hsl(var(--energy))] shadow-sm ring-1 ring-[hsl(var(--energy))]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Applicants
            </button>
            <button
              type="button"
              onClick={() => setDashboardTab('analytics')}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                dashboardTab === 'analytics'
                  ? "bg-background text-[hsl(var(--energy))] shadow-sm ring-1 ring-[hsl(var(--energy))]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
              {!isPro && <Crown className="w-3 h-3 text-primary" />}
            </button>
          </div>

          {dashboardTab === 'analytics' ? (
            <OpportunityAnalytics
              userId={user!.id}
              isPro={isPro}
              opportunities={opportunities}
              selectedOppId={selectedOppId}
            />
          ) : (
          <>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">{selectedOpp.title}</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span>{applicants.length} total</span>
                <span>·</span>
                <span>{applicants.filter(a => a.status === 'shortlisted').length} shortlisted</span>
                <span>·</span>
                <span>{applicants.filter(a => a.status === 'accepted').length} accepted</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isPro ? (
                <div className="flex rounded-md border border-input overflow-hidden">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('pipeline')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="opacity-60"
                  onClick={() => toast.info('Upgrade to Pro for Pipeline view')}
                >
                  <LayoutGrid className="w-4 h-4 mr-1" />
                  Pipeline
                  <Crown className="w-3 h-3 ml-1 text-primary" />
                </Button>
              )}
              <Select value={sortBy} onValueChange={(v) => {
                setSortBy(v as 'date' | 'score');
                setApplicants(prev => [...prev].sort((a, b) => 
                  v === 'score' 
                    ? (b.ai_match_score || 0) - (a.ai_match_score || 0)
                    : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ));
              }}>
                <SelectTrigger className="w-36">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="score">By Match Score</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={analyzeWithAI}
                disabled={analyzingAI || applicants.length === 0}
                variant={isPro ? 'default' : 'outline'}
                className="w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {analyzingAI ? 'Ranking...' : isPro ? 'Re-rank Smart Match' : 'Smart Match Score'}
              </Button>
            </div>
          </div>

          {/* Top Pick Card - Pro only */}
          {isPro && applicants.length > 0 && applicants[0].ai_match_score ? (
            <Card className="mb-6 rounded-xl border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 shadow-none">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">Top Pick</p>
                  <p className="text-base font-bold truncate">{applicants[0].full_name}</p>
                  <p className="text-xs text-muted-foreground">{applicants[0].role} · {applicants[0].ai_match_score}% match</p>
                </div>
                <Button size="sm" onClick={() => navigate(`/profile/${applicants[0].applicant_id}`)}>
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
              </CardContent>
            </Card>
          ) : !isPro && applicants.length > 0 ? (
            <FreeTierGate
              feature="aiApplicantRankings"
              featureLabel="Smart Applicant Ranking"
              description="Upgrade to Pro for unlimited Smart applicant ranking, match scores, and shortlisting."
            >
              <Card className="mb-6 rounded-xl border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 shadow-none">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">Top Pick</p>
                    <p className="text-base font-bold">{applicants[0]?.full_name || "Applicant"}</p>
                    <p className="text-xs text-muted-foreground">{applicants[0]?.role || "Creator"} · {applicants[0]?.ai_match_score || 0}% match</p>
                  </div>
                </CardContent>
              </Card>
            </FreeTierGate>
          ) : null}
        </>
      )}

      {selectedOpp?.type === 'casting' && (
        <CompBoard
          applicants={applicants as any}
          onStatusChange={updateApplicationStatus}
        />
      )}

      {viewMode === 'pipeline' && isPro ? (
        <ApplicantPipeline
          applicants={applicants}
          onStatusChange={updateApplicationStatus}
        />
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All ({applicants.length})</TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({applicants.filter(a => a.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="shortlisted">
              Shortlisted ({applicants.filter(a => a.status === 'shortlisted').length})
            </TabsTrigger>
            <TabsTrigger value="accepted">
              Accepted ({applicants.filter(a => a.status === 'accepted').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-4">
              {applicants.map(renderApplicantCard)}
            </div>
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <div className="grid gap-4">
              {applicants.filter(a => a.status === 'pending').map(renderApplicantCard)}
            </div>
          </TabsContent>

          <TabsContent value="shortlisted" className="mt-6">
            <div className="grid gap-4">
              {applicants.filter(a => a.status === 'shortlisted').map(renderApplicantCard)}
              {applicants.filter(a => a.status === 'shortlisted').length === 0 && (
                <p className="text-center text-muted-foreground py-8">No shortlisted applicants yet. Use AI ranking to find the best matches.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="accepted" className="mt-6">
            <div className="grid gap-4">
              {applicants.filter(a => a.status === 'accepted').map(renderApplicantCard)}
            </div>
          </TabsContent>
        </Tabs>
      )}
      </>
      )}

      {editingOpportunityId && (
        <EditOpportunityDialog
          opportunityId={editingOpportunityId}
          open={!!editingOpportunityId}
          onOpenChange={(open) => !open && setEditingOpportunityId(null)}
          onSuccess={() => {
            fetchOpportunities();
            setEditingOpportunityId(null);
          }}
        />
      )}
    </div>
  );
};

export default OpportunityDashboard;

import { supabase as supabaseClient } from "@/integrations/supabase/client";

// ── Applicant Card with expandable cover letter ──
const ApplicantCard = ({
  applicant,
  getMatchBadge,
  onStatusChange,
  navigate,
}: {
  applicant: Applicant;
  getMatchBadge: (score?: number) => React.ReactNode;
  onStatusChange: (id: string, status: string) => Promise<void>;
  navigate: (path: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { starting: callStarting, session: callSession, open: callOpen, setOpen: setCallOpen, start: startCall, myName } = useStartDirectCall();

  const handleInterview = () => {
    void startCall(applicant.applicant_id, applicant.full_name, {
      context: "gig-interview",
      errorTitle: "Couldn't start interview",
    });
  };

  const handleMessage = async () => {
    // Ensure a bidirectional connection exists so the conversation shows in inbox
    try {
      const userId = (await supabaseClient.auth.getUser()).data.user?.id;
      if (userId) {
        const { data: existing } = await supabaseClient
          .from('connections')
          .select('id')
          .or(`and(user_id.eq.${userId},connected_user_id.eq.${applicant.applicant_id}),and(user_id.eq.${applicant.applicant_id},connected_user_id.eq.${userId})`)
          .eq('status', 'accepted')
          .maybeSingle();

        if (!existing) {
          await supabaseClient
            .from('connections')
            .upsert({
              user_id: userId,
              connected_user_id: applicant.applicant_id,
              status: 'accepted',
            }, { onConflict: 'user_id,connected_user_id' });
        }
      }
    } catch (err) {
      console.error('[ApplicantCard] Connection ensure failed:', err);
    }
    navigate(`/messages?user=${applicant.applicant_id}`);
  };

  return (
    <Card className="rounded-xl border-border/60 shadow-none hover:border-primary/30 transition-all">
      <CardHeader>
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar
            className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 cursor-pointer"
            onClick={() => navigate(`/profile/${applicant.applicant_id}`)}
          >
            <AvatarImage src={applicant.avatar_url} />
            <AvatarFallback>{applicant.full_name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-1">
              <div className="min-w-0">
                <CardTitle
                  className="text-base sm:text-lg truncate cursor-pointer hover:underline"
                  onClick={() => navigate(`/profile/${applicant.applicant_id}`)}
                >
                  {applicant.full_name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{applicant.role}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  Applied {formatDistanceToNow(new Date(applicant.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {getMatchBadge(applicant.ai_match_score)}
                <Badge variant={
                  applicant.status === 'accepted' ? 'default' :
                  applicant.status === 'rejected' ? 'destructive' :
                  applicant.status === 'shortlisted' ? 'outline' : 'secondary'
                } className={applicant.status === 'shortlisted' ? 'border-primary text-primary' : ''}>
                  {applicant.status}
                </Badge>
              </div>
            </div>

            {applicant.ai_match_score && (
              <div className="mb-2 p-2 bg-muted/50 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Smart Match: {applicant.ai_match_score}%</span>
                </div>
                {applicant.match_reasons && (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {applicant.match_reasons.map((reason, i) => (
                      <li key={i}>• {reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Cover Letter — expandable */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">Cover Letter</p>
              {applicant.cover_letter && applicant.cover_letter.length > 200 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 text-muted-foreground"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? "Less" : "Read more"}
                </Button>
              )}
            </div>
            <p className={`text-sm text-muted-foreground whitespace-pre-line ${expanded ? '' : 'line-clamp-3'}`}>
              {applicant.cover_letter || 'No cover letter provided.'}
            </p>
          </div>

          {/* Portfolio Links */}
          {applicant.portfolio_links && applicant.portfolio_links.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Portfolio</p>
              <div className="flex flex-wrap gap-2">
                {applicant.portfolio_links.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {new URL(link).hostname.replace('www.', '')}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rate & Availability */}
          <div className="flex flex-wrap gap-3 text-sm">
            {applicant.expected_rate && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span>{applicant.expected_rate}</span>
              </div>
            )}
            {applicant.availability && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{applicant.availability}</span>
              </div>
            )}
          </div>

          {/* Professional Skills */}
          {applicant.professional_skills && applicant.professional_skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {applicant.professional_skills.slice(0, 6).map((skill: any, i) => {
                const label = typeof skill === 'string' ? skill : (skill?.skill || skill?.name || skill?.label || '');
                if (!label) return null;
                return <Badge key={i} variant="secondary" className="text-[10px]">{label}</Badge>;
              })}
              {applicant.professional_skills.length > 6 && (
                <Badge variant="secondary" className="text-[10px]">+{applicant.professional_skills.length - 6}</Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => navigate(`/profile/${applicant.applicant_id}`)}
            >
              <Eye className="w-3 h-3 mr-1" />
              Profile
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={handleMessage}
            >
              <Mail className="w-3 h-3 mr-1" />
              Message
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={handleInterview}
              disabled={callStarting}
              title="Start a quick video interview"
            >
              {callStarting ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Video className="w-3 h-3 mr-1" />
              )}
              Interview
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setShareOpen(true)}
              title="Share this profile with the client"
            >
              <Share2 className="w-3 h-3 mr-1" />
              Share
            </Button>
            {(applicant.status === 'pending' || applicant.status === 'shortlisted') && (
              <>
                {applicant.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => onStatusChange(applicant.id, 'shortlisted')}
                  >
                    <Star className="w-3 h-3 mr-1" />
                    Shortlist
                  </Button>
                )}
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => onStatusChange(applicant.id, 'accepted')}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs"
                  onClick={() => onStatusChange(applicant.id, 'rejected')}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
      <ShareProfileDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        profile={{
          full_name: applicant.full_name,
          role: applicant.role,
          user_id: applicant.applicant_id,
          avatar_url: applicant.avatar_url,
          professional_skills: (applicant.professional_skills || []).map((s: any) =>
            typeof s === 'string' ? s : (s?.skill || s?.name || s?.label || '')
          ).filter(Boolean),
        }}
      />
      <VideoCallSheet
        open={callOpen}
        onOpenChange={setCallOpen}
        projectName={`Interview with ${applicant.full_name}`}
        roomUrl={callSession?.roomUrl ?? null}
        token={callSession?.token ?? null}
        callId={callSession?.callId ?? null}
        userName={myName}
        directCallId={callSession?.callId ?? null}
        roomName={callSession?.roomName ?? null}
      />
    </Card>
  );
};
