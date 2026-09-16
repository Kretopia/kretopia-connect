import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Briefcase, Users, CheckCircle2, Clock, BarChart3, 
  Plus, ArrowRight, Crown, DollarSign, FileText
} from "lucide-react";
import { FreeTierGate } from "@/components/FreeTierGate";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { AITalentSuggestions } from "./AITalentSuggestions";

interface HiringStats {
  jobsPosted: number;
  activeJobs: number;
  applicationsReceived: number;
  activeHires: number;
  completedHires: number;
}

export function CompanyHiringDashboard() {
  const { user, subscriptionInfo } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<HiringStats>({
    jobsPosted: 0, activeJobs: 0, applicationsReceived: 0,
    activeHires: 0, completedHires: 0,
  });
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isPro = hasProAccess(subscriptionInfo.tier as any);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const [oppsRes, appsRes, projectsRes] = await Promise.all([
        supabase.from('opportunities').select('id, status').eq('created_by', user.id),
        supabase.from('applications').select('id, status, created_at, applicant_id, opportunity_id').order('created_at', { ascending: false }).limit(10),
        supabase.from('projects').select('id, status').eq('created_by', user.id),
      ]);

      const opps = oppsRes.data || [];
      const myOppIds = opps.map(o => o.id);
      const apps = (appsRes.data || []).filter(a => myOppIds.includes(a.opportunity_id));
      const projects = projectsRes.data || [];

      setStats({
        jobsPosted: opps.length,
        activeJobs: opps.filter(o => o.status === 'open').length,
        applicationsReceived: apps.length,
        activeHires: projects.filter(p => p.status === 'active').length,
        completedHires: projects.filter(p => p.status === 'completed').length,
      });
      setRecentApps(apps.slice(0, 5));
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  const statCards = [
    { label: "Jobs Posted", value: stats.jobsPosted, icon: Briefcase, gradient: "from-primary to-accent" },
    { label: "Active Jobs", value: stats.activeJobs, icon: Clock, gradient: "from-accent to-secondary" },
    { label: "Applications", value: stats.applicationsReceived, icon: FileText, gradient: "from-secondary to-primary" },
    { label: "Active Hires", value: stats.activeHires, icon: Users, gradient: "from-primary to-secondary" },
    { label: "Completed", value: stats.completedHires, icon: CheckCircle2, gradient: "from-accent to-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/opportunities')} className="gap-2">
          <Plus className="h-4 w-4" /> Post a Job
        </Button>
        <Button variant="outline" onClick={() => navigate('/manage-opportunities')} className="gap-2">
          <Briefcase className="h-4 w-4" /> Manage Jobs
        </Button>
        <Button variant="outline" onClick={() => navigate('/thrivepay?tab=earnings')} className="gap-2">
          <DollarSign className="h-4 w-4" /> Payments
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${s.gradient} text-primary-foreground`}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold">{loading ? "–" : s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* AI Talent Suggestions - Pro Feature */}
      <FreeTierGate feature="aiApplicantRankings" featureLabel="Smart Talent Finder" description="Upgrade to Pro to unlock Smart talent matching — instantly find the best creators for your projects.">
        <AITalentSuggestions />
      </FreeTierGate>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Applications</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/manage-opportunities')} className="gap-1 text-xs">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentApps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No applications yet. Post a job to start receiving applications!
            </p>
          ) : (
            <div className="space-y-3">
              {recentApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Application #{app.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={app.status === 'hired' ? 'success' : app.status === 'shortlisted' ? 'default' : 'secondary'}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics - Pro Only */}
      <FreeTierGate feature="aiApplicantRankings" featureLabel="Hiring Analytics" description="Upgrade to Pro for full hiring analytics, applicant tracking, and smart talent insights.">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Hiring Analytics
              {!isPro && <Badge variant="outline" className="text-xs gap-1"><Crown className="h-3 w-3" /> Pro</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold text-primary">{stats.applicationsReceived > 0 ? Math.round((stats.activeHires / Math.max(stats.applicationsReceived, 1)) * 100) : 0}%</div>
                <div className="text-xs text-muted-foreground mt-1">Hire Rate</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <div className="text-2xl font-bold text-primary">{stats.jobsPosted > 0 ? Math.round(stats.applicationsReceived / stats.jobsPosted) : 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Avg. Apps/Job</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FreeTierGate>
    </div>
  );
}
