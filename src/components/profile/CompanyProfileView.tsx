import { useState, useEffect } from "react";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { Building2, MapPin, Users, Star, Award, Gift, Briefcase, Edit, Share2, QrCode, MessageCircle, Settings, ChevronRight, ExternalLink, Calendar, Clock, Image as ImageIcon, UserPlus, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaveCompanyReviewDialog } from "./LeaveCompanyReviewDialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { FeatureLockedBanner } from "@/components/FeatureLockedBanner";
import { BrandPassportHero } from "./BrandPassportHero";

interface CompanyReview {
  id: string;
  reviewer_name: string;
  reviewer_avatar: string;
  rating: number;
  review_text: string;
  created_at: string;
  response_text?: string;
}

interface PartnerDiscount {
  id: string;
  discount_type: string;
  discount_value: string;
  description: string;
  redemption_code?: string;
}

interface CompanyProfileViewProps {
  profile: any;
  reviews: CompanyReview[];
  partnerDiscounts?: PartnerDiscount[];
  isOwnProfile: boolean;
  isPro?: boolean;
  onLeaveReview?: () => void;
  onRefresh?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
}

export const CompanyProfileView = ({
  profile,
  reviews,
  partnerDiscounts,
  isOwnProfile,
  isPro = false,
  onLeaveReview,
  onRefresh,
  onEdit,
  onShare,
}: CompanyProfileViewProps) => {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [companyStats, setCompanyStats] = useState({ 
    oppsPosted: 0, 
    activeJobs: 0, 
    talentsHired: 0, 
    completedHires: 0,
    avgResponseDays: 0 
  });

  useEffect(() => {
    const fetchOpportunities = async () => {
      const { data } = await supabase
        .from('opportunities')
        .select(OPPORTUNITY_PUBLIC_COLUMNS)
        .eq('created_by', profile.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);
      setOpportunities(data || []);
      setLoadingOpps(false);
    };

    const fetchStats = async () => {
      // Total opps posted
      const { count: oppsCount } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', profile.user_id);

      // Active jobs
      const { count: activeCount } = await supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', profile.user_id)
        .eq('status', 'active');

      // Talents hired (accepted applications)
      const { data: ownOpps } = await supabase
        .from('opportunities')
        .select('id')
        .eq('created_by', profile.user_id);

      let talentsHired = 0;
      let completedHires = 0;
      if (ownOpps && ownOpps.length > 0) {
        const oppIds = ownOpps.map(o => o.id);
        const { count: hiredCount } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .in('opportunity_id', oppIds)
          .eq('status', 'accepted');
        talentsHired = hiredCount || 0;
        
        const { count: completedCount } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .in('opportunity_id', oppIds)
          .in('status', ['completed', 'accepted']);
        completedHires = completedCount || 0;
      }

      setCompanyStats({ 
        oppsPosted: oppsCount || 0, 
        activeJobs: activeCount || 0,
        talentsHired, 
        completedHires,
        avgResponseDays: talentsHired > 0 ? 2 : 0 // placeholder
      });
    };

    const fetchTeamMembers = async () => {
      const teamIds = profile.team_member_ids;
      if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) return;
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role')
        .in('user_id', teamIds);
      setTeamMembers(data || []);
    };

    if (profile.user_id) {
      fetchOpportunities();
      fetchStats();
      fetchTeamMembers();
    }
  }, [profile.user_id, profile.team_member_ids]);

  const displayName = profile.company_name || profile.full_name;
  const displayLogo = profile.company_logo_url || profile.avatar_url;

  return (
    <div className="min-h-screen pb-24 sm:pb-20 md:pb-6 bg-background">
      {/* max-w-6xl, not the Tailwind `container` class this used to carry —
          this project's own `container` config (tailwind.config.ts) only
          sets a max-width at the 2xl (1400px) breakpoint, so below that it
          was effectively just `width:100%` and the real cap was the
          separate `max-w-3xl` sitting right next to it: a 768px-wide
          column on any screen, centered with a wide margin on BOTH sides
          rather than using the page. Same fix, same target width, as
          BrandWorkHome's own "spans the whole page" pass earlier today. */}
      <div className="mx-auto px-3 sm:px-4 md:px-6 max-w-6xl pt-4 sm:pt-6">

        {/* Brand Passport — the Brand-account equivalent of the creator's
            Passport card (same HoloCard shell, same section grammar),
            replacing the old plain cover+name+meta header. Own-profile only
            in practice: CompanyProfileView is never mounted with
            isOwnProfile=false today (ViewProfile.tsx doesn't render it for
            other users' profiles), so there's no viewer-mode action set to
            preserve here. */}
        <div className="mb-6">
          <BrandPassportHero
            profile={profile}
            stats={companyStats}
            opportunities={opportunities}
            teamMembers={teamMembers}
            reviewCount={reviews.length}
            onEdit={onEdit ?? (() => {})}
            onShare={onShare ?? (() => {})}
          />
        </div>

        {!isOwnProfile && (
          <div className="flex justify-end mb-4">
            <LeaveCompanyReviewDialog
              companyId={profile.user_id}
              companyName={displayName}
              onReviewSubmitted={onRefresh}
            />
          </div>
        )}

        {/* === TABBED CONTENT === */}
        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-auto p-0 gap-0">
            <TabsTrigger value="about" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-1 text-sm">
              About
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-1 text-sm">
              Gigs{opportunities.length > 0 && ` (${opportunities.length})`}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-1 text-sm">
              Reviews{reviews.length > 0 && ` (${reviews.length})`}
            </TabsTrigger>
            {partnerDiscounts && partnerDiscounts.length > 0 && (
              <TabsTrigger value="perks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-1 text-sm">
                Perks
              </TabsTrigger>
            )}
          </TabsList>

          {/* --- ABOUT TAB --- */}
          <TabsContent value="about" className="space-y-6 mt-0">
            {profile.company_about && (
              <div>
                <h2 className="text-lg font-semibold mb-2">About</h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{profile.company_about}</p>
              </div>
            )}

            {/* Company Stats - visible to all */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{companyStats.oppsPosted}</p>
                  <p className="text-xs text-muted-foreground">Jobs Posted</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{companyStats.activeJobs}</p>
                  <p className="text-xs text-muted-foreground">Active Jobs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{companyStats.talentsHired}</p>
                  <p className="text-xs text-muted-foreground">Creators Hired</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{reviews.length}</p>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{profile.average_rating?.toFixed(1) || '—'}</p>
                  <p className="text-xs text-muted-foreground">Avg Rating</p>
                </CardContent>
              </Card>
            </div>

            {/* Team Members - Pro only */}
            {isPro && teamMembers.length > 0 ? (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Team Members
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {teamMembers.map((member) => (
                    <Link
                      key={member.user_id}
                      to={`/profile/${member.user_id}`}
                      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-primary/30 transition-colors"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback>{member.full_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : isPro && teamMembers.length === 0 && isOwnProfile ? (
              <div className="text-center py-6 border rounded-xl">
                <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Add team members in your profile settings to showcase your team.</p>
              </div>
            ) : !isPro && isOwnProfile ? (
              <FeatureLockedBanner
                feature="Team Showcase"
                tier="pro"
                description="Highlight your team members on your company page."
              />
            ) : null}

            {/* Gallery */}
            {profile.company_images && Array.isArray(profile.company_images) && profile.company_images.length > 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(profile.company_images as string[]).slice(1).map((url: string, i: number) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer group">
                      <img
                        src={url}
                        alt={`${displayName} ${i + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onClick={() => window.open(url, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!profile.company_about && (!profile.company_images || profile.company_images.length <= 1) && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {isOwnProfile ? "Add details about your company to attract top talent." : "No company details yet."}
                </p>
                {isOwnProfile && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-1.5" /> Add Company Info
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* --- OPPORTUNITIES TAB --- */}
          <TabsContent value="opportunities" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active Listings</h2>
              {isOwnProfile && (
                <Button size="sm" onClick={() => navigate('/opportunities')} className="gap-1.5">
                  <Briefcase className="h-4 w-4" /> Post New
                </Button>
              )}
            </div>

            {loadingOpps ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {isOwnProfile ? "Post your first opportunity to start hiring talent." : "No active listings right now."}
                </p>
                {isOwnProfile && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/opportunities')}>
                    Post Opportunity
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    to={`/opportunity/${opp.id}`}
                    className="block p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">{opp.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                          {opp.category && <Badge variant="secondary" className="text-xs">{opp.category}</Badge>}
                          {opp.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {opp.location}
                            </span>
                          )}
                          {opp.budget && (
                            <span className="font-medium text-foreground">{opp.budget}</span>
                          )}
                        </div>
                        {opp.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{opp.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* --- REVIEWS TAB --- */}
          <TabsContent value="reviews" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Talent Reviews</h2>
              {!isOwnProfile && (
                <LeaveCompanyReviewDialog
                  companyId={profile.user_id}
                  companyName={displayName}
                  onReviewSubmitted={onRefresh}
                />
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {isOwnProfile ? "Reviews from talent you've worked with will appear here." : "No reviews yet. Be the first to leave a review!"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="p-4 rounded-xl border bg-card">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={review.reviewer_avatar} />
                        <AvatarFallback>{review.reviewer_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm">{review.reviewer_name}</p>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-sm leading-relaxed">{review.review_text}</p>

                        {review.response_text && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs font-medium text-primary mb-1">Response from {displayName}</p>
                            <p className="text-sm text-muted-foreground">{review.response_text}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* --- PERKS TAB --- */}
          {partnerDiscounts && partnerDiscounts.length > 0 && (
            <TabsContent value="perks" className="space-y-4 mt-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" /> Member Benefits
              </h2>
              {partnerDiscounts.map((discount) => (
                <div key={discount.id} className="p-4 rounded-xl border bg-card">
                  <Badge variant="secondary" className="mb-2">
                    {discount.discount_type === "percentage" ? "%" : "$"} {discount.discount_value}
                  </Badge>
                  <p className="font-medium">{discount.description}</p>
                  {discount.redemption_code && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Promo Code</p>
                      <code className="text-sm font-mono font-bold">{discount.redemption_code}</code>
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};
