import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Award, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface Credit {
  id: string;
  project_name: string;
  role: string;
  year?: number;
  platform?: string;
  url?: string;
  thumbnail_url?: string;
  is_featured?: boolean;
}

interface ExperienceTimelineProps {
  credits: Credit[];
  awards?: any[];
}

export const ExperienceTimeline = ({ credits, awards = [] }: ExperienceTimelineProps) => {
  // Combine credits and awards, sort by year
  const experiences = [
    ...credits.map(c => ({ ...c, type: 'credit' as const })),
    ...awards.map(a => ({ ...a, type: 'award' as const }))
  ].sort((a, b) => (b.year || 0) - (a.year || 0));

  if (experiences.length === 0) {
    return (
      <Card className="p-8 text-center space-y-3">
        <div className="text-5xl mb-2"></div>
        <h3 className="text-xl font-semibold">No experience listed yet</h3>
        <p className="text-muted-foreground">Work history and achievements will appear here</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Experience & Credits</h2>
      </div>

      {/* Timeline */}
      <div className="relative space-y-6 before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
        {experiences.map((exp, index) => {
          const isCredit = exp.type === 'credit';
          const Icon = isCredit ? Briefcase : Award;
          
          return (
            <div 
              key={exp.id} 
              className="relative pl-14 group"
            >
              {/* Timeline Dot */}
              <div className={cn(
                "absolute left-0 h-12 w-12 rounded-xl flex items-center justify-center",
                "border-2 border-border bg-card shadow-sm",
                "group-hover:border-primary group-hover:shadow-lg transition-all",
                exp.is_featured && "border-primary"
              )}>
                <Icon className={cn(
                  "h-5 w-5",
                  exp.is_featured ? "text-primary" : "text-muted-foreground"
                )} />
              </div>

              {/* Content Card */}
              <Card className={cn(
                "p-4 md:p-6 space-y-3 hover:shadow-lg transition-all",
                exp.is_featured && "ring-2 ring-primary/50"
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">
                        {isCredit ? exp.project_name : exp.title}
                      </h3>
                      {exp.is_featured && (
                        <Badge variant="default" className="text-xs">Featured</Badge>
                      )}
                    </div>
                    
                    <p className="text-muted-foreground">
                      {isCredit ? exp.role : exp.organization}
                    </p>
                    
                    {exp.platform && (
                      <Badge variant="secondary" className="text-xs">
                        {exp.platform}
                      </Badge>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    {exp.year && (
                      <div className="text-sm font-medium text-muted-foreground">
                        {exp.year}
                      </div>
                    )}
                    {isCredit && exp.url && (
                      <a 
                        href={exp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {exp.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {exp.description}
                  </p>
                )}

                {/* Thumbnail for credits */}
                {isCredit && exp.thumbnail_url && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    <img
                      src={exp.thumbnail_url}
                      alt={exp.project_name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};
