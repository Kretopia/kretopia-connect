import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Shield, MapPin, Circle, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export type LocationPrecision = 'exact' | 'approximate' | 'area_only';

interface LocationPrivacySelectProps {
  value: LocationPrecision;
  onChange: (value: LocationPrecision) => void;
  disabled?: boolean;
  className?: string;
}

const precisionOptions = [
  {
    value: 'area_only' as const,
    label: 'Area Only',
    description: '~5km radius',
    icon: Globe,
    color: 'text-green-500',
    recommendation: 'Most Private',
  },
  {
    value: 'approximate' as const,
    label: 'Approximate',
    description: '~1.5km radius',
    icon: Circle,
    color: 'text-amber-500',
    recommendation: 'Recommended',
  },
  {
    value: 'exact' as const,
    label: 'Exact Location',
    description: 'Precise position',
    icon: MapPin,
    color: 'text-red-500',
    recommendation: 'Less Private',
  },
];

export const LocationPrivacySelect = ({
  value,
  onChange,
  disabled,
  className,
}: LocationPrivacySelectProps) => {
  const selectedOption = precisionOptions.find(opt => opt.value === value) || precisionOptions[1];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-sm font-medium flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        Location Privacy
      </Label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as LocationPrecision)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[200px] bg-background">
          <SelectValue>
            <div className="flex items-center gap-2">
              <selectedOption.icon className={cn("h-4 w-4", selectedOption.color)} />
              <span>{selectedOption.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background border z-50">
          {precisionOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <option.icon className={cn("h-4 w-4", option.color)} />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                    {option.value === 'approximate' && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {option.recommendation}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {value === 'exact' 
          ? "Others see your precise location. Not recommended for safety."
          : value === 'approximate'
          ? "Others see an approximate area. Good balance of discoverability and privacy."
          : "Others only see your general area. Best for privacy."}
      </p>
    </div>
  );
};
