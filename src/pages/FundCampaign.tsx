import { useState } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Clock, Users, Target, Loader2, Heart, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCampaignBySlug, useCampaignTiers, useCreatePledge } from "@/hooks/useThriveFund";
import { TrustPanel } from "@/components/thrivefund/TrustPanel";
import { ShareToMessageDialog } from "@/components/messages/ShareToMessageDialog";
import { APP_URL } from "@/lib/constants";
import { toast } from "sonner";

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);

const daysLeft = (deadline: string) => {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const FundCampaign = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { data: campaign, isLoading } = useCampaignBySlug(slug);
  const { data: tiers } = useCampaignTiers(campaign?.id);
  const pledgeMut = useCreatePledge();

  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold">Campaign not found</h1>
        <Button onClick={() => navigate("/fund")} className="mt-4">
          Browse campaigns
        </Button>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((campaign.total_raised / campaign.goal_amount) * 100));
  const days = daysLeft(campaign.deadline);
  const isLive = campaign.status === "active" && days > 0;

  const openPledge = (tierId: string | null, tierAmount?: number) => {
    if (!user) {
      navigate(`/auth?redirect=/fund/${slug}`);
      return;
    }
    setSelectedTier(tierId);
    setAmount(tierAmount ? String(tierAmount) : "25");
    setPledgeOpen(true);
  };

  const submitPledge = async () => {
    if (!campaign) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      const { url } = await pledgeMut.mutateAsync({
        campaignId: campaign.id,
        tierId: selectedTier,
        amount: amt,
        isAnonymous: anonymous,
        backerMessage: message.trim() || undefined,
      });
      if (url) window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Pledge failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{campaign.title} · ThriveFund</title>
        <meta name="description" content={campaign.tagline || campaign.title} />
        <meta property="og:title" content={campaign.title} />
        <meta property="og:description" content={campaign.tagline || campaign.title} />
        {campaign.cover_image_url && (
          <meta property="og:image" content={campaign.cover_image_url} />
        )}
        <link rel="canonical" href={`https://www.kretopia.com/fund/${campaign.slug}`} />
      </Helmet>

      {params.get("pledge") === "success" && (
        <div className="bg-success/10 border-b border-success/20 py-3 px-4 text-center text-sm font-medium">
          Pledge confirmed! Your card will only be charged if the campaign reaches its goal.
        </div>
      )}

      {!user && isLive && (
        <div className="bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 border-b border-primary/20 py-3 px-4">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-medium">
              <span className="text-primary">New here?</span>{" "}
              <span className="text-muted-foreground">Create a free account to back this campaign — no charge unless it funds.</span>
            </p>
            <Button size="sm" onClick={() => navigate(`/auth?redirect=/fund/${slug}`)} className="gap-1">
              <Heart className="h-3.5 w-3.5" />
              Sign up to back
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-muted border border-border/60">
              {campaign.cover_image_url ? (
                <img
                  src={campaign.cover_image_url}
                  alt={campaign.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Target className="h-16 w-16 text-primary/60" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {campaign.category && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm bg-card/80 border-border text-muted-foreground mb-2">
                      {campaign.category}
                    </span>
                  )}
                  <h1 className="text-3xl md:text-4xl font-black tracking-[-0.03em] leading-[1.05]">{campaign.title}</h1>
                  {campaign.tagline && (
                    <p className="text-base md:text-lg text-muted-foreground mt-2">{campaign.tagline}</p>
                  )}
                </div>
                <div className="shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)} className="gap-2 rounded-full">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
            </div>

            {campaign.story && (
              <Card className="p-5 rounded-2xl border-border/60 shadow-none">
                <h2 className="text-lg font-black tracking-tight mb-2">About this campaign</h2>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{campaign.story}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card className="p-5 rounded-2xl border-border/60 shadow-none">
              <div className="space-y-1">
                <p className="text-3xl font-black tracking-[-0.02em] text-primary">
                  {formatCurrency(campaign.total_raised, campaign.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  pledged of {formatCurrency(campaign.goal_amount, campaign.currency)} goal
                </p>
              </div>
              <Progress value={pct} className="h-2 mt-3" />
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <Stat value={`${pct}%`} label="Funded" />
                <Stat value={String(campaign.backer_count)} label="Backers" icon={Users} />
                <Stat value={String(days)} label={days === 1 ? "Day left" : "Days left"} icon={Clock} />
              </div>

              <Button
                size="lg"
                className="w-full mt-5 gap-2"
                onClick={() => openPledge(null)}
                disabled={!isLive}
              >
                <Heart className="h-4 w-4" />
                {isLive ? "Back this project" : campaign.status === "funded" ? "Funded" : "Closed"}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground mt-2">
                All-or-nothing: charged only if goal is met
              </p>
            </Card>

            <TrustPanel creatorId={campaign.creator_id} />

            {tiers && tiers.length > 0 && (
              <Card className="p-5 rounded-2xl border-border/60 shadow-none">
                <h3 className="text-lg font-black tracking-tight mb-3">Pledge tiers</h3>
                <div className="space-y-3">
                  {tiers.map((t) => {
                    const soldOut = t.max_backers && t.claimed_count >= t.max_backers;
                    return (
                      <button
                        key={t.id}
                        onClick={() => !soldOut && openPledge(t.id, t.amount)}
                        disabled={!isLive || !!soldOut}
                        className="btn-glass btn-glass-outline w-full text-left p-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-baseline justify-between">
                          <p className="font-bold text-primary">
                            {formatCurrency(t.amount, campaign.currency)}+
                          </p>
                          {t.max_backers && (
                            <span className="text-[10px] text-muted-foreground">
                              {soldOut
                                ? "Sold out"
                                : `${t.max_backers - t.claimed_count} left`}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm mt-1">{t.title}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                            {t.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={pledgeOpen} onOpenChange={setPledgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Back {campaign.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pledge amount (USD)</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Note to creator (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Cheering you on!"
                maxLength={500}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={anonymous}
                onCheckedChange={(v) => setAnonymous(!!v)}
                id="anon"
              />
              <span className="text-sm">Pledge anonymously</span>
            </label>
            <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-xl p-3">
              Your card is authorized now but only charged if the campaign reaches its goal by the
              deadline. Kretopia takes a 5% platform fee on funded campaigns.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPledgeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPledge} disabled={pledgeMut.isPending} className="gap-2">
              {pledgeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareToMessageDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        contentType="campaign"
        contentId={campaign.id}
        contentMeta={{
          title: campaign.title,
          subtitle: campaign.tagline || undefined,
          image_url: campaign.cover_image_url,
        }}
        externalUrl={`${APP_URL}/share/fund/${campaign.slug}/`}
        externalText={`💜 Back "${campaign.title}" on ThriveFund\n${APP_URL}/share/fund/${campaign.slug}/`}
      />
    </div>
  );
};

const Stat = ({ value, label, icon: Icon }: { value: string; label: string; icon?: any }) => (
  <div className="bg-card/80 border border-border/60 rounded-xl p-2 backdrop-blur-sm">
    {Icon && <Icon className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />}
    <p className="font-bold text-sm">{value}</p>
    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
  </div>
);

export default FundCampaign;
