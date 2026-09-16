import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ShieldCheck, Check, X, Loader2, Clock, XCircle, History, ArrowRight } from "lucide-react";
import { HoloCard } from "@/components/passport/HoloCard";

interface PendingEndorsement {
  id: string;
  credit_id: string;
  requested_by: string;
  relationship: string | null;
  requested_at: string;
  credits: {
    project_name: string;
    role: string;
    year: number | null;
  };
  requester_profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ResolvedEndorsement extends PendingEndorsement {
  status: "accepted" | "declined" | "expired";
  responded_at: string | null;
}

// 'expired' is a valid status in the DB check constraint, but no server-side
// job currently transitions a row to it — there's no auto-expiry cron. It's
// rendered here only in case a row is ever set to it manually or by a future
// job; the card never claims an expiry mechanism is running today.
const RESOLVED_STATUS_META: Record<ResolvedEndorsement["status"], { label: string; icon: typeof Check; tagClassName: string }> = {
  accepted: { label: "Verified — co-signed", icon: ShieldCheck, tagClassName: "bg-[hsl(var(--signal-teal))] text-black" },
  declined: { label: "Declined", icon: XCircle, tagClassName: "bg-muted text-muted-foreground" },
  expired: { label: "Expired — no response", icon: Clock, tagClassName: "bg-muted text-muted-foreground" },
};

interface CreditVerificationPanelProps {
  userId: string;
}

// A short, context-aware line instead of one generic sentence for every
// card — uses the relationship tag when the requester supplied one, so the
// ask reads specific ("As their director, confirm...") rather than generic.
function smartEndorsementDescription(endorsement: PendingEndorsement): string {
  const name = endorsement.requester_profile?.full_name?.split(" ")[0] || "They";
  if (endorsement.relationship) {
    return `As their ${endorsement.relationship.toLowerCase()}, confirm this credit to make it part of ${name === "They" ? "their" : `${name}'s`} verified record.`;
  }
  return "Confirm you actually worked together — this becomes part of their verified record.";
}

export function CreditVerificationPanel({ userId }: CreditVerificationPanelProps) {
  const [pendingEndorsements, setPendingEndorsements] = useState<PendingEndorsement[]>([]);
  const [resolvedEndorsements, setResolvedEndorsements] = useState<ResolvedEndorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [testimonials, setTestimonials] = useState<Record<string, string>>({});
  const [openEndorsement, setOpenEndorsement] = useState<PendingEndorsement | null>(null);

  useEffect(() => {
    fetchEndorsements();
  }, [userId]);

  const fetchEndorsements = async () => {
    try {
      const enrich = async (rows: any[]) =>
        Promise.all(
          rows.map(async (endorsement: any) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('user_id', endorsement.requested_by)
              .single();
            return { ...endorsement, requester_profile: profile };
          })
        );

      const [{ data: pending, error: pendingError }, { data: resolved, error: resolvedError }] = await Promise.all([
        supabase
          .from('credit_endorsements')
          .select(`
            id, credit_id, requested_by, relationship, requested_at,
            credits!credit_endorsements_credit_id_fkey(project_name, role, year)
          `)
          .eq('endorser_id', userId)
          .eq('status', 'pending')
          .order('requested_at', { ascending: false }),
        supabase
          .from('credit_endorsements')
          .select(`
            id, credit_id, requested_by, relationship, requested_at, status, responded_at,
            credits!credit_endorsements_credit_id_fkey(project_name, role, year)
          `)
          .eq('endorser_id', userId)
          .in('status', ['accepted', 'declined', 'expired'])
          .order('responded_at', { ascending: false })
          .limit(5),
      ]);

      if (pendingError) throw pendingError;
      if (resolvedError) throw resolvedError;

      const [enrichedPending, enrichedResolved] = await Promise.all([
        enrich(pending || []),
        enrich(resolved || []),
      ]);

      setPendingEndorsements(enrichedPending as any[]);
      setResolvedEndorsements(enrichedResolved as any[]);
    } catch (error) {
      console.error('Error fetching endorsements:', error);
    } finally {
      setLoading(false);
    }
  };

  const respondToEndorsement = async (endorsementId: string, accept: boolean) => {
    setRespondingId(endorsementId);
    try {
      const testimonial = testimonials[endorsementId] || null;
      const endorsement = pendingEndorsements.find(e => e.id === endorsementId);

      const { error } = await supabase
        .from('credit_endorsements')
        .update({
          status: accept ? 'accepted' : 'declined',
          testimonial: accept ? testimonial : null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', endorsementId)
        .eq('endorser_id', userId);

      if (error) throw error;

      if (accept && endorsement) {
        // increment_endorsement_count already sets verification_status
        // correctly (verified at 2+ endorsements, pending at 1) — mirrors
        // submit_credit_endorsement_by_token's threshold. Don't overwrite
        // it here; this used to hardcode 'peer' regardless of count, which
        // both stomped that correct value AND isn't an allowed
        // verification_status per credits_verification_status_check.
        await supabase.rpc('increment_endorsement_count' as any, { credit_id_param: endorsement.credit_id });
        await supabase
          .from('credits')
          .update({ verified_by_user_id: userId })
          .eq('id', endorsement.credit_id);
      }

      setPendingEndorsements(prev => prev.filter(e => e.id !== endorsementId));
      if (endorsement) {
        const status: ResolvedEndorsement["status"] = accept ? 'accepted' : 'declined';
        setResolvedEndorsements(prev => [
          { ...endorsement, status, responded_at: new Date().toISOString() },
          ...prev,
        ].slice(0, 5));
      }
      setOpenEndorsement(null);
      toast.success(accept ? 'Credit endorsed! Your verification has been added.' : 'Endorsement declined.');
    } catch (error: any) {
      console.error('Error responding to endorsement:', error);
      toast.error('Failed to respond');
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) {
    return null;
  }

  if (pendingEndorsements.length === 0 && resolvedEndorsements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {pendingEndorsements.length > 0 && (
        <>
      <div className="flex items-center gap-2 px-1">
        <ShieldCheck className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
        <h3 className="text-sm font-bold">Verification Requests</h3>
        <Badge variant="secondary">{pendingEndorsements.length}</Badge>
        <p className="text-xs text-muted-foreground ml-auto hidden sm:block">Confirm credits from people you've worked with</p>
      </div>

      {/* Grid + compact-card-opens-detail-dialog — same layout and
          interaction pattern as Scout's opportunity cards. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pendingEndorsements.map((endorsement) => (
          <HoloCard key={endorsement.id} maxTilt={5}>
            <Card
              className="relative overflow-hidden rounded-2xl border-[hsl(var(--signal-teal))]/20 bg-card flex flex-col min-h-[150px] cursor-pointer transition-all hover:border-[hsl(var(--signal-teal))]/40 hover:shadow-2xl hover:shadow-[hsl(var(--signal-teal))]/10"
              onClick={() => setOpenEndorsement(endorsement)}
            >
              <div
                className="absolute top-0 left-0 px-3 py-1 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-[0.15em] rounded-br-lg z-10 flex items-center gap-1"
                style={{ transform: "translateZ(10px)" }}
              >
                <Clock className="h-2.5 w-2.5" aria-hidden />
                Pending
              </div>

              <div className="relative flex-1 flex flex-col p-4 pt-9 gap-2">
                <div className="flex items-start gap-3">
                  <div style={{ transform: "translateZ(24px)" }} className="shrink-0">
                    <Avatar className="h-9 w-9 ring-1 ring-white/15">
                      <AvatarImage src={endorsement.requester_profile?.avatar_url || ''} />
                      <AvatarFallback>{endorsement.requester_profile?.full_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">
                      {endorsement.requester_profile?.full_name || 'Someone'} wants you to verify
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      <strong>{endorsement.credits?.project_name}</strong> — {endorsement.credits?.role}
                      {endorsement.credits?.year && <span> ({endorsement.credits.year})</span>}
                    </p>
                  </div>
                </div>
                {endorsement.relationship && (
                  <Badge variant="outline" className="w-fit text-[10px]" style={{ transform: "translateZ(14px)" }}>
                    {endorsement.relationship}
                  </Badge>
                )}
                <p className="mt-auto text-[11px] font-semibold text-[hsl(var(--signal-teal))]">
                  Tap to review &amp; respond
                </p>
              </div>
            </Card>
          </HoloCard>
        ))}
      </div>

      {/* Detail + response dialog — centered, matches Scout's gig-card modal */}
      <Dialog open={!!openEndorsement} onOpenChange={(o) => !o && setOpenEndorsement(null)}>
        <DialogContent className="max-w-md">
          {openEndorsement && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 ring-1 ring-white/15 shrink-0">
                    <AvatarImage src={openEndorsement.requester_profile?.avatar_url || ''} />
                    <AvatarFallback>{openEndorsement.requester_profile?.full_name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-left">
                    <DialogTitle className="text-base font-bold leading-tight">
                      {openEndorsement.requester_profile?.full_name || 'Someone'} wants you to verify
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <strong>{openEndorsement.credits?.project_name}</strong> — {openEndorsement.credits?.role}
                      {openEndorsement.credits?.year && <span> ({openEndorsement.credits.year})</span>}
                    </p>
                    {openEndorsement.relationship && (
                      <Badge variant="outline" className="mt-1.5 text-[10px]">{openEndorsement.relationship}</Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <p className="text-xs text-muted-foreground/80">
                {smartEndorsementDescription(openEndorsement)}
              </p>

              <Textarea
                placeholder="Add a testimonial (optional) — e.g., 'Great to work with, delivered exceptional results'"
                value={testimonials[openEndorsement.id] || ''}
                onChange={(e) => setTestimonials(prev => ({ ...prev, [openEndorsement.id]: e.target.value }))}
                className="text-sm min-h-[70px] resize-none"
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => respondToEndorsement(openEndorsement.id, true)}
                  disabled={respondingId === openEndorsement.id}
                >
                  {respondingId === openEndorsement.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Confirm & Endorse
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respondToEndorsement(openEndorsement.id, false)}
                  disabled={respondingId === openEndorsement.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  Decline
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}

      {resolvedEndorsements.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <h3 className="text-xs font-semibold text-muted-foreground">Recently responded</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resolvedEndorsements.map((endorsement) => {
            const meta = RESOLVED_STATUS_META[endorsement.status];
            const StatusIcon = meta.icon;
            return (
              <HoloCard key={endorsement.id} maxTilt={3}>
                <Card className="relative overflow-hidden rounded-2xl border-border/60 bg-card/60 flex flex-col min-h-[130px]">
                  <div
                    className={`absolute top-0 left-0 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] rounded-br-lg z-10 flex items-center gap-1 ${meta.tagClassName}`}
                    style={{ transform: "translateZ(10px)" }}
                  >
                    <StatusIcon className="h-2.5 w-2.5" aria-hidden />
                    <span>{meta.label}</span>
                  </div>

                  <div className="relative flex-1 p-4 pt-9 flex items-start gap-3">
                    <div style={{ transform: "translateZ(16px)" }} className="shrink-0">
                      <Avatar className="h-8 w-8 ring-1 ring-white/10 opacity-80">
                        <AvatarImage src={endorsement.requester_profile?.avatar_url || ''} />
                        <AvatarFallback>{endorsement.requester_profile?.full_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        <strong className="text-foreground">{endorsement.credits?.project_name}</strong> — {endorsement.credits?.role}
                        {endorsement.credits?.year && <span> ({endorsement.credits.year})</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {endorsement.requester_profile?.full_name || 'Someone'} · requested{' '}
                        {new Date(endorsement.requested_at).toLocaleDateString()}
                      </p>
                      {endorsement.status === "accepted" && (
                        <p className="text-[11px] text-[hsl(var(--signal-teal))] mt-1 line-clamp-1">
                          Counts toward their ThriveStatus verification
                        </p>
                      )}
                      {endorsement.status === "declined" && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-1">
                          No explanation was collected for this response.
                        </p>
                      )}
                      {endorsement.status === "expired" && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-1">
                          This request is no longer active.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0" style={{ transform: "translateZ(8px)" }}>
                      {endorsement.responded_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(endorsement.responded_at).toLocaleDateString()}
                        </span>
                      )}
                      {endorsement.status === "accepted" && (
                        <Link
                          to={`/profile/${endorsement.requested_by}`}
                          className="relative z-10 inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:text-[hsl(var(--signal-teal))] transition-colors"
                        >
                          View Passport <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              </HoloCard>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
