import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Clock3, FileWarning, Globe, Handshake, Link2, Paperclip, Plus, ShieldCheck, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MyCredit } from "@/hooks/useMyCredits";
import { DashboardPanel, CreditsEmptyState, CreditsPanelSkeleton } from "./CreditsPrimitives";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { useAuth } from "@/hooks/useAuth";
import { useCosignRequests } from "@/hooks/useCosignRequests";
import { describeCosignRequest, leadingCosignRequest } from "@/lib/passport/cosignRequests";
import { CreditEndorsementDialog } from "@/components/profile/CreditEndorsementDialog";
import { VerificationLegend } from "@/components/passport/VerificationLegend";
import {
  classifyCreditEvidence,
  creditEvidenceBasis,
  creditEvidenceLabel,
  creditEvidenceMeaning,
  creditNextStep,
  type CreditEvidenceStatus,
} from "@/lib/passport/creditEvidence";
import { cn } from "@/lib/utils";

interface Props {
  credits: MyCredit[];
  loading?: boolean;
  query: string;
  index?: number;
  /** Credits still missing evidence — drives the header shortcut. */
  missingEvidenceCount?: number;
  /** Opens the attach-evidence dialog, optionally focused on one credit. */
  onAttachEvidence?: (creditId?: string) => void;
}

/** The same five statuses the Passport shows, from the same classifier, so a credit reads the same in both places. */
const STATUS_CHIP: Record<CreditEvidenceStatus, { icon: LucideIcon; cls: string }> = {
  verified: { icon: ShieldCheck, cls: "text-emerald-300 border-emerald-400/25 bg-emerald-400/10" },
  co_signed: { icon: Handshake, cls: "text-teal-300 border-teal-400/25 bg-teal-400/10" },
  publicly_sourced: { icon: Globe, cls: "text-muted-foreground border-border bg-muted/30" },
  pending: { icon: Clock3, cls: "text-muted-foreground border-border border-dashed bg-muted/30" },
  self_claimed: { icon: UserCheck, cls: "text-muted-foreground border-border bg-muted/30" },
};

/**
 * CreditsStampsPanel — the person's own stamps, rendered inline in Credits.
 * Each row says what proof it has (verified, co-signed, pending, self-declared), why, what to do next, and
 * leads to the same credit on the Passport, where it is shown in full. No "My Stamps" label, no category
 * counters: the list itself is the record.
 */
export function CreditsStampsPanel({ credits, loading, query, index, missingEvidenceCount = 0, onAttachEvidence }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { byCredit: requestsByCredit, refresh: refreshRequests } = useCosignRequests(user?.id);
  const [askCredit, setAskCredit] = useState<MyCredit | null>(null);

  return (
    <DashboardPanel
      id="stamps"
      eyebrow="02"
      title="Stamps"
      index={index}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onAttachEvidence && missingEvidenceCount > 0 && (
            <button
              type="button"
              onClick={() => onAttachEvidence()}
              className="btn-glass btn-glass-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              Attach evidence
              <span className="rounded-full bg-background/20 px-1.5 text-[10px] font-bold">{missingEvidenceCount}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="btn-glass btn-glass-ghost inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
          >
            Open Passport
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => navigate("/profile?add=credit")}
            className="btn-glass btn-glass-outline inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add credit
          </button>
        </div>
      }
    >
      {loading ? (
        <CreditsPanelSkeleton rows={4} />
      ) : credits.length === 0 ? (
        query ? (
          <CreditsEmptyState
            title={`Nothing of yours matches "${query.slice(0, 40)}"`}
            body="This search only looks inside your own record. Try a different project, role or year."
          />
        ) : (
          <CreditsEmptyState
            title="No credits on your record yet"
            body="Add the work you've done. Attach a link or a file as evidence, then ask the people who were there to co-sign it."
            icon={<ShieldCheck className="h-7 w-7" />}
          />
        )
      ) : (
        <>
        <VerificationLegend className="mb-3" />
        <ul className="space-y-2">
          {credits.map((c) => {
            const status = classifyCreditEvidence(c);
            const chip = STATUS_CHIP[status];
            const hasEvidence = Boolean(c.url || c.primary_media_url);
            const nextStep = creditNextStep(status, hasEvidence);
            const img = resolveCreditThumbnail(c.thumbnail_url, c.primary_media_url, c.url);
            const request = leadingCosignRequest(requestsByCredit.get(c.id));
            const canAsk = Boolean(user) && status !== "verified" && request?.state !== "pending" && request?.state !== "accepted";
            return (
              <li key={c.id}>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-primary/40">
                  {img ? (
                    <img src={img} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-xs font-semibold text-muted-foreground">
                      {(c.project_name || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">{c.project_name}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.role, c.client_brand, c.year].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {creditEvidenceBasis(c)}
                      {nextStep ? ` · ${nextStep}` : ""}
                    </p>
                    {request && (
                      <p className={cn("mt-0.5 text-[11px] leading-snug", request.state === "accepted" ? "text-teal-300" : request.state === "pending" ? "text-muted-foreground" : "text-destructive")}>
                        {describeCosignRequest(request)}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      to={`/profile?credit=${c.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      View on Passport
                      <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </Link>
                    {canAsk && (
                      <button
                        type="button"
                        onClick={() => setAskCredit(c)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        <Handshake className="h-3 w-3" aria-hidden />
                        {request ? "Ask someone else" : "Ask for a co-sign"}
                      </button>
                    )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      title={creditEvidenceMeaning(status)}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold", chip.cls)}
                    >
                      <chip.icon className="h-3 w-3" aria-hidden />
                      {creditEvidenceLabel(status)}
                      {status === "co_signed" && c.endorsement_count > 0 ? ` · ${c.endorsement_count}` : ""}
                    </span>
                    {status !== "verified" && !hasEvidence && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        <FileWarning className="h-3 w-3" aria-hidden />
                        No evidence yet
                      </span>
                    )}
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open evidence for ${c.project_name}`}
                        className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {askCredit && user && (
          <CreditEndorsementDialog
            open
            onOpenChange={(open) => { if (!open) { setAskCredit(null); void refreshRequests(); } }}
            credit={{ id: askCredit.id, project_name: askCredit.project_name, role: askCredit.role, year: askCredit.year ?? undefined }}
            userId={user.id}
          />
        )}
        </>
      )}
    </DashboardPanel>
  );
}
