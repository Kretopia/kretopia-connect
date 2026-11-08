import { Star, MapPin, DollarSign, Camera, Building2, Palette, Music, ShoppingBag, Headphones, Bookmark, BookmarkCheck, BadgeCheck } from "lucide-react";
import { CardRow } from "@/components/cards/CardRow";
import { CardPill } from "@/components/cards/CardShell";
import { CARD_ICON_BTN, CARD_ICON_BTN_ON } from "@/components/cards/cardTokens";
import { cn } from "@/lib/utils";

interface CreativeLocation {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  location_type: string;
  category?: string;
  address?: string;
  city?: string;
  latitude: number;
  longitude: number;
  cover_image_url?: string;
  image_urls?: string[];
  tags?: string[];
  amenities?: string[];
  is_rentable?: boolean;
  price_per_hour?: number;
  price_currency?: string;
  average_rating?: number;
  review_count?: number;
  is_verified?: boolean;
  contact_info?: string;
  website_url?: string;
  creator_name?: string;
  creator_avatar?: string;
  claimed_by_user_id?: string;
  distance_km: number;
}

interface LocationListItemProps {
  location: CreativeLocation;
  isSelected: boolean;
  onClick: () => void;
  formatDistance: (km: number) => string;
  isBookmarked?: boolean;
  onToggleBookmark?: (e: React.MouseEvent) => void;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  studio: { icon: Music, color: 'text-primary', label: 'Studio' },
  creative_space: { icon: Palette, color: 'text-emerald-500', label: 'Space' },
  shoot_spot: { icon: Camera, color: 'text-rose-500', label: 'Spot' },
  venue: { icon: Building2, color: 'text-primary', label: 'Venue' },
  music_store: { icon: Headphones, color: 'text-primary', label: 'Music Store' },
  art_supply: { icon: ShoppingBag, color: 'text-orange-500', label: 'Art Supply' },
  rental_house: { icon: Building2, color: 'text-teal-500', label: 'Rental House' },
  photo_lab: { icon: Camera, color: 'text-pink-500', label: 'Photo Lab' },
};

/** A creative location in the map's sidebar, as a row of the shared card: the row selects it on the map; the bookmark saves it without selecting. */
export function LocationListItem({ location, isSelected, onClick, formatDistance, isBookmarked, onToggleBookmark }: LocationListItemProps) {
  const config = TYPE_CONFIG[location.location_type] || TYPE_CONFIG.shoot_spot;
  const Icon = config.icon;
  const rated = (location.average_rating ?? 0) > 0;

  return (
    <CardRow
      testId={`nearby-location-${location.id}`}
      title={location.name}
      open={{ onClick }}
      selected={isSelected}
      lead={
        location.cover_image_url ? (
          <div className="h-11 w-11 overflow-hidden rounded-[10px]">
            <img src={location.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-muted">
            <Icon className={cn("h-5 w-5", config.color)} aria-hidden />
          </div>
        )
      }
      eyebrow={
        <>
          <CardPill tone="type"><Icon className={cn("h-3 w-3", config.color)} aria-hidden />{config.label}</CardPill>
          {location.is_verified ? <CardPill tone="origin"><BadgeCheck className="h-3 w-3" aria-hidden />Verified</CardPill> : null}
        </>
      }
      tags={[
        <CardPill key="distance" className="text-primary"><MapPin className="h-3 w-3" aria-hidden />{formatDistance(location.distance_km)}</CardPill>,
        rated ? <CardPill key="rating"><Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden />{Number(location.average_rating).toFixed(1)}</CardPill> : null,
        location.is_rentable && location.price_per_hour ? (
          <CardPill key="price"><DollarSign className="h-3 w-3" aria-hidden />{location.price_per_hour}/{location.price_currency || 'USD'}/hr</CardPill>
        ) : null,
      ]}
      controls={
        onToggleBookmark ? (
          <button
            type="button"
            className={cn(CARD_ICON_BTN, isBookmarked && CARD_ICON_BTN_ON)}
            aria-pressed={!!isBookmarked}
            aria-label={isBookmarked ? `Remove ${location.name} from your bookmarks` : `Bookmark ${location.name}`}
            onClick={(e) => onToggleBookmark(e)}
          >
            {isBookmarked ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
          </button>
        ) : null
      }
    />
  );
}

export type { CreativeLocation };
