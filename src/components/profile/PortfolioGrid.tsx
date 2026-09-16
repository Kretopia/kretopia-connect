import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Heart, Play, ExternalLink, Filter } from "lucide-react";
import { ImageLoader } from "@/components/ui/image-loader";
import { cn } from "@/lib/utils";

interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  media_url: string;
  media_type: string;
  thumbnail_url?: string;
  category?: string;
  tags?: string[];
  view_count?: number;
  featured?: boolean;
}

interface PortfolioGridProps {
  items: PortfolioItem[];
  onItemClick?: (item: PortfolioItem) => void;
}

export const PortfolioGrid = ({ items, onItemClick }: PortfolioGridProps) => {
  const [filter, setFilter] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Get unique categories
  const categories = Array.from(new Set(items.map(item => item.category).filter(Boolean)));

  // Filter items
  const filteredItems = filter 
    ? items.filter(item => item.category === filter)
    : items;

  // Sort: featured first
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  if (items.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="text-6xl mb-4"></div>
        <h3 className="text-xl font-semibold">No work to display yet</h3>
        <p className="text-muted-foreground">Portfolio items will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={filter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(null)}
          >
            All Work
          </Button>
          {categories.map(category => (
            <Button
              key={category}
              variant={filter === category ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      )}

      {/* Masonry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {sortedItems.map((item, index) => {
          const isVideo = item.media_type === 'video' || item.media_type === 'youtube' || item.media_type === 'vimeo';
          const isHovered = hoveredId === item.id;
          
          return (
            <Card
              key={item.id}
              className={cn(
                "group relative overflow-hidden cursor-pointer transition-all duration-300",
                "hover:shadow-2xl hover:scale-[1.02]",
                item.featured && "ring-2 ring-primary/50",
                index % 3 === 0 && "lg:row-span-2" // Make some items taller for visual interest
              )}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onItemClick?.(item)}
            >
              {/* Featured Badge */}
              {item.featured && (
                <Badge 
                  className="absolute top-3 right-3 z-10 bg-primary/90 backdrop-blur-sm"
                >
                  Featured
                </Badge>
              )}

              {/* Image/Video Thumbnail */}
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <ImageLoader
                  src={item.thumbnail_url || item.media_url}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                
                {/* Video Play Button */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-transform group-hover:scale-110">
                      <Play className="h-8 w-8 text-primary fill-primary" />
                    </div>
                  </div>
                )}

                {/* Hover Overlay */}
                <div 
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300",
                    isHovered ? "opacity-100" : "opacity-0"
                  )}
                >
                  <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <h3 className="text-white font-semibold text-lg line-clamp-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-white/80 text-sm line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    
                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map(tag => (
                          <Badge 
                            key={tag} 
                            variant="secondary" 
                            className="text-xs bg-white/20 backdrop-blur-sm text-white border-white/30"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-white/80 text-sm">
                      {item.view_count && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{item.view_count}</span>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:text-white hover:bg-white/20 ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick?.(item);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
