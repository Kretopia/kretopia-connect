import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, Calendar, CheckCircle2, Clock, AlertCircle, CreditCard, Send, Users, Loader2, AlertTriangle } from "lucide-react";
// XP system removed
import { analytics } from "@/lib/analytics";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { EmptyState } from "@/components/ui/empty-state";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  // undefined when the viewer isn't authorized to see this milestone's
  // money -- see get_project_milestone_financials / useProjectData.ts.
  amount: number | undefined;
  status: string;
  due_date: string | null;
  paid_to: string | null;
  paid_at: string | null;
  created_at: string;
  payment_intent_id: string | null;
  escrow_status: string;
}

interface MilestoneBoardProps {
  milestones: Milestone[];
  projectId: string;
  onUpdate: () => void;
  userRole: 'creator' | 'client';
  collaborators?: Array<{ id: string; full_name: string }>;
  projectOwnerId?: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-500/10 text-yellow-600' },
  in_progress: { label: 'In Progress', icon: AlertCircle, color: 'bg-primary/10 text-primary' },
  review: { label: 'In Review', icon: AlertCircle, color: 'bg-primary/10 text-primary' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-500/10 text-green-600' },
  paid: { label: 'Paid', icon: DollarSign, color: 'bg-emerald-500/10 text-emerald-600' },
};

export function MilestoneBoard({ milestones, projectId, onUpdate, userRole, collaborators = [], projectOwnerId }: MilestoneBoardProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [getPaidDialogOpen, setGetPaidDialogOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [getPaidLoading, setGetPaidLoading] = useState(false);
  const [getPaidEmail, setGetPaidEmail] = useState('');
  const [getPaidName, setGetPaidName] = useState('');
  const [getPaidMessage, setGetPaidMessage] = useState('');
  const [talentConnectActive, setTalentConnectActive] = useState<boolean | null>(null);
  const [payingMilestoneId, setPayingMilestoneId] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    description: '',
    amount: '',
    due_date: ''
  });
  const { toast } = useToast();
  const { guard: guardMilestone, remaining: milestonesRemaining, cap: milestonesCap } = useFeatureGate("milestones");

  // Check the talent's (non-owner collaborator) Stripe Connect status — soft-gate on Pay
  useEffect(() => {
    if (userRole !== 'client') return;
    const talent = collaborators.find(c => c.id !== projectOwnerId);
    if (!talent) { setTalentConnectActive(null); return; }
    supabase
      .from('profiles')
      .select('stripe_account_status')
      .eq('user_id', talent.id)
      .maybeSingle()
      .then(({ data }) => {
        setTalentConnectActive(data?.stripe_account_status === 'active');
      });
  }, [userRole, collaborators, projectOwnerId]);

  const handleCreateMilestone = async () => {
    if (!newMilestone.title.trim() || !newMilestone.amount) {
      toast({ title: "Error", description: "Title and amount are required", variant: "destructive" });
      return;
    }
    if (!guardMilestone()) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        created_by: user?.id,
        title: newMilestone.title,
        description: newMilestone.description || null,
        amount: parseFloat(newMilestone.amount),
        due_date: newMilestone.due_date || null,
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Milestone created!" });
      analytics.milestoneCreated(projectId, parseFloat(newMilestone.amount));
      // Notify the talent
      try {
        const talent = collaborators.find(c => c.id !== projectOwnerId);
        if (talent) {
          const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).single();
          await supabase.from('notifications').insert({
            user_id: talent.id,
            title: 'New milestone created',
            message: `A $${parseFloat(newMilestone.amount).toFixed(2)} milestone "${newMilestone.title}" was added to ${project?.title || 'your project'}.`,
            type: 'project',
            category: 'project',
            priority: 'normal',
            link: `/desk/${projectId}?tab=finance`,
            action_url: `/desk/${projectId}?tab=finance`,
            action_text: 'View milestone',
          });
        }
      } catch (e) { console.error('notify create milestone failed', e); }
      setNewMilestone({ title: '', description: '', amount: '', due_date: '' });
      setCreateDialogOpen(false);
      onUpdate();
    }
  };

  const handleStatusChange = async (milestoneId: string, newStatus: string) => {
    // Routed through a validated RPC rather than a direct client UPDATE —
    // status is one of the columns a raw write must never reach directly
    // (it's how a milestone could be self-attested 'paid'), so every
    // non-payment transition goes through update_milestone_workflow_status,
    // which hard-rejects 'paid' and checks real project authorization
    // server-side instead of trusting this component's own state.
    const { data, error: rpcError } = await supabase.rpc('update_milestone_workflow_status', {
      _milestone_id: milestoneId,
      _status: newStatus,
    });
    const result = data as { success?: boolean; error?: string } | null;
    const error = rpcError || (result && result.success !== true ? new Error(result.error || 'Update failed') : null);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      analytics.milestoneStatusChange(projectId, milestoneId, newStatus);
      if (newStatus === 'completed') {
        toast({ title: "Milestone completed!" });
      } else {
        toast({ title: "Milestone updated!" });
      }
      // Notify the other party of status changes
      try {
        const milestone = milestones.find(m => m.id === milestoneId);
        const { data: { user } } = await supabase.auth.getUser();
        const recipientId = userRole === 'creator' ? projectOwnerId : collaborators.find(c => c.id !== projectOwnerId)?.id;
        if (recipientId && user && milestone) {
          const labelMap: Record<string, string> = {
            in_progress: 'started work on',
            review: 'submitted for review:',
            completed: 'marked as completed:',
            paid: 'marked as paid:',
          };
          await supabase.from('notifications').insert({
            user_id: recipientId,
            title: newStatus === 'review' ? 'Milestone ready for review' : 'Milestone updated',
            message: `${labelMap[newStatus] || 'updated'} "${milestone.title}"`,
            type: 'project',
            category: 'project',
            priority: newStatus === 'review' ? 'high' : 'normal',
            link: `/desk/${projectId}?tab=finance`,
            action_url: `/desk/${projectId}?tab=finance`,
            action_text: 'Open milestone',
          });
        }
      } catch (e) { console.error('notify status change failed', e); }
      onUpdate();
    }
  };

  const handleMarkAsPaid = async (milestoneId: string) => {
    // Only the paying client/project owner may confirm this — enforced
    // server-side (see migration 20260812120000_close_self_verification_rls_gaps.sql),
    // not just any project collaborator, which the raw update this replaced
    // used to allow.
    const { error } = await supabase.rpc('confirm_milestone_paid_offline', {
      p_milestone_id: milestoneId,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment recorded!" });
      // Milestone completion -> project status. Mirrors the same
      // all-paid check the payment edge functions run server-side; this
      // is the client-triggered "Mark Paid (offline)" path, so it isn't
      // covered by either of those.
      try {
        const { data: allMilestones } = await supabase
          .from('milestones')
          .select('status')
          .eq('project_id', projectId);
        const allPaid = !!allMilestones?.length && allMilestones.every((m) => m.status === 'paid');
        if (allPaid) {
          const { data: proj } = await supabase.from('projects').select('status').eq('id', projectId).maybeSingle();
          if (proj?.status === 'active') {
            await supabase.from('projects').update({ status: 'completed' }).eq('id', projectId);
          }
        }
      } catch (syncErr) {
        console.error('project status sync failed', syncErr);
      }
      onUpdate();
    }
  };

  const handleStripePayment = async (milestone: Milestone, useEscrow: boolean = false) => {
    // Guard against double-clicks / two tabs racing to create two Stripe
    // sessions for the same milestone -- the server (create-milestone-
    // payment) is the authoritative check, this just avoids the obvious
    // case of a single impatient click firing the request twice.
    if (payingMilestoneId === milestone.id) return;
    setPayingMilestoneId(milestone.id);
    try {
      // Track the attempt
      if (useEscrow) {
        analytics.milestoneEscrowAttempt(projectId, milestone.id, milestone.amount);
      } else {
        analytics.milestonePaymentAttempt(projectId, milestone.id, milestone.amount);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Error", description: "Please sign in to make a payment", variant: "destructive" });
        return;
      }

      toast({ title: useEscrow ? "Creating escrow payment..." : "Creating payment session..." });

      const { data, error } = await supabase.functions.invoke('create-milestone-payment', {
        body: {
          milestoneId: milestone.id,
          amount: milestone.amount,
          title: milestone.title,
          projectId: projectId,
          useEscrow: useEscrow,
        },
      });

      if (error) throw error;

      // Open Stripe checkout in new tab
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({ title: useEscrow ? "Escrow payment window opened!" : "Payment window opened! 💳" });
      }
    } catch (error: any) {
      console.error('Error creating payment:', error);
      // supabase-js throws non-2xx edge function responses as an error whose
      // body (our { error: "..." } message) lives on error.context, not on
      // the resolved data -- extract it so "already paid" is actually shown
      // instead of a generic "non-2xx status code" message.
      let description = error?.message || "Failed to create payment session";
      try {
        const body = await error?.context?.json?.();
        if (body?.error) description = body.error;
      } catch { /* fall back to error.message above */ }
      toast({ title: "Can't process payment", description, variant: "destructive" });
      if (description.toLowerCase().includes("already been paid")) onUpdate();
    } finally {
      setPayingMilestoneId(null);
    }
  };

  const handleCapturePayment = async (milestone: Milestone) => {
    try {
      analytics.milestoneEscrowRelease(projectId, milestone.id, milestone.amount);

      if (!milestone.payment_intent_id) {
        toast({ title: "Error", description: "No payment to capture", variant: "destructive" });
        return;
      }

      toast({ title: "Releasing escrow funds..." });

      const { data, error } = await supabase.functions.invoke('capture-milestone-payment', {
        body: {
          paymentIntentId: milestone.payment_intent_id,
          action: 'capture',
          milestoneId: milestone.id,
        },
      });

      if (error) throw error;

      toast({ title: "Funds released!", description: "Payment has been transferred to the creator." });
      onUpdate();
    } catch (error: any) {
      console.error('Error capturing payment:', error);
      toast({ title: "Error", description: error.message || "Failed to capture payment", variant: "destructive" });
    }
  };

  const handleCancelPayment = async (milestone: Milestone) => {
    try {
      analytics.milestoneEscrowRefund(projectId, milestone.id);

      if (!milestone.payment_intent_id) {
        toast({ title: "Error", description: "No payment to cancel", variant: "destructive" });
        return;
      }

      toast({ title: "Cancelling escrow payment..." });

      const { data, error } = await supabase.functions.invoke('capture-milestone-payment', {
        body: {
          paymentIntentId: milestone.payment_intent_id,
          action: 'cancel',
          milestoneId: milestone.id,
        },
      });

      if (error) throw error;

      toast({ title: "Escrow cancelled", description: "Funds have been refunded." });
      onUpdate();
    } catch (error: any) {
      console.error('Error cancelling payment:', error);
      toast({ title: "Error", description: error.message || "Failed to cancel payment", variant: "destructive" });
    }
  };

  // Batch payout handler
  const batchPayableMilestones = milestones.filter(m => 
    (m.status === 'completed' && m.escrow_status === 'none' && !m.paid_at) ||
    (m.escrow_status === 'authorized' && m.payment_intent_id && m.status === 'review')
  );

  const handleBatchPayout = async () => {
    if (batchPayableMilestones.length === 0) return;
    try {
      setBatchLoading(true);
      const { data, error } = await supabase.functions.invoke('batch-milestone-payout', {
        body: {
          projectId,
          milestoneIds: batchPayableMilestones.map(m => m.id),
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({ title: "Batch checkout opened! 💳", description: `${data.summary?.checkoutItems || 0} milestone(s) ready for payment` });
      }

      if (data?.summary?.captured > 0) {
        toast({ title: `${data.summary.captured} escrow payment(s) released!` });
        onUpdate();
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Batch payout failed", variant: "destructive" });
    } finally {
      setBatchLoading(false);
    }
  };

  // Send "Get Paid" link handler
  const handleSendGetPaidLink = async () => {
    if (!getPaidEmail.trim()) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    try {
      setGetPaidLoading(true);
      const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).single();
      
      const { data, error } = await supabase.functions.invoke('send-get-paid-link', {
        body: {
          recipientEmail: getPaidEmail,
          recipientName: getPaidName,
          projectId,
          projectTitle: project?.title || 'Project',
          message: getPaidMessage,
        },
      });

      if (error) throw error;

      toast({ 
        title: "Get Paid link sent!", 
        description: data?.emailSent 
          ? `Sent to ${getPaidEmail}` 
          : data?.notificationSent 
            ? 'In-app notification sent' 
            : 'Link sent' 
      });
      setGetPaidDialogOpen(false);
      setGetPaidEmail('');
      setGetPaidName('');
      setGetPaidMessage('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send link", variant: "destructive" });
    } finally {
      setGetPaidLoading(false);
    }
  };

  // Number(m.amount || 0), not Number(m.amount): amount is undefined for
  // any milestone this viewer isn't authorized to see the money for (a
  // role='client'/'guest' collaborator -- see get_project_milestone_financials
  // and useProjectData.ts) -- without the fallback, Number(undefined) is
  // NaN and poisons every total on the page, not just that one milestone.
  const totalAmount = milestones.reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const paidAmount = milestones.filter(m => m.status === 'paid').reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <div className="p-4 space-y-4">
      {userRole === 'client' && talentConnectActive === false && collaborators.find(c => c.id !== projectOwnerId) && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Creator hasn't set up payouts yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You can still create milestones, but payments will fail until they connect their payout account. Send them a Get Paid link below.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setGetPaidDialogOpen(true)} className="shrink-0">
            Send link
          </Button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Milestones & Payments</h3>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-muted-foreground">
              Total: <span className="font-semibold text-foreground">${totalAmount.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">
              Paid: <span className="font-semibold text-green-600">${paidAmount.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">
              Pending: <span className="font-semibold text-yellow-600">${pendingAmount.toFixed(2)}</span>
            </span>
          </div>
        </div>
        {userRole === 'client' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Batch Pay All */}
            {batchPayableMilestones.length > 1 && (
              <Button
                size="sm"
                variant="default"
                onClick={handleBatchPayout}
                disabled={batchLoading}
                className="gap-2"
              >
                {batchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                Pay All ({batchPayableMilestones.length}) — ${batchPayableMilestones.reduce((s, m) => s + Number(m.amount || 0), 0).toFixed(2)}
              </Button>
            )}

            {/* Invite to Get Paid */}
            <Dialog open={getPaidDialogOpen} onOpenChange={setGetPaidDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Send className="h-4 w-4" />
                  Invite to Get Paid
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send "Get Paid" Link</DialogTitle>
                  <DialogDescription>
                    Invite a creator to set up their payment account so you can pay them — takes less than 2 minutes for them.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Creator's Email *</Label>
                    <Input
                      type="email"
                      value={getPaidEmail}
                      onChange={(e) => setGetPaidEmail(e.target.value)}
                      placeholder="creator@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Their Name (optional)</Label>
                    <Input
                      value={getPaidName}
                      onChange={(e) => setGetPaidName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Personal Message (optional)</Label>
                    <Textarea
                      value={getPaidMessage}
                      onChange={(e) => setGetPaidMessage(e.target.value)}
                      placeholder="Hey! Set up your account so I can pay you for our project work."
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSendGetPaidLink} disabled={getPaidLoading} className="gap-2">
                    {getPaidLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send Link
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* New Milestone */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Milestone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Milestone</DialogTitle>
                  <DialogDescription>Set up project milestones with payment amounts</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={newMilestone.title}
                      onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                      placeholder="Milestone title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newMilestone.description}
                      onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                      placeholder="Milestone details and deliverables"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (USD) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newMilestone.amount}
                      onChange={(e) => setNewMilestone({ ...newMilestone, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newMilestone.due_date}
                      onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleCreateMilestone} className="w-full">Create Milestone</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {milestones.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            eyebrow="Get paid in chunks"
            title="No milestones yet"
            description={userRole === 'client'
              ? "Split the budget into milestones so funds release as work ships — protected by escrow."
              : "Once your client sets up milestones, payments and progress will track here."}
          />
        ) : (
          milestones.map((milestone) => {
            const statusConfig = STATUS_CONFIG[milestone.status as keyof typeof STATUS_CONFIG];
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={milestone.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center gap-2">
                       <h4 className="font-semibold">{milestone.title}</h4>
                       <Badge className={statusConfig.color}>
                         <StatusIcon className="h-3 w-3 mr-1" />
                         {statusConfig.label}
                       </Badge>
                       {milestone.escrow_status === 'authorized' && (
                         <Badge variant="secondary" className="bg-primary text-primary">
                           Escrow Secured
                         </Badge>
                       )}
                       {milestone.escrow_status === 'captured' && (
                         <Badge variant="secondary" className="bg-green-100 text-green-700">
                           ✓ Escrow Released
                         </Badge>
                       )}
                     </div>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                    )}
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {milestone.amount == null ? "—" : `$${Number(milestone.amount).toFixed(2)}`}
                      </span>
                      {milestone.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(milestone.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {milestone.paid_at && (
                        <span className="text-green-600 font-medium">
                          Paid on {new Date(milestone.paid_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                   <div className="flex flex-col gap-2">
                     {milestone.status !== 'paid' && (
                       <>
                         {/* Pending - Creator starts work */}
                         {userRole === 'creator' && milestone.status === 'pending' && (
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => handleStatusChange(milestone.id, 'in_progress')}
                           >
                             Start Work
                           </Button>
                         )}

                         {/* Pending - Client can secure with escrow */}
                         {userRole === 'client' && milestone.status === 'pending' && milestone.escrow_status === 'none' && (
                           <Button
                             size="sm"
                             onClick={() => handleStripePayment(milestone, true)}
                             className="gap-2"
                           >
                             Secure with Escrow
                           </Button>
                         )}

                         {/* In Progress - Creator submits for review */}
                         {userRole === 'creator' && milestone.status === 'in_progress' && (
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => handleStatusChange(milestone.id, 'review')}
                           >
                             Submit for Review
                           </Button>
                         )}

                         {/* Review - Client can approve or request changes */}
                         {userRole === 'client' && milestone.status === 'review' && (
                           <>
                             {milestone.escrow_status === 'authorized' ? (
                               <>
                                 <Button
                                   size="sm"
                                   onClick={() => handleCapturePayment(milestone)}
                                   className="gap-2"
                                 >
                                   ✓ Approve & Release ${Number(milestone.amount).toFixed(2)}
                                 </Button>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => handleCancelPayment(milestone)}
                                 >
                                   ✕ Reject & Refund
                                 </Button>
                               </>
                             ) : (
                               <>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => handleStatusChange(milestone.id, 'in_progress')}
                                 >
                                   Request Changes
                                 </Button>
                                 <Button
                                   size="sm"
                                   onClick={() => handleStatusChange(milestone.id, 'completed')}
                                 >
                                   Approve
                                 </Button>
                               </>
                             )}
                           </>
                         )}

                         {/* Completed - Client can pay */}
                         {userRole === 'client' && milestone.status === 'completed' && milestone.escrow_status === 'none' && (
                           <>
                             <Button
                               size="sm"
                               onClick={() => handleStripePayment(milestone, false)}
                               disabled={payingMilestoneId === milestone.id}
                               className="gap-2"
                             >
                               {payingMilestoneId === milestone.id ? (
                                 <Loader2 className="h-4 w-4 animate-spin" />
                               ) : (
                                 <CreditCard className="h-4 w-4" />
                               )}
                               Pay Now ${Number(milestone.amount).toFixed(2)}
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => handleStripePayment(milestone, true)}
                               disabled={payingMilestoneId === milestone.id}
                               className="gap-2"
                             >
                               Pay with Escrow
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => handleMarkAsPaid(milestone.id)}
                               disabled={payingMilestoneId === milestone.id}
                               className="gap-2 text-xs"
                             >
                               <DollarSign className="h-4 w-4" />
                               Mark Paid (offline)
                             </Button>
                           </>
                         )}
                       </>
                     )}
                   </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}