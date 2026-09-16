import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, DollarSign, Clock, Briefcase, Share2, CheckCircle2, XCircle, UserPlus, ArrowLeft, Bookmark, BookmarkCheck, Gift, ArrowRightLeft, ArrowRight, Instagram, Music, Youtube, Edit, Copy, Trash2, PauseCircle, PlayCircle, Loader2, MoreVertical, Radar, Mail, Shield, Globe, Lock, Calendar, Megaphone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Helmet } from "react-helmet-async";
import { ApplyToOpportunityDialog } from "@/components/ApplyToOpportunityDialog";
import { EditOpportunityDialog } from "@/components/EditOpportunityDialog";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { SEO } from "@/components/SEO";
import { APP_URL } from "@/lib/constants";
import { ShareToMessageDialog } from "@/components/messages/ShareToMessageDialog";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";

interface Opportunity {
  id: string;
  title: string;
  type: string;
  description: string;
  compensation: string;
  location: string;
  requirements: string;
  skills: string[];
  deliverables: string;
  duration: string;
  tags: string[];
  status: string;
  image_url: string;
  created_at: string;
  claim_status?: string | null;
  claim_token?: string | null;
  source_platform?: string | null;
  original_source_text?: string | null;
  barter_offering?: string | null;
  barter_requesting?: string | null;
  platform_requirements?: string[] | null;
  min_followers?: number | null;
  content_deliverables?: any;
  created_by?: string;
  scouted_by?: string;
  usage_type?: string | null;
  usage_territory?: string | null;
  usage_duration?: string | null;
  usage_exclusive?: boolean | null;
  barter_gifted_value_usd?: number | null;
  barter_posting_deadline?: string | null;
  whitelisting_allowed?: boolean | null;
}

const OpportunityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [myApplication, setMyApplication] = useState<{ id: string; status: string } | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = user && (opportunity?.created_by === user.id || opportunity?.scouted_by === user.id);
  const isScoutedGig = Boolean(
    opportunity && (
      opportunity.scouted_by ||
      opportunity.claim_token ||
      opportunity.claim_status ||
      opportunity.source_platform ||
      opportunity.original_source_text
    )
  );
  const canShareClaimLink = Boolean(
    user &&
    opportunity?.claim_status !== 'claimed' &&
    isScoutedGig &&
    (opportunity?.scouted_by === user.id || opportunity?.created_by === user.id)
  );

  const handleShareClaimLink = async () => {
    try {
      if (!opportunity) return;

      let claimToken = opportunity.claim_token;

      if (!claimToken) {
        claimToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

        const { error } = await supabase
          .from('opportunities')
          .update({
            claim_token: claimToken,
            claim_status: opportunity.claim_status ?? 'unclaimed',
          } as any)
          .eq('id', opportunity.id);

        if (error) throw error;

        setOpportunity({
          ...opportunity,
          claim_token: claimToken,
          claim_status: opportunity.claim_status ?? 'unclaimed',
        });
      }

      const claimUrl = `${APP_URL}/claim-gig/${claimToken}`;
      const shareText = `Hey! I listed your gig on Kretopia so creatives can find and apply directly. Claim it here to manage applicants, message talent, and fill the role faster:\n\n${claimUrl}`;

      if (navigator.share) {
        await navigator.share({ title: "Claim your gig on Kretopia", text: shareText, url: claimUrl });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      toast({ title: "Claim link copied!", description: "Send it to the person who posted this gig" });
    } catch {
      try {
        if (!opportunity?.claim_token) throw new Error('missing claim token');

        const claimUrl = `${APP_URL}/claim-gig/${opportunity.claim_token}`;
        const shareText = `Hey! I listed your gig on Kretopia so creatives can find and apply directly. Claim it here to manage applicants, message talent, and fill the role faster:\n\n${claimUrl}`;
        await navigator.clipboard.writeText(shareText);
        toast({ title: "Claim link copied!", description: "Send it to the person who posted this gig" });
      } catch {
        if (!opportunity?.claim_token) {
          toast({ title: "Couldn't prepare claim link", description: "Please try again.", variant: "destructive" });
          return;
        }

        const claimUrl = `${APP_URL}/claim-gig/${opportunity.claim_token}`;
        const shareText = `Hey! I listed your gig on Kretopia so creatives can find and apply directly. Claim it here to manage applicants, message talent, and fill the role faster:\n\n${claimUrl}`;
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast({ title: "Claim link copied!", description: "Send it to the person who posted this gig" });
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!opportunity) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ status: newStatus } as any)
        .eq('id', opportunity.id);
      if (error) throw error;
      setOpportunity({ ...opportunity, status: newStatus });
      const labels: Record<string, string> = { active: "Reopened", closed: "Closed", paused: "Paused", filled: "Marked as Filled" };
      toast({ title: labels[newStatus] || "Updated", description: `Gig is now ${newStatus}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!opportunity || !user) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .insert({
          created_by: user.id,
          title: `${opportunity.title} (Copy)`,
          type: opportunity.type,
          description: opportunity.description,
          compensation: opportunity.compensation,
          location: opportunity.location,
          requirements: opportunity.requirements,
          skills: opportunity.skills,
          deliverables: opportunity.deliverables,
          duration: opportunity.duration,
          tags: opportunity.tags,
          image_url: opportunity.image_url,
          status: 'active',
          barter_offering: opportunity.barter_offering,
          barter_requesting: opportunity.barter_requesting,
          platform_requirements: opportunity.platform_requirements,
          min_followers: opportunity.min_followers,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      toast({ title: "Duplicated!", description: "Opening your new copy..." });
      navigate(`/opportunity/${data.id}`);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!opportunity) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunity.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Gig removed permanently" });
      navigate('/desk');
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const fetchData = async () => {
    if (!user) {
      const { data, error } = await supabase
        .from('opportunities')
        .select(OPPORTUNITY_PUBLIC_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching opportunity:', error);
      } else {
        setOpportunity(data);
      }
      setLoading(false);
      return;
    }

    const [oppResult, savedResult, appResult] = await Promise.all([
      supabase.from('opportunities').select(OPPORTUNITY_PUBLIC_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('saved_opportunities').select('id').eq('user_id', user.id).eq('opportunity_id', id).maybeSingle(),
      supabase.from('applications').select('id, status').eq('applicant_id', user.id).eq('opportunity_id', id).maybeSingle(),
    ]);

    if (oppResult.error) {
      console.error('Error fetching opportunity:', oppResult.error);
    } else {
      setOpportunity(oppResult.data);
    }
    
    setIsSaved(!!savedResult.data);
    setMyApplication(appResult.data ? { id: appResult.data.id, status: appResult.data.status } : null);
    setLoading(false);
  };

  // Auto-open apply dialog after signup redirect
  useEffect(() => {
    if (!user || !id) return;
    const pendingApply = sessionStorage.getItem('pending_apply_opportunity');
    if (pendingApply === id) {
      sessionStorage.removeItem('pending_apply_opportunity');
      // Small delay to let opportunity data load first
      const timer = setTimeout(() => setShowApplyDialog(true), 500);
      return () => clearTimeout(timer);
    }
  }, [user, id]);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        await fetchData();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [id, user]);

  // Track view (deduplicated per session)
  useEffect(() => {
    if (!id) return;
    const sessionKey = `opp_viewed_${id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    supabase
      .from("opportunity_views")
      .insert({ opportunity_id: id, viewer_id: user?.id ?? null })
      .then(({ error }) => {
        if (error) console.error("View tracking error:", error);
      });
  }, [id, user?.id]);

  const handleShare = () => {
    setShowShareDialog(true);
    import("@/lib/deckMetrics").then(({ trackDeckEvent }) =>
      trackDeckEvent("opportunity_share_opened", "opportunity", { opportunity_id: id, surface: "share_dialog" }),
    );
  };

  const handleApply = () => {
    if (!user) {
      // Store intent to auto-apply after signup
      sessionStorage.setItem('pending_apply_opportunity', id!);
      navigate(`/auth?redirect=/opportunity/${id}`);
    } else {
      setShowApplyDialog(true);
    }
  };

  const handleWithdraw = async () => {
    if (!myApplication) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', myApplication.id);
      if (error) throw error;
      setMyApplication(null);
      toast({ title: 'Application withdrawn', description: 'You can re-apply anytime while the gig is open.' });
    } catch (err: any) {
      toast({ title: 'Failed to withdraw', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
      setShowWithdrawConfirm(false);
    }
  };

  const handleMessageOwner = () => {
    if (!opportunity?.created_by) return;
    if (!user) {
      navigate(`/auth?redirect=/opportunity/${id}`);
      return;
    }
    navigate(`/messages?user=${opportunity.created_by}`);
  };

  const handleBookmark = async () => {
    if (!user) {
      navigate(`/auth?redirect=/opportunity/${id}`);
      return;
    }

    if (isSaved) {
      // Remove bookmark
      const { error } = await supabase
        .from('saved_opportunities')
        .delete()
        .eq('user_id', user.id)
        .eq('opportunity_id', id);
      
      if (!error) {
        setIsSaved(false);
        toast({
          title: "Removed from saved",
          description: "Opportunity removed from your bookmarks",
        });
      }
    } else {
      // Add bookmark
      const { error } = await supabase
        .from('saved_opportunities')
        .insert({
          user_id: user.id,
          opportunity_id: id,
        });
      
      if (!error) {
        setIsSaved(true);
        toast({
          title: "Saved!",
          description: "Opportunity added to your bookmarks",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading gig details...</p>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <XCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Gig Not Found</h2>
          <p className="text-muted-foreground mb-4">This gig may have been removed or doesn't exist.</p>
          <Link to="/">
            <Button>Go to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isActive = opportunity.status === 'active';

  return (
    <div className="min-h-screen p-4 md:p-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-32">
      <SEO
        title={`${opportunity.title} — Gig on Kretopia`}
        description={opportunity.description?.slice(0, 155) || `${opportunity.type} gig: ${opportunity.title}`}
        type="article"
        image={opportunity.image_url || undefined}
        url={`https://www.kretopia.com/opportunity/${opportunity.id}`}
      />
      <Helmet>
        <link rel="canonical" href={`https://www.kretopia.com/opportunity/${opportunity.id}`} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": opportunity.title,
            "description": opportunity.description || "",
            "datePosted": opportunity.created_at,
            "employmentType": opportunity.type === "Paid" ? "CONTRACTOR" : "VOLUNTEER",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "Kretopia",
              "sameAs": "https://www.kretopia.com"
            },
            ...(opportunity.location ? { "jobLocation": { "@type": "Place", "address": opportunity.location } } : {}),
            ...(opportunity.compensation ? { "baseSalary": { "@type": "MonetaryAmount", "currency": "USD", "value": opportunity.compensation } } : {}),
            "industry": "Creative Industries",
            "url": `https://www.kretopia.com/opportunity/${opportunity.id}`,
            ...(opportunity.image_url ? { "image": opportunity.image_url } : {})
          })}
        </script>
      </Helmet>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 -ml-2 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <div className="flex gap-2">
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {opportunity.status === 'active' && (
                    <>
                      <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
                        <PauseCircle className="h-4 w-4 mr-2" /> Pause Gig
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange('filled')}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Filled
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
                        <XCircle className="h-4 w-4 mr-2" /> Close Gig
                      </DropdownMenuItem>
                    </>
                  )}
                  {(opportunity.status === 'closed' || opportunity.status === 'paused' || opportunity.status === 'filled') && (
                    <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                      <PlayCircle className="h-4 w-4 mr-2" /> Reopen Gig
                    </DropdownMenuItem>
                  )}
                  {canShareClaimLink && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleShareClaimLink}>
                        <Radar className="h-4 w-4 mr-2" /> Share Claim Link
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="icon" onClick={handleBookmark}>
              {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </Button>
            <SocialShareButtons
              url={`/opportunity/${opportunity.id}`}
              socialUrl={`/share/gig/${opportunity.id}/`}
              title={`${opportunity.title} — ${opportunity.type} gig on Kretopia`}
              description={opportunity.description?.slice(0, 100)}
            />
          </div>
        </div>

        {/* Status Badge */}
        {opportunity.status !== 'active' && (
          <div className="mb-4 rounded-lg bg-muted p-4 text-center">
            <Badge variant="secondary">
              {opportunity.status === 'closed' && 'Campaign Ended'}
              {opportunity.status === 'paused' && 'Paused'}
              {opportunity.status === 'filled' && 'Position Filled'}
              {!['closed', 'paused', 'filled'].includes(opportunity.status) && opportunity.status}
            </Badge>
            {isOwner && (
              <Button variant="link" size="sm" className="ml-2" onClick={() => handleStatusChange('active')}>
                Reopen
              </Button>
            )}
          </div>
        )}

        {/* Image */}
        {opportunity.image_url && (
          <div className="mb-6 aspect-video w-full overflow-hidden rounded-2xl border">
            <img
              src={opportunity.image_url}
              alt={opportunity.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Content Card */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-none">
          {/* Title and Type */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))] border-[hsl(var(--energy)/0.35)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))]" />
                {opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05]">{opportunity.title}</h1>
          </div>

          {/* Meta Info */}
          <div className="mb-6 flex flex-wrap gap-2 text-sm">
            {opportunity.location && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-card/80 border border-border px-2.5 py-1 backdrop-blur-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {opportunity.location}
              </div>
            )}
            {opportunity.compensation && (
              <div className={`inline-flex items-center gap-1.5 rounded-full bg-card/80 border border-border px-2.5 py-1 backdrop-blur-sm font-semibold text-foreground ${!user ? 'relative' : ''}`}>
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                {user ? (
                  <span>{opportunity.compensation}</span>
                ) : (
                  <span className="blur-sm select-none" aria-hidden>$2,500 - $5,000</span>
                )}
                {!user && (
                  <button onClick={() => navigate(`/auth?redirect=/opportunity/${id}`)} className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">Sign up to see</span>
                  </button>
                )}
              </div>
            )}
            {opportunity.duration && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-card/80 border border-border px-2.5 py-1 backdrop-blur-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {opportunity.duration}
              </div>
            )}
          </div>

          {/* Tags */}
          {opportunity.tags && opportunity.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {opportunity.tags.map((tag, index) => (
                <Badge key={index} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Barter Exchange Section */}
          {opportunity.type === 'barter' && (opportunity.barter_offering || opportunity.barter_requesting) && (
            <div className="mb-6 rounded-xl border-2 border-dashed border-primary bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-primary dark:text-primary">The Exchange</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {opportunity.barter_offering && (
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Gift className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-primary dark:text-primary uppercase tracking-wide">What You Get</span>
                    </div>
                    <p className="text-sm font-medium">{opportunity.barter_offering}</p>
                  </div>
                )}
                {opportunity.barter_requesting && (
                  <div className="rounded-lg bg-background p-3 border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-primary dark:text-primary uppercase tracking-wide">What They Need</span>
                    </div>
                    <p className="text-sm font-medium">{opportunity.barter_requesting}</p>
                  </div>
                )}
              </div>
              {/* Platform requirements */}
              {opportunity.platform_requirements && opportunity.platform_requirements.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Platforms:</span>
                  <div className="flex gap-1.5">
                    {opportunity.platform_requirements.map(p => (
                      <Badge key={p} variant="outline" className="text-[11px] capitalize gap-1">
                        {p === 'instagram' && <Instagram className="h-3 w-3" />}
                        {p === 'tiktok' && <Music className="h-3 w-3" />}
                        {p === 'youtube' && <Youtube className="h-3 w-3" />}
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {opportunity.min_followers && (
                <div className="mt-2">
                  <Badge variant="secondary" className="text-xs">
                    Min. {opportunity.min_followers >= 1000 ? `${(opportunity.min_followers / 1000).toFixed(0)}k` : opportunity.min_followers}+ followers required
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Structured barter terms */}
          {opportunity.type === 'barter' && (opportunity.barter_gifted_value_usd || opportunity.barter_posting_deadline || opportunity.whitelisting_allowed) && (
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {opportunity.barter_gifted_value_usd != null && (
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Gifted Value</div>
                  <div className="text-sm font-semibold mt-1">${Number(opportunity.barter_gifted_value_usd).toLocaleString()}</div>
                </div>
              )}
              {opportunity.barter_posting_deadline && (
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Post by</div>
                  <div className="text-sm font-semibold mt-1">{new Date(opportunity.barter_posting_deadline).toLocaleDateString()}</div>
                </div>
              )}
              {opportunity.whitelisting_allowed && (
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Megaphone className="h-3 w-3" />Whitelisting</div>
                  <div className="text-sm font-semibold mt-1">Allowed</div>
                </div>
              )}
            </div>
          )}

          {/* Usage Rights */}
          {(opportunity.usage_type || opportunity.usage_territory || opportunity.usage_duration || opportunity.usage_exclusive) && (
            <div className="mb-6 rounded-xl border-2 border-dashed border-amber-300 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h2 className="text-lg font-semibold">Usage Rights</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {opportunity.usage_type && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Usage</div>
                    <div className="text-sm font-medium capitalize">{opportunity.usage_type.replace(/_/g, ' ')}</div>
                  </div>
                )}
                {opportunity.usage_territory && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />Territory</div>
                    <div className="text-sm font-medium capitalize">{opportunity.usage_territory}</div>
                  </div>
                )}
                {opportunity.usage_duration && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Duration</div>
                    <div className="text-sm font-medium">{opportunity.usage_duration.replace(/_/g, ' ')}</div>
                  </div>
                )}
              </div>
              {opportunity.usage_exclusive && (
                <div className="mt-3">
                  <Badge variant="outline" className="gap-1 text-xs"><Lock className="h-3 w-3" />Exclusive — no competing brands during the term</Badge>
                </div>
              )}
            </div>
          )}
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-semibold">Description</h2>
            <p className="whitespace-pre-line text-muted-foreground">{opportunity.description}</p>
          </div>

          {/* Requirements */}
          {opportunity.requirements && (
            <div className="mb-6">
              <h2 className="mb-2 text-xl font-semibold">Requirements</h2>
              <p className="whitespace-pre-line text-muted-foreground">{opportunity.requirements}</p>
            </div>
          )}

          {/* Skills */}
          {opportunity.skills && opportunity.skills.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-xl font-semibold">Skills Needed</h2>
              <div className="flex flex-wrap gap-2">
                {opportunity.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {opportunity.deliverables && (
            <div className="mb-6">
              <h2 className="mb-2 text-xl font-semibold">Deliverables</h2>
              <p className="whitespace-pre-line text-muted-foreground">{opportunity.deliverables}</p>
            </div>
          )}

          {/* Apply / Status block */}
          {isOwner ? (
            <Button size="lg" variant="outline" className="w-full" onClick={() => navigate(`/opportunity-dashboard?opportunity=${opportunity.id}`)}>
              <Briefcase className="h-4 w-4 mr-2" />
              Manage Applicants
            </Button>
          ) : isActive ? (
            !user ? (
              <Button
                size="lg"
                variant="gradient"
                className="w-full"
                onClick={() => {
                  sessionStorage.setItem('pending_apply_opportunity', id!);
                  navigate(`/auth?redirect=/opportunity/${id}`);
                }}
              >
                <UserPlus className="h-4 w-4" />
                Sign Up to Apply — Free
              </Button>
            ) : myApplication ? (
              <div className="space-y-2">
                <div className="rounded-xl border bg-muted/40 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {myApplication.status === 'accepted' && "You're hired 🎉"}
                        {myApplication.status === 'shortlisted' && "You're shortlisted ⭐"}
                        {myApplication.status === 'rejected' && 'Not selected this time'}
                        {!['accepted','shortlisted','rejected'].includes(myApplication.status) && 'Application submitted'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {myApplication.status === 'pending' && 'The poster will review your application shortly.'}
                        {myApplication.status === 'shortlisted' && 'Stay tuned — they may reach out soon.'}
                        {myApplication.status === 'accepted' && 'Open Messages or your project workspace.'}
                        {myApplication.status === 'rejected' && 'Plenty more gigs await — keep applying.'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={myApplication.status === 'rejected' ? 'destructive' : myApplication.status === 'accepted' ? 'default' : 'secondary'} className="shrink-0 capitalize">
                    {myApplication.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full" onClick={handleMessageOwner}>
                    <Mail className="h-4 w-4 mr-2" />
                    Message Poster
                  </Button>
                  {(myApplication.status === 'pending' || myApplication.status === 'shortlisted') ? (
                    <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setShowWithdrawConfirm(true)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Withdraw
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={() => navigate('/opportunities')}>
                      Browse More Gigs
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={handleApply}>
                Apply Now
              </Button>
            )
          ) : (
            <Button size="lg" className="w-full" disabled>
              {opportunity.status === 'filled' ? 'Position Filled' : opportunity.status === 'paused' ? 'Paused' : 'Closed'}
            </Button>
          )}
        </div>
      </div>

      {/* Apply Dialog */}
      {opportunity && (
        <ApplyToOpportunityDialog 
          open={showApplyDialog}
          onOpenChange={setShowApplyDialog}
          opportunityId={opportunity.id}
          opportunityTitle={opportunity.title}
          opportunityDescription={opportunity.description}
        />
      )}
      {opportunity && showEditDialog && (
        <EditOpportunityDialog
          opportunityId={opportunity.id}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={() => {
            fetchData();
            setShowEditDialog(false);
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this gig?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the gig and all applications. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw Confirmation */}
      <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw your application?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your application from the poster's queue. You can re-apply anytime while the gig is still open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep application</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {opportunity && (
        <ShareToMessageDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          contentType="gig"
          contentId={opportunity.id}
          contentMeta={{
            title: opportunity.title,
            subtitle: [opportunity.location, opportunity.compensation].filter(Boolean).join(" · "),
            image_url: opportunity.image_url,
          }}
          externalUrl={`${APP_URL}/share/gig/${opportunity.id}/`}
          externalText={`🎯 ${opportunity.title}\n\nApply now on Kretopia — the Creative OS 👇\n${APP_URL}/share/gig/${opportunity.id}/`}
        />
      )}
    </div>
  );
};

export default OpportunityDetail;
