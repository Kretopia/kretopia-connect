import { useNavigate } from "react-router-dom";
import { Pencil, CircleDot, Briefcase, Coins } from "lucide-react";
import { DashboardPanel, CreditsEmptyState } from "./CreditsPrimitives";

export interface HireMeProfile {
  availability_status?: string | null;
  availability_note?: string | null;
  collab_intent?: string | null;
  hourly_rate?: number | null;
  project_rate?: number | null;
  rate_currency?: string | null;
  skills?: string[] | null;
  site_headline?: string | null;
}

/**
 * CreditsHireMePanel — the bookable half of the Passport, inside Credits.
 * Rates render only when the owner has set them; no payment, payout, KYC or
 * Stripe field is ever read here.
 */
export function CreditsHireMePanel({ profile, index }: { profile: HireMeProfile | null; index?: number }) {
  const navigate = useNavigate();

  const hasSetup = Boolean(
    profile?.availability_status || profile?.collab_intent || profile?.hourly_rate || profile?.project_rate,
  );
  const currency = profile?.rate_currency || "USD";

  return (
    <DashboardPanel
      id="hire-me"
      eyebrow="03"
      title="Hire Me"
      index={index}
      action={
        <button
          type="button"
          onClick={() => navigate("/profile/edit#hire")}
          className="btn-glass btn-glass-outline inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </button>
      }
    >
      {!hasSetup ? (
        <CreditsEmptyState
          title="Hire Me isn't set up yet"
          body="Say what you're open to and roughly what you charge. People book what they can price."
          icon={<Briefcase className="h-7 w-7" />}
          action={
            <button
              type="button"
              onClick={() => navigate("/profile/edit#hire")}
              className="btn-glass btn-glass-primary rounded-full px-4 py-2 text-xs font-semibold"
            >
              Set it up
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {profile?.site_headline && (
            <p className="text-sm leading-relaxed text-muted-foreground">{profile.site_headline}</p>
          )}

          <dl className="grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <CircleDot className="h-3.5 w-3.5" aria-hidden />
                Availability
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {profile?.availability_status || "Not set"}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" aria-hidden />
                Open to
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {profile?.collab_intent || "Not set"}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Coins className="h-3.5 w-3.5" aria-hidden />
                Rate
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {profile?.hourly_rate
                  ? `${currency} ${profile.hourly_rate}/hr`
                  : profile?.project_rate
                    ? `${currency} ${profile.project_rate}/project`
                    : "Not shown"}
              </dd>
            </div>
          </dl>

          {profile?.availability_note && (
            <p className="text-xs leading-relaxed text-muted-foreground">{profile.availability_note}</p>
          )}

          {Array.isArray(profile?.skills) && profile!.skills!.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {profile!.skills!.slice(0, 10).map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DashboardPanel>
  );
}
