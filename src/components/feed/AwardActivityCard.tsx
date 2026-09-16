import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Award, ExternalLink } from "lucide-react";

interface AwardActivityCardProps {
  item: {
    id: string;
    title: string;
    organization: string;
    year: number | null;
    category: string | null;
    description: string | null;
    image_url: string | null;
    verification_url: string | null;
    created_at: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
      role: string;
    };
  };
}

export const AwardActivityCard = ({ item }: AwardActivityCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all">
      {item.image_url && (
        <div className="relative aspect-video bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
          <img 
            src={item.image_url} 
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <Badge className="absolute top-2 right-2 bg-background/90 backdrop-blur">
            <Award className="h-3 w-3 mr-1 text-yellow-500" />
            Award
          </Badge>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={item.profiles.avatar_url || undefined} />
            <AvatarFallback>{item.profiles.full_name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{item.profiles.full_name}</p>
            <p className="text-xs text-muted-foreground">{item.profiles.role}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex items-start gap-3">
          {!item.image_url && (
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Award className="h-6 w-6 text-yellow-500" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-semibold mb-1">{item.title}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {item.organization} {item.year && `• ${item.year}`}
            </p>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {item.description}
              </p>
            )}
            {item.category && (
              <Badge variant="secondary" className="text-xs">
                {item.category}
              </Badge>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          {item.verification_url ? (
            <a 
              href={item.verification_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Verify
            </a>
          ) : (
            <div />
          )}
          <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Card>
  );
};
