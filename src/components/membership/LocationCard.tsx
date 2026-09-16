import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star } from "lucide-react";

interface LocationCardProps {
  location: any;
  onCheckIn?: () => void;
}

export const LocationCard = ({ location, onCheckIn }: LocationCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex">
        {location.image_url && (
          <div 
            className="w-32 h-32 bg-cover bg-center flex-shrink-0"
            style={{ backgroundImage: `url(${location.image_url})` }}
          />
        )}
        <div className="p-4 flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-lg">{location.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {location.type}
              </p>
            </div>
            <Badge variant="outline" className="capitalize">
              {location.tier_required}
            </Badge>
          </div>
          
          {location.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {location.description}
            </p>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4" />
            <span>{location.city}, {location.country}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span className="font-semibold">{location.points_per_visit} points per visit</span>
            </div>
            {onCheckIn && (
              <Button size="sm" onClick={onCheckIn}>
                Check In
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
