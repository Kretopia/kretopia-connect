import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Star, ArrowUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export type SortOption = 'distance' | 'rating' | 'price_low' | 'price_high' | 'newest';

export interface AtlasSearchFilters {
  query: string;
  minRating: number;
  maxPrice: number | null;
  rentableOnly: boolean;
  verifiedOnly: boolean;
  sortBy: SortOption;
}

interface AtlasSearchBarProps {
  filters: AtlasSearchFilters;
  onChange: (filters: AtlasSearchFilters) => void;
}

export const defaultAtlasFilters: AtlasSearchFilters = {
  query: '',
  minRating: 0,
  maxPrice: null,
  rentableOnly: false,
  verifiedOnly: false,
  sortBy: 'distance',
};

export function AtlasSearchBar({ filters, onChange }: AtlasSearchBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const activeFilterCount = [
    filters.minRating > 0,
    filters.maxPrice !== null,
    filters.rentableOnly,
    filters.verifiedOnly,
  ].filter(Boolean).length;

  return (
    <div className="flex gap-2">
      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Search studios, spots, spaces..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Sort */}
      <Select
        value={filters.sortBy}
        onValueChange={(v) => onChange({ ...filters, sortBy: v as SortOption })}
      >
        <SelectTrigger className="w-[130px] h-9 text-xs">
          <ArrowUpDown className="h-3 w-3 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="distance">Nearest</SelectItem>
          <SelectItem value="rating">Top Rated</SelectItem>
          <SelectItem value="price_low">Price: Low</SelectItem>
          <SelectItem value="price_high">Price: High</SelectItem>
          <SelectItem value="newest">Newest</SelectItem>
        </SelectContent>
      </Select>

      {/* Advanced Filters */}
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 relative">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-4" align="end">
          <p className="font-semibold text-sm">Filters</p>

          {/* Min Rating */}
          <div>
            <Label className="text-xs mb-2 flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              Minimum Rating: {filters.minRating > 0 ? `${filters.minRating}+` : 'Any'}
            </Label>
            <Slider
              value={[filters.minRating]}
              onValueChange={([v]) => onChange({ ...filters, minRating: v })}
              min={0}
              max={5}
              step={0.5}
            />
          </div>

          {/* Max Price */}
          <div>
            <Label className="text-xs mb-2 block">
              Max Price/hr: {filters.maxPrice !== null ? `$${filters.maxPrice}` : 'Any'}
            </Label>
            <Slider
              value={[filters.maxPrice ?? 500]}
              onValueChange={([v]) => onChange({ ...filters, maxPrice: v >= 500 ? null : v })}
              min={0}
              max={500}
              step={10}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Rentable Only</Label>
              <Switch
                checked={filters.rentableOnly}
                onCheckedChange={(v) => onChange({ ...filters, rentableOnly: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Verified Only</Label>
              <Switch
                checked={filters.verifiedOnly}
                onCheckedChange={(v) => onChange({ ...filters, verifiedOnly: v })}
              />
            </div>
          </div>

          {/* Reset */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              onChange(defaultAtlasFilters);
              setFiltersOpen(false);
            }}
          >
            Reset All Filters
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
