import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FramedAvatar } from "@/components/ui/framed-avatar";
import { HoloCard } from "./HoloCard";
import { PassportSmartActions } from "./PassportSmartActions";
import { AvailabilityIndicator } from "@/components/profile/AvailabilityIndicator";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Fingerprint,
  FolderPlus,
  Handshake,
  MapPin,
  MessageCircle,
  Share2,
  UserPlus,
} from "lucide-react";

interface PublicPassportProfile {
  user_id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  profile_frame?: string | null;
  cover_image_url?: string | null;
  verification_status?: string | null;
  job_title?: string | null;
  role?: string | null;
  location?: string | null;
  availability_status?: string | null;
  availability?: string | null;
  availability_note?: string | null;
  sub_roles?: string[] | null;
  bio?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
  id_verified?: boolean;
  payment_verified?: boolean;
  professional_skills?: unknown;
}

/**
 * What the owner has on their own Passport card, grafted onto the very card visitors see: the owner card's old controls (the photo
 * button on the avatar, then Edit, Share, QR, the press kit and the PDF on one line). Without this the card is exactly the public one.
 */
export interface PublicPassportOwner {
  onEdit: () => void;
  onShowQR: () => void;
  onDownloadEPK: () => void;
  onChangePhoto: () => void;
  isUploadingAvatar?: boolean;
  /** The owner's own share flow, in place of the plain link share visitors get. */
  onShare?: () => void;
  /** Credits other people tagged to this person that they have not claimed yet. */
  taggedCount?: number;
  /** The PDF button of the action line. The document fills it in (it holds the data the PDF is made of); the owner's page does not. */
  pdf?: { onDownload: () => void; busy?: boolean; locked?: boolean };
  /**
   * What only the owner sees (Kreto's entry, the Passport intelligence, the press to confirm, the reach). It is not drawn by the card:
   * the document lays it out as a band under the card and the record (see PassportPrivateBand).
   */
  privateBand?: ReactNode;
}

interface PublicPassportHeroProps {
  profile: PublicPassportProfile;
  /** The owner's controls; honoured only when `isOwner`. */
  owner?: PublicPassportOwner;
  /** Experience + proof block (see PassportHiringGlance). */
  glance?: ReactNode;
  connectionStatus: "none" | "pending" | "connected";
  isOwner: boolean;
  isSignedIn: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onMessage: () => void;
  onCollaborate: () => void;
  onAddToProject: () => void;
  onShare: () => void;
  onJoin: () => void;
  children?: ReactNode;
  showBio?: boolean;
  showActions?: boolean;
  /** The creative's booking page, set only when they have active booking hours; no path, no booking action. */
  bookingPath?: string | null;
}

export function PublicPassportHero({
  profile,
  owner,
  glance,
  connectionStatus,
  isOwner,
  isSignedIn,
  isConnecting,
  onConnect,
  onMessage,
  onCollaborate,
  onAddToProject,
  onShare,
  onJoin,
  children,
  showBio = true,
  showActions = true,
  bookingPath = null,
}: PublicPassportHeroProps) {
  const passportId = useMemo(
    () => profile.user_id ? `KRT-${profile.user_id.replace(/-/g, "").slice(0, 5).toUpperCase()}` : "KRT-—",
    [profile.user_id],
  );
  const skills = Array.isArray(profile.professional_skills)
    ? profile.professional_skills.map((skill: unknown) => {
        if (typeof skill === "string") return skill;
        if (typeof skill === "object" && skill !== null) {
          const value = skill as { skill?: unknown; name?: unknown };
          if (typeof value.skill === "string") return value.skill;
          if (typeof value.name === "string") return value.name;
        }
        return null;
      }).filter((skill): skill is string => Boolean(skill)).slice(0, 6)
    : [];
  const connected = connectionStatus === "connected";
  const ownerMode = isOwner && owner ? owner : null;
  const avatar = (
    <FramedAvatar
      src={profile.avatar_url || "/avatar-silhouette.svg"}
      fallback={profile.full_name?.split(" ").map((name: string) => name[0]).join("") || "?"}
      alt={profile.full_name || undefined}
      frame={profile.profile_frame}
      className="h-20 w-20 rounded-full border-2 border-card bg-card shadow-lg"
    />
  );

  return (
    // The owner's card keeps the owner card's old feel: it does not tilt, because it now holds buttons that must stay under the finger.
    <HoloCard maxTilt={ownerMode ? 0 : undefined}>
      <article className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className={cn("relative aspect-[3/1] sm:aspect-[4/1] overflow-hidden", !profile.cover_image_url && "bg-muted/60")}>
          {profile.cover_image_url && <img src={profile.cover_image_url} alt="" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
          <div className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
            Kretopia · Creative Passport
          </div>
          <Button onClick={ownerMode?.onShare ?? onShare} size="icon" variant="secondary" className="!absolute right-2 top-2 h-9 w-9 rounded-full" aria-label="Share Passport">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative -mt-8 space-y-4 px-5 pb-5">
          {ownerMode ? (
            <div className="relative w-fit">
              {avatar}
              <Button
                size="icon"
                variant="secondary"
                className="!absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full shadow-md"
                onClick={ownerMode.onChangePhoto}
                disabled={ownerMode.isUploadingAvatar}
                aria-label="Change photo"
                title="Change photo"
              >
                {ownerMode.isUploadingAvatar ? <KretopiaSpinner className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
              </Button>
            </div>
          ) : avatar}

          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="break-words text-xl font-black leading-tight tracking-normal">{profile.full_name}</h1>
              {profile.verification_status === "verified" && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary" title="Verified creator">
                  <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <Fingerprint className="h-3 w-3 text-[hsl(var(--signal-teal))]" />
              <span>{passportId}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {profile.username && <span className="font-mono text-foreground/80">@{profile.username}</span>}
              <span>{profile.job_title || profile.role || "Creator"}</span>
              {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>}
              <AvailabilityIndicator status={profile.availability_status || profile.availability} note={profile.availability_note} isOwnProfile={false} />
            </div>
            {Array.isArray(profile.sub_roles) && profile.sub_roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.sub_roles.slice(0, 4).map((role: string) => <Badge key={role} variant="outline" className="h-5 px-1.5 text-[10px]">{role}</Badge>)}
              </div>
            )}
          </div>

           {showBio && profile.bio && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{profile.bio}</p>}

          <BrandLogo size="sm" />
          <TrustSignals emailVerified={profile.email_verified} phoneVerified={profile.phone_verified} idVerified={profile.id_verified} paymentVerified={profile.payment_verified} isOwnProfile={false} compact />

          {ownerMode && (ownerMode.taggedCount ?? 0) > 0 && (
            <p className="text-[11px] font-medium text-foreground">
              {ownerMode.taggedCount} unclaimed credit{ownerMode.taggedCount === 1 ? "" : "s"} tagged to you
            </p>
          )}

          {/* Experience + proof, with the basis for each "verified" spelled out. */}
          {glance}

          {skills.length > 0 && <div className="flex flex-wrap gap-1">{skills.map((skill: string) => <Badge key={skill} variant="outline" className="h-5 px-1.5 text-[10px]">{skill}</Badge>)}</div>}

          {/* The owner's controls, on the card they edit: Edit, Share, QR, press kit and PDF on one line. */}
          {ownerMode && (
            <PassportSmartActions
              pdf={ownerMode.pdf}
              onEdit={ownerMode.onEdit}
              onShare={ownerMode.onShare ?? onShare}
              onShowQR={ownerMode.onShowQR}
              onDownloadEPK={ownerMode.onDownloadEPK}
            />
          )}

          {/* No Instagram, LinkedIn, X, YouTube, Spotify, personal-site or booking
              links here: a Kretopia Passport keeps the conversation on Kretopia,
              and the way in is Connect / Message below. */}

           {showActions && !isOwner && (
            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
              {bookingPath && (
                <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <span className="text-xs font-medium text-foreground">Available to book</span>
                  <Button asChild size="sm" className="gap-1.5">
                    <Link to={bookingPath}><CalendarDays className="h-4 w-4" />Book</Link>
                  </Button>
                </div>
              )}
              {!isSignedIn ? (
                <Button onClick={onJoin} className="col-span-2 gap-2"><UserPlus className="h-4 w-4" />Connect with {profile.full_name?.split(" ")[0] || "this creator"}</Button>
              ) : connected ? (
                <>
                  <Button onClick={onMessage} className="gap-2"><MessageCircle className="h-4 w-4" />Message</Button>
                  <Button onClick={onCollaborate} variant="outline" className="gap-2"><Handshake className="h-4 w-4" />Collaborate</Button>
                  <Button onClick={onAddToProject} variant="outline" className="col-span-2 gap-2"><FolderPlus className="h-4 w-4" />Invite to a project</Button>
                </>
              ) : (
                <Button onClick={onConnect} disabled={connectionStatus === "pending" || isConnecting} className="col-span-2 gap-2">
                  <UserPlus className="h-4 w-4" />{connectionStatus === "pending" ? "Request pending" : isConnecting ? "Sending…" : "Connect"}
                </Button>
              )}
              <p className="col-span-2 text-xs text-muted-foreground">Project invitations require acceptance by the person or company concerned.</p>
            </div>
          )}

           {showActions && isOwner && !ownerMode && <Button onClick={onShare} variant="outline" className="w-full gap-2"><Share2 className="h-4 w-4" />Share Passport</Button>}
           {children && <div className="space-y-5 border-t border-border pt-5">{children}</div>}
        </div>

      </article>
    </HoloCard>
  );
}