import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Search, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface LocationResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  text: string;
}

interface LocationSearchInputProps {
  value: string;
  onSelect: (result: { address: string; venueName: string; lat: number; lng: number }) => void;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MAPBOX_TOKEN = "pk.eyJ1IjoiZXRoYW5hdWd1c3RlIiwiYSI6ImNtZzhvbDk0dzAwaHYycnB6eWp4Zjh2OHAifQ.4uCSa5SdtxZAnC2Xvx6V5w";

// Extract coords from Google Maps links
const extractGoogleMapsCoords = (url: string): { lat: number; lng: number; name?: string } | null => {
  try {
    // Patterns: 
    // https://maps.google.com/?q=LAT,LNG
    // https://www.google.com/maps/place/NAME/@LAT,LNG,...
    // https://www.google.com/maps/@LAT,LNG,...
    // https://goo.gl/maps/... (short links - can't parse without redirect)
    // https://maps.app.goo.gl/... 
    
    let match;
    
    // @LAT,LNG pattern
    match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    
    // ?q=LAT,LNG pattern
    match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    
    // place/NAME/@LAT,LNG pattern
    match = url.match(/\/place\/([^/]+)\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return { 
        lat: parseFloat(match[2]), 
        lng: parseFloat(match[3]),
        name: decodeURIComponent(match[1]).replace(/\+/g, ' ')
      };
    }

    return null;
  } catch {
    return null;
  }
};

const isGoogleMapsLink = (text: string): boolean => {
  return /google\.com\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(text);
};

// Search using Nominatim (OSM) - free, no key needed, good global coverage
const searchNominatim = async (query: string): Promise<LocationResult[]> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return data.map((item: any) => ({
      id: `nom-${item.place_id}`,
      place_name: item.display_name,
      center: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
      text: item.name || item.display_name.split(',')[0],
    }));
  } catch {
    return [];
  }
};

// Search using Mapbox as fallback
const searchMapbox = async (query: string): Promise<LocationResult[]> => {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,place&limit=5`
    );
    const data = await res.json();
    return data.features?.map((f: any) => ({
      id: f.id,
      place_name: f.place_name,
      center: f.center,
      text: f.text,
    })) || [];
  } catch {
    return [];
  }
};

// Reverse geocode coordinates to get an address
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export const LocationSearchInput = ({ value, onSelect, onChange, placeholder }: LocationSearchInputProps) => {
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Check if it's a Google Maps link pasted into the search
    if (isGoogleMapsLink(query)) {
      handleGoogleLink(query);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Search both sources in parallel, prefer Nominatim results
        const [nominatimResults, mapboxResults] = await Promise.all([
          searchNominatim(query),
          searchMapbox(query),
        ]);

        // Merge: Nominatim first, then unique Mapbox results
        const seen = new Set(nominatimResults.map(r => r.text.toLowerCase()));
        const merged = [
          ...nominatimResults,
          ...mapboxResults.filter(r => !seen.has(r.text.toLowerCase())),
        ].slice(0, 6);

        setResults(merged);
        setOpen(merged.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleGoogleLink = async (link: string) => {
    const coords = extractGoogleMapsCoords(link);
    if (!coords) return;

    setLoading(true);
    try {
      const address = await reverseGeocode(coords.lat, coords.lng);
      onSelect({
        address,
        venueName: coords.name || address.split(',')[0],
        lat: coords.lat,
        lng: coords.lng,
      });
      onChange(address);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteLink = async () => {
    if (!linkValue.trim()) return;

    const coords = extractGoogleMapsCoords(linkValue);
    if (!coords) return;

    setLinkLoading(true);
    try {
      const address = await reverseGeocode(coords.lat, coords.lng);
      onSelect({
        address,
        venueName: coords.name || address.split(',')[0],
        lat: coords.lat,
        lng: coords.lng,
      });
      onChange(address);
      setShowLinkInput(false);
      setLinkValue("");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSelect = (result: LocationResult) => {
    onSelect({
      address: result.place_name,
      venueName: result.text,
      lat: result.center[1],
      lng: result.center[0],
    });
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder || "Search for a location..."}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleSelect(result)}
              className={cn(
                "flex items-start gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium truncate">{result.text}</p>
                <p className="text-xs text-muted-foreground truncate">{result.place_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Paste Google Maps link option */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs gap-1.5 text-muted-foreground h-auto py-1 px-2"
        onClick={() => setShowLinkInput(!showLinkInput)}
      >
        <Link2 className="h-3.5 w-3.5" />
        Paste Google Maps link
      </Button>

      {showLinkInput && (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Input
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="https://maps.google.com/..."
            className="text-sm flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={handlePasteLink}
            disabled={!linkValue.trim() || !isGoogleMapsLink(linkValue) || linkLoading}
          >
            {linkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Set"}
          </Button>
        </div>
      )}
    </div>
  );
};
