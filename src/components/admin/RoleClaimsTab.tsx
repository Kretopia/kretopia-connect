import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, ExternalLink, UserCheck, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KretopiaLoader, KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useToast } from "@/hooks/use-toast";
import {
  CLAIMS_LIMIT,
  compareNames,
  decideRoleClaim,
  loadRoleClaims,
  notifyRoleClaimDecision,
  safeHttpUrl,
  type DecisionOutcome,
  type LoadResult,
  type NameHint,
  type RoleClaimView,
} from "@/lib/roleClaims";

const HINT_TEXT: Record<NameHint, string> = {
  same: "Same name as the member's profile",
  similar: "One name is part of the other",
  different: "Different from the member's profile name",
  unknown: "No name to compare",
};

type Pending = { claim: RoleClaimView; approve: boolean } | null;

const memberName = (claim: RoleClaimView) => claim.requester?.full_name?.trim() || "Unknown member";

/**
 * Admin > Users & Trust > Role claims. A member who asks to take a credited role on a project in the Kretopia database files a
 * request; this is where an admin decides it. The decision, the admin check and "a role can be claimed once" are enforced by the
 * database function, not by this screen: it shows the facts a reviewer needs and calls that function.
 */
export const RoleClaimsTab = () => {
  const { toast } = useToast();
  const [result, setResult] = useState<LoadResult | null>(null);
  const [view, setView] = useState<"pending" | "decided">("pending");
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setResult(await loadRoleClaims());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const claims = result?.kind === "ok" ? result.claims : [];
  const waiting = useMemo(() => claims.filter((c) => c.request.status === "pending"), [claims]);
  const decided = useMemo(() => claims.filter((c) => c.request.status !== "pending"), [claims]);
  const shown = view === "pending" ? waiting : decided;

  const openDecision = (claim: RoleClaimView, approve: boolean) => {
    setNote("");
    setPending({ claim, approve });
  };

  const confirm = async () => {
    if (!pending || saving) return;
    const { claim, approve } = pending;
    setSaving(true);
    let outcome: DecisionOutcome;
    try {
      outcome = await decideRoleClaim(claim.request.id, approve, note);
    } finally {
      setSaving(false);
    }

    const name = memberName(claim);
    if (outcome.kind === "approved") {
      toast({ title: "Claim approved", description: `${name} now has this credit on their Passport, as their own claim.` });
    } else if (outcome.kind === "rejected") {
      toast({ title: "Claim declined", description: `${name} is told it wasn't approved.` });
    } else if (outcome.kind === "declined-already-claimed") {
      toast({ title: "Declined instead", description: "This role had already been claimed, so the request was declined and nothing was added." });
    } else if (outcome.kind === "already-decided") {
      toast({ title: "Already decided", description: `This request was already ${outcome.status}. The list has been refreshed.` });
    } else if (outcome.kind === "forbidden") {
      toast({ title: "Not allowed", description: "Only an admin can decide a role claim. Nothing was changed.", variant: "destructive" });
    } else if (outcome.kind === "not-set-up") {
      toast({ title: "Not set up yet", description: "Role claim review is not available on this backend yet. Nothing was changed.", variant: "destructive" });
    } else {
      toast({ title: "Couldn't save the decision", description: `${outcome.message} Nothing was changed.`, variant: "destructive" });
    }

    const saved = outcome.kind === "approved" || outcome.kind === "rejected" || outcome.kind === "declined-already-claimed" || outcome.kind === "already-decided";
    if (saved) {
      setPending(null);
      // Tell the member only about a decision this click actually made.
      if (outcome.kind !== "already-decided") void notifyRoleClaimDecision(claim, outcome, note);
      await load();
    } else if (outcome.kind === "forbidden" || outcome.kind === "not-set-up") {
      setPending(null);
    }
  };

  if (!result) return <KretopiaLoader size="md" label="Loading role claims" className="py-12" />;

  if (result.kind === "not-set-up") {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-5 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1.5">
            <p className="font-medium text-foreground">Role claim review isn't set up on this backend yet.</p>
            <p className="text-muted-foreground">
              The migration <code className="text-xs">20261106120000_featured_in_confirmation_and_role_claim_requests.sql</code> has to be applied first (see the
              deployment runbook). Until then nothing can be reviewed here, and a member's Claim button still adds the credit at once.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (result.kind === "error") {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Couldn't load the role claims.</p>
              <p className="text-muted-foreground">{result.message}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Role claims" className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {(
            [
              ["pending", `Waiting (${waiting.length})`],
              ["decided", `Decided (${decided.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          Approving gives the member the credit on their Passport as their own claim. It is never marked verified.
        </p>
      </div>

      {result.truncated && <p className="text-xs text-muted-foreground">Showing the {CLAIMS_LIMIT} most recent requests.</p>}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <UserCheck className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">{view === "pending" ? "No claims are waiting." : "Nothing has been decided yet."}</p>
            {view === "pending" && <p className="max-w-sm text-xs text-muted-foreground">New requests appear here when a member asks to take a role on a project.</p>}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((claim) => (
            <ClaimCard key={claim.request.id} claim={claim} onDecide={openDecision} />
          ))}
        </ul>
      )}

      <Dialog open={!!pending} onOpenChange={(open) => !open && !saving && setPending(null)}>
        <DialogContent className="max-w-md">
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>{pending.approve ? "Approve this claim?" : "Decline this claim?"}</DialogTitle>
                <DialogDescription>
                  {pending.approve ? (
                    <>
                      {memberName(pending.claim)} gets <strong>{pending.claim.role?.role_title}</strong> on <strong>{pending.claim.project?.title}</strong> on their
                      Passport, as their own claim, not as a verified credit. The role is marked claimed, so nobody else can take it
                      {pending.claim.competing.length > 0 ? `, and the ${pending.claim.competing.length} other pending request${pending.claim.competing.length === 1 ? "" : "s"} for it will be declined` : ""}.
                      This screen cannot undo it.
                    </>
                  ) : (
                    <>
                      {memberName(pending.claim)} is told the claim wasn't approved. The role stays open, and they can ask again later.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="role-claim-note" className="text-xs">
                  Note to the member (optional). They can read it.
                </Label>
                <Textarea id="role-claim-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={pending.approve ? "" : "Why it wasn't approved"} />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setPending(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant={pending.approve ? "default" : "destructive"} onClick={() => void confirm()} disabled={saving}>
                  {saving && <KretopiaSpinner className="mr-2 h-4 w-4" />}
                  {pending.approve ? "Approve claim" : "Decline claim"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function ClaimCard({ claim, onDecide }: { claim: RoleClaimView; onDecide: (claim: RoleClaimView, approve: boolean) => void }) {
  const { request, role, project, requester, competing } = claim;
  const name = memberName(claim);
  const hint = compareNames(role?.person_name, requester?.full_name);
  const thumbnail = safeHttpUrl(request.thumbnail_url);
  const projectLink = safeHttpUrl(project?.external_url);
  const alreadyClaimed = request.status === "pending" && !!role?.is_claimed;
  const isPending = request.status === "pending";
  const roleLabel = role?.role_title ?? "a role that no longer exists";

  return (
    <li>
      <Card data-testid="role-claim">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              {requester?.avatar_url && safeHttpUrl(requester.avatar_url) ? <AvatarImage src={requester.avatar_url} alt="" /> : null}
              <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {name}
                {requester?.username && <span className="ml-1.5 font-normal text-muted-foreground">@{requester.username}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                Asked {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                {requester?.verification_status === "verified" ? " · identity approved by an admin" : " · identity not reviewed"}
              </p>
            </div>
            <a
              href={`/profile/${request.requester_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              aria-label={`Open ${name}'s Passport in a new tab`}
            >
              Passport <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Wants the role </span>
              <strong>{roleLabel}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">On </span>
              {project ? (
                <a href={`/credits/project/${project.id}`} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline">
                  {project.title}
                </a>
              ) : (
                <span className="text-muted-foreground">a project that is no longer available</span>
              )}
              {project && <span className="text-muted-foreground">{[project.year, project.type, project.platform].filter(Boolean).map((v) => ` · ${v}`).join("")}</span>}
              {projectLink && (
                <a href={projectLink} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-primary underline-offset-4 hover:underline">
                  Source
                </a>
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Credited as </span>
              <strong>{role?.person_name?.trim() || "no name"}</strong>
              <span className="text-muted-foreground"> · {HINT_TEXT[hint]}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">A name is a hint, not proof of who someone is.</p>
          </div>

          {competing.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                {competing.length === 1 ? "1 other member" : `${competing.length} other members`} also asked for this role ({competing.map((c) => c.name).join(", ")}).
              </span>
            </p>
          )}

          {thumbnail && <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-28 rounded-md border border-border object-cover" />}

          {isPending ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={alreadyClaimed || !role} onClick={() => onDecide(claim, true)} aria-label={`Approve ${name}'s claim to ${roleLabel}`}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDecide(claim, false)} aria-label={`Decline ${name}'s claim to ${roleLabel}`}>
                <XCircle className="mr-1.5 h-4 w-4" /> Decline
              </Button>
              {alreadyClaimed && <span className="text-xs text-muted-foreground">This role has already been claimed. Decline to clear the request.</span>}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={request.status === "approved" ? "default" : "secondary"}>{request.status === "approved" ? "Approved" : "Declined"}</Badge>
              {request.decided_at && <span>{formatDistanceToNow(new Date(request.decided_at), { addSuffix: true })}</span>}
              {request.note && <span className="text-foreground">“{request.note}”</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
