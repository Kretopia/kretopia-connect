import { useNavigate } from "react-router-dom";
import { Briefcase, Folder, Calendar, User, Award, Heart, Radio } from "lucide-react";

export type SharedContentType = "gig" | "project" | "event" | "profile" | "credit" | "campaign" | "stage";

interface SharedContentCardProps {
  type: SharedContentType;
  id: string;
  meta?: {
    title?: string;
    subtitle?: string;
    image_url?: string;
  };
  isOwn: boolean;
}

const ICONS: Record<SharedContentType, React.ComponentType<{ className?: string }>> = {
  gig: Briefcase,
  project: Folder,
  event: Calendar,
  profile: User,
  credit: Award,
  campaign: Heart,
  stage: Radio,
};

const LABELS: Record<SharedContentType, string> = {
  gig: "Gig",
  project: "Project",
  event: "Event",
  profile: "Profile",
  credit: "Credit",
  campaign: "Fund Campaign",
  stage: "Stage",
};

const ROUTES: Record<SharedContentType, (id: string) => string> = {
  gig: (id) => `/opportunities/${id}`,
  project: (id) => `/project/${id}`,
  event: (id) => `/event/${id}`,
  profile: (id) => `/profile/${id}`,
  credit: (id) => `/production?id=${id}`,
  campaign: (id) => `/fund/${id}`,
  // Sound Stages have no dedicated per-stage route (confirmed in the On
  // Stage audit) -- the same ?join= deep link the Share dialog's copy-link
  // action produces, handled by LiveCallsPanel's joinStageId prop.
  stage: (id) => `/circle?tab=stages&join=${id}`,
};

export const SharedContentCard = ({ type, id, meta, isOwn }: SharedContentCardProps) => {
  const navigate = useNavigate();
  const Icon = ICONS[type];

  return (
    <button
      onClick={() => navigate(ROUTES[type](id))}
      className={`flex items-stretch gap-2 rounded-2xl overflow-hidden border max-w-[280px] text-left transition-all hover:scale-[1.02] ${
        isOwn ? "bg-primary/15 border-primary/40" : "bg-muted border-border"
      }`}
    >
      {meta?.image_url ? (
        <img src={meta.image_url} alt={meta.title || ""} className="w-16 h-16 object-cover flex-shrink-0" />
      ) : (
        <div className="w-16 h-16 flex items-center justify-center bg-primary/10 flex-shrink-0">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0 py-2 pr-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5 flex items-center gap-1">
          <Icon className="h-3 w-3" />
          {LABELS[type]}
        </p>
        <p className="text-sm font-semibold truncate leading-tight">{meta?.title || `Shared ${LABELS[type].toLowerCase()}`}</p>
        {meta?.subtitle && <p className="text-xs text-muted-foreground truncate">{meta.subtitle}</p>}
      </div>
    </button>
  );
};
