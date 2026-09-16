import { useNavigate } from "react-router-dom";
import { Pencil, Eye, EyeOff, BadgeCheck } from "lucide-react";
import { DashboardPanel } from "./CreditsPrimitives";

export interface IdentityProfile {
  full_name: string | null;
  role: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  is_discoverable?: boolean | null;
  verification_score?: number | null;
  icdb_creator_id?: string | null;
}

/**
 * CreditsIdentityPanel — the "who you are" half of the Passport, now living
 * inside Credits instead of a separate page. Owner-only fields; the profile
 * row is read with the caller's own session (RLS: owner policy).
 */
export function CreditsIdentityPanel({ profile, index }: { profile: IdentityProfile | null; index?: number }) {
  const navigate = useNavigate();
  const visible = profile?.is_discoverable !== false;

  return (
    <DashboardPanel
      id="identity"
      eyebrow="01"
      title="Identity"
      index={index}
      action={
        <button
          type="button"
          onClick={() => navigate("/profile/edit")}
          className="btn-glass btn-glass-outline inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </button>
      }
    >
      <div className="flex items-start gap-4">
        <img
          src={profile?.avatar_url || "/avatar-silhouette.svg"}
          alt=""
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            {profile?.full_name || "Add your name"}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[profile?.role, profile?.location].filter(Boolean).join(" · ") || "Add your creative role"}
          </p>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {profile?.bio || "No bio yet. A short, specific bio is the single fastest thing you can fix here."}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {visible ? <Eye className="h-3 w-3" aria-hidden /> : <EyeOff className="h-3 w-3" aria-hidden />}
              {visible ? "Visible in discovery" : "Hidden from discovery"}
            </span>
            {typeof profile?.verification_score === "number" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <BadgeCheck className="h-3 w-3" aria-hidden />
                Verification score {profile.verification_score}
              </span>
            )}
            {profile?.icdb_creator_id && (
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {profile.icdb_creator_id}
              </span>
            )}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}
