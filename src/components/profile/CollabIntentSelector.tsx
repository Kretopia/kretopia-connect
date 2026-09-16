import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Briefcase, HandCoins, Handshake, Users, Coffee } from "lucide-react";

export const COLLAB_INTENTS = [
  { 
    value: 'looking_to_hire', 
    label: 'Looking to Hire', 
    icon: Briefcase,
    color: 'bg-primary',
    description: 'I have projects and budget to hire creators'
  },
  { 
    value: 'available_for_hire', 
    label: 'Available for Hire', 
    icon: HandCoins,
    color: 'bg-green-500',
    description: 'I\'m open to paid work and freelance gigs'
  },
  { 
    value: 'open_to_trade', 
    label: 'Open to Trade', 
    icon: Handshake,
    color: 'bg-primary',
    description: 'Let\'s exchange skills - no money needed'
  },
  { 
    value: 'seeking_collaborators', 
    label: 'Seeking Collaborators', 
    icon: Users,
    color: 'bg-orange-500',
    description: 'Looking for creative partners on projects'
  },
  { 
    value: 'just_networking', 
    label: 'Just Networking', 
    icon: Coffee,
    color: 'bg-gray-500',
    description: 'Building connections, no specific project yet'
  },
] as const;

export type CollabIntentValue = typeof COLLAB_INTENTS[number]['value'];

interface CollabIntentSelectorProps {
  value: string | null;
  onChange: (value: CollabIntentValue) => void;
}

export const CollabIntentSelector = ({ value, onChange }: CollabIntentSelectorProps) => {
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">What are you looking for?</Label>
      <p className="text-sm text-muted-foreground">
        Help others understand your collaboration goals
      </p>
      <div className="grid gap-2">
        {COLLAB_INTENTS.map((intent) => {
          const Icon = intent.icon;
          const isSelected = value === intent.value;
          
          return (
            <button
              key={intent.value}
              type="button"
              onClick={() => onChange(intent.value)}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                isSelected 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className={`p-2 rounded-full ${intent.color}`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <span className="font-medium">{intent.label}</span>
                <p className="text-xs text-muted-foreground">{intent.description}</p>
              </div>
              {isSelected && (
                <Badge variant="default" className="ml-auto">Selected</Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Badge component for displaying intent on cards
interface CollabIntentBadgeProps {
  intent: string | null | undefined;
  size?: 'sm' | 'md';
}

export const CollabIntentBadge = ({ intent, size = 'md' }: CollabIntentBadgeProps) => {
  if (!intent) return null;
  
  const intentData = COLLAB_INTENTS.find(i => i.value === intent);
  if (!intentData) return null;
  
  const Icon = intentData.icon;
  
  return (
    <Badge 
      className={`${intentData.color} text-white border-0 gap-1 ${
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'px-3 py-1'
      }`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {intentData.label}
    </Badge>
  );
};
