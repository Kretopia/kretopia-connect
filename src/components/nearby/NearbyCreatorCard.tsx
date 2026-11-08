import { StatusAvatar } from "@/components/ui/status-avatar";
import { MapPin, User, Lock } from "lucide-react";
import { CardRow } from "@/components/cards/CardRow";
import { CardPill } from "@/components/cards/CardShell";
import { CARD_ICON_BTN } from "@/components/cards/cardTokens";
import { UserActionMenu } from "@/components/user/UserActionMenu";
import { maskCreatorName } from "@/lib/guestUtils";

export interface NearbyCreator {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  bio: string | null;
  location: string | null;
  professional_skills: any;
  latitude: number;
  longitude: number;
  distance_km: number;
  location_precision?: 'exact' | 'approximate' | 'area_only';
}

export const getSkills = (skills: any): string[] => {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills.slice(0, 3).map((s: any) => typeof s === 'string' ? s : s.skill || s.name || '');
  }
  return [];
};

export const formatDistance = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
};

/** Get masked display name for non-connected users */
export const getMaskedName = (fullName: string, isConnected: boolean): string => {
  if (isConnected) return fullName;
  return maskCreatorName(fullName, false); // Use guest masking (First + Initial)
};

const DistancePill = ({ km }: { km: number }) => (
  <CardPill className="text-primary"><MapPin className="h-3 w-3" aria-hidden />{formatDistance(km)}</CardPill>
);

interface CreatorCardProps {
  creator: NearbyCreator;
  onViewProfile: (userId: string) => void;
  onMessage: (userId: string) => void;
  isConnected?: boolean;
  onBlocked?: () => void;
}

/**
 * A creator near the viewer, as a row of the shared card. Who they are stays as private as before: someone the viewer is not connected to
 * shows a lock instead of a picture, a first name and an initial, and no bio. The card is not itself a link; its two buttons are.
 */
export const CreatorCard = ({ creator, onViewProfile, onMessage, isConnected = false, onBlocked }: CreatorCardProps) => {
  const skills = getSkills(creator.professional_skills).filter(Boolean);
  const displayName = getMaskedName(creator.full_name, isConnected);

  return (
    <CardRow
      testId={`nearby-creator-${creator.user_id}`}
      title={displayName}
      lead={
        isConnected ? (
          <StatusAvatar src={creator.avatar_url} fallback={creator.full_name?.charAt(0) || 'U'} size="lg" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
        )
      }
      meta={creator.role}
      description={isConnected ? creator.bio : null}
      tags={[<DistancePill key="distance" km={creator.distance_km} />, ...skills.map((skill, i) => <CardPill key={`${skill}-${i}`}>{skill}</CardPill>)]}
      controls={<UserActionMenu targetUserId={creator.user_id} targetUserName={displayName} onBlocked={onBlocked} triggerClassName="h-7 w-7 text-muted-foreground" />}
      secondary={{ label: isConnected ? "Profile" : "View", onClick: () => onViewProfile(creator.user_id) }}
      primary={{ label: isConnected ? "Message" : "Connect", onClick: () => onMessage(creator.user_id) }}
    />
  );
};

interface CreatorListItemProps {
  creator: NearbyCreator;
  isSelected: boolean;
  onClick: () => void;
  onViewProfile: (userId: string) => void;
  isConnected?: boolean;
}

/** A creator in the map's sidebar: the row selects them on the map; the icon opens their profile. */
export const CreatorListItem = ({ creator, isSelected, onClick, onViewProfile, isConnected = false }: CreatorListItemProps) => {
  const skills = getSkills(creator.professional_skills).filter(Boolean);
  const displayName = getMaskedName(creator.full_name, isConnected);

  return (
    <CardRow
      testId={`nearby-creator-row-${creator.user_id}`}
      title={displayName}
      open={{ onClick }}
      selected={isSelected}
      lead={
        isConnected ? (
          <StatusAvatar src={creator.avatar_url} fallback={creator.full_name?.charAt(0) || 'U'} size="md" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <span className="text-sm font-medium text-muted-foreground">{creator.full_name?.charAt(0) || 'U'}</span>
          </div>
        )
      }
      meta={creator.role}
      tags={[<DistancePill key="distance" km={creator.distance_km} />, skills[0] ? <CardPill key="skill">{skills[0]}</CardPill> : null]}
      controls={
        <button type="button" className={CARD_ICON_BTN} aria-label={`View ${displayName}'s profile`} onClick={() => onViewProfile(creator.user_id)}>
          <User className="h-4 w-4" aria-hidden />
        </button>
      }
    />
  );
};
