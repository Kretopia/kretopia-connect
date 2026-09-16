import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

interface PassportPreviewCardProps {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  /** Real cover artwork, when the profile has one -- takes over the banner
   *  from the stretched-avatar fallback below, which crops portrait photos
   *  awkwardly into a 16:10 frame. */
  coverImageUrl?: string | null;
  role: string | null;
  subRoles?: string[] | null;
  matchScore?: number | null;
  reason?: string | null;
}

/** Same gray -> Kretopia pink treatment as PassportHero's banner/strength
 *  bar, so a preview card visibly belongs to the same Passport family. */
const GRAY_PINK_GRADIENT = "linear-gradient(90deg, #6B7280 0%, #FF2DA1 100%)";

/**
 * Compact Passport preview -- the card "People for you" (Today) and any
 * other creator-discovery rail should use instead of a bare avatar
 * thumbnail, so a Passport looks like a Passport everywhere it's teased,
 * not just on its own full page.
 */
export function PassportPreviewCard({
  userId,
  fullName,
  avatarUrl,
  coverImageUrl,
  role,
  subRoles,
  matchScore,
  reason,
}: PassportPreviewCardProps) {
  const banner = coverImageUrl || avatarUrl;
  return (
    <Link
      to={`/profile/${userId}`}
      className="group flex w-44 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10"
    >
      {/* Passport "spine" -- the same accent used on the full Passport's
          banner/strength bar, echoed here as a thin top strip so this
          card reads as a member of the same family, not a generic tile. */}
      <div className="h-1 w-full shrink-0" style={{ background: GRAY_PINK_GRADIENT }} aria-hidden />

      <div className="relative aspect-[16/10] shrink-0 overflow-hidden">
        <div
          className="h-full w-full bg-gradient-to-br from-primary/20 via-accent/10 to-background transition-transform duration-500 group-hover:scale-105"
          style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {coverImageUrl && avatarUrl && (
          <div className="absolute top-2 left-2 h-7 w-7 rounded-full overflow-hidden ring-2 ring-background">
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        {matchScore && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[9px] font-bold text-energy backdrop-blur-sm">
            <Sparkles className="h-2.5 w-2.5" />
            {matchScore}%
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="line-clamp-1 text-sm font-black leading-tight text-foreground">{fullName}</p>
        </div>
      </div>

      <div className="mt-auto border-t border-border/60 p-2.5">
        <p className="line-clamp-1 text-[10px] text-muted-foreground">{role || "Creator"}</p>
        {reason && <p className="line-clamp-2 pt-0.5 text-[10px] text-primary">{reason}</p>}
      </div>
    </Link>
  );
}

export default PassportPreviewCard;
