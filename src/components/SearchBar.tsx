import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SearchFilters {
  role?: string;
  location?: string;
  minFollowers?: number;
  verified?: boolean;
  skills?: string[];
  availableForWork?: boolean;
}

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  placeholder?: string;
  showFilters?: boolean;
}

export const SearchBar = ({ 
  onSearch, 
  placeholder = "Search creators, opportunities...",
  showFilters = true 
}: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearch = () => {
    onSearch(query, filters);
  };

  const clearFilters = () => {
    setFilters({});
    onSearch(query, {});
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== null).length;

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => {
                setQuery("");
                onSearch("", filters);
              }}
              aria-label="Clear search query"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Button onClick={handleSearch} size="icon" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>

        {showFilters && (
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative" aria-label="Open search filters">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Refine your search results
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select 
                    value={filters.role} 
                    onValueChange={(value) => setFilters({ ...filters, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="Creator">Creator</SelectItem>
                      <SelectItem value="Musician">Musician</SelectItem>
                      <SelectItem value="Photographer">Photographer</SelectItem>
                      <SelectItem value="Videographer">Videographer</SelectItem>
                      <SelectItem value="Designer">Designer</SelectItem>
                      <SelectItem value="Writer">Writer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select 
                    value={filters.location} 
                    onValueChange={(value) => setFilters({ ...filters, location: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="new-york">New York</SelectItem>
                      <SelectItem value="los-angeles">Los Angeles</SelectItem>
                      <SelectItem value="london">London</SelectItem>
                      <SelectItem value="tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Minimum Followers</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[filters.minFollowers || 0]}
                      onValueChange={(value) => setFilters({ ...filters, minFollowers: value[0] })}
                      max={100000}
                      step={1000}
                      className="w-full"
                    />
                    <div className="text-sm text-muted-foreground text-center">
                      {filters.minFollowers ? `${filters.minFollowers.toLocaleString()}+` : 'Any'}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="verified">Verified accounts only</Label>
                  <input
                    type="checkbox"
                    id="verified"
                    checked={filters.verified || false}
                    onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={clearFilters}
                  >
                    Clear All
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      handleSearch();
                      setIsFilterOpen(false);
                    }}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {filters.role && filters.role !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Role: {filters.role}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  const newFilters = { ...filters };
                  delete newFilters.role;
                  setFilters(newFilters);
                  onSearch(query, newFilters);
                }}
              />
            </Badge>
          )}
          {filters.location && filters.location !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Location: {filters.location}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  const newFilters = { ...filters };
                  delete newFilters.location;
                  setFilters(newFilters);
                  onSearch(query, newFilters);
                }}
              />
            </Badge>
          )}
          {filters.minFollowers && (
            <Badge variant="secondary" className="gap-1">
              Min followers: {filters.minFollowers.toLocaleString()}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  const newFilters = { ...filters };
                  delete newFilters.minFollowers;
                  setFilters(newFilters);
                  onSearch(query, newFilters);
                }}
              />
            </Badge>
          )}
          {filters.verified && (
            <Badge variant="secondary" className="gap-1">
              Verified only
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  const newFilters = { ...filters };
                  delete newFilters.verified;
                  setFilters(newFilters);
                  onSearch(query, newFilters);
                }}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};