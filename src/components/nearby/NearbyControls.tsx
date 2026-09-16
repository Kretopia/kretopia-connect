import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, RefreshCw, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LocationPrivacySelect, type LocationPrecision } from "@/components/nearby/LocationPrivacySelect";

interface NearbyControlsProps {
  radius: number;
  onRadiusChange: (v: number) => void;
  locationVisible: boolean;
  onToggleVisibility: () => void;
  locationPrecision: LocationPrecision;
  onPrecisionChange: (p: LocationPrecision) => void;
  onRefresh: () => void;
  loading: boolean;
  hasLocation: boolean;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
}

export const NearbyControls = ({
  radius, onRadiusChange, locationVisible, onToggleVisibility,
  locationPrecision, onPrecisionChange, onRefresh, loading, hasLocation,
  filtersOpen, onFiltersOpenChange,
}: NearbyControlsProps) => {
  const VisibilityToggle = ({ id }: { id: string }) => (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={locationVisible} onCheckedChange={onToggleVisibility} />
      <Label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
        {locationVisible ? (
          <><Eye className="h-4 w-4 text-primary" /><span>Visible on map</span></>
        ) : (
          <><EyeOff className="h-4 w-4 text-muted-foreground" /><span>Hidden from map</span></>
        )}
      </Label>
    </div>
  );

  const RadiusSlider = ({ className }: { className?: string }) => (
    <div className={className}>
      <Label className="text-sm font-medium mb-2 block">Search Radius: {radius}km</Label>
      <Slider value={[radius]} onValueChange={(v) => onRadiusChange(v[0])} min={5} max={100} step={5} className="w-full lg:w-64" />
    </div>
  );

  return (
    <>
      {/* Mobile collapsible */}
      <Collapsible open={filtersOpen} onOpenChange={onFiltersOpenChange} className="lg:hidden">
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Filters</span>
                <Badge variant="secondary" className="text-xs">{radius}km • {locationVisible ? 'Visible' : 'Hidden'}</Badge>
              </div>
              {filtersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-4">
              <RadiusSlider />
              <VisibilityToggle id="location-visible-mobile" />
              {locationVisible && <LocationPrivacySelect value={locationPrecision} onChange={onPrecisionChange} />}
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={!hasLocation || loading} className="w-full">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Results
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Desktop always-visible */}
      <Card className="hidden lg:block">
        <CardContent className="py-4">
          <div className="flex flex-row items-center gap-6">
            <RadiusSlider className="flex-1" />
            <VisibilityToggle id="location-visible-desktop" />
            {locationVisible && <LocationPrivacySelect value={locationPrecision} onChange={onPrecisionChange} />}
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={!hasLocation || loading} className="shrink-0">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
