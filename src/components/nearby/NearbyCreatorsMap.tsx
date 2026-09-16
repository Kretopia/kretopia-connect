import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface NearbyCreator {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  bio: string | null;
  location: string | null;
  professional_skills: any;
  latitude: number;
  longitude: number;
  distance_km: number;
}

interface NearbyCreatorsMapProps {
  creators: NearbyCreator[];
  userLocation: { lat: number; lng: number };
  selectedCreator: NearbyCreator | null;
  onSelectCreator: (creator: NearbyCreator | null) => void;
  loading?: boolean;
}

export const NearbyCreatorsMap = ({
  creators,
  userLocation,
  selectedCreator,
  onSelectCreator,
  loading,
}: NearbyCreatorsMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Mapbox public token
  const mapboxToken = "pk.eyJ1IjoiZXRoYW5hdWd1c3RlIiwiYSI6ImNtZzhvbDk0dzAwaHYycnB6eWp4Zjh2OHAifQ.4uCSa5SdtxZAnC2Xvx6V5w";

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [userLocation.lng, userLocation.lat],
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    
    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Add user location marker
    const userEl = document.createElement("div");
    userEl.className = "user-location-marker";
    userEl.innerHTML = `
      <div class="relative">
        <div class="absolute -inset-2 rounded-full bg-primary/30 animate-ping"></div>
        <div class="relative h-4 w-4 rounded-full bg-primary border-2 border-white shadow-lg"></div>
      </div>
    `;

    userMarker.current = new mapboxgl.Marker(userEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update user location marker
  useEffect(() => {
    if (userMarker.current && userLocation) {
      userMarker.current.setLngLat([userLocation.lng, userLocation.lat]);
      map.current?.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 11,
      });
    }
  }, [userLocation]);

  // Update creator markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Escape user-controlled strings to prevent stored XSS in marker/popup HTML
    const escapeHtml = (s: string | null | undefined) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const safeUrl = (u: string | null | undefined) => {
      const s = String(u ?? "");
      return /^https?:\/\//i.test(s) ? escapeHtml(s) : "";
    };

    // Add creator markers
    creators.forEach((creator) => {
      const el = document.createElement("div");
      el.className = "creator-marker cursor-pointer";

      const isSelected = selectedCreator?.user_id === creator.user_id;
      const safeName = escapeHtml(creator.full_name);
      const safeRole = escapeHtml(creator.role);
      const safeAvatar = safeUrl(creator.avatar_url);
      const initial = escapeHtml(creator.full_name?.charAt(0) || "U");

      el.innerHTML = `
        <div class="relative transition-transform ${isSelected ? 'scale-125' : 'hover:scale-110'}">
          <div class="h-10 w-10 rounded-full overflow-hidden border-2 ${isSelected ? 'border-primary shadow-lg shadow-primary/30' : 'border-white'} bg-background">
            ${safeAvatar
              ? `<img src="${safeAvatar}" alt="${safeName}" class="h-full w-full object-cover" />`
              : `<div class="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-semibold">${initial}</div>`
            }
          </div>
          ${isSelected ? `
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary"></div>
          ` : ''}
        </div>
      `;

      el.addEventListener("click", () => {
        onSelectCreator(creator);
      });

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'creator-popup'
      }).setHTML(`
        <div class="p-2 min-w-[150px]">
          <p class="font-semibold text-sm">${safeName}</p>
          <p class="text-xs text-gray-500">${safeRole}</p>
          <p class="text-xs text-primary mt-1">${creator.distance_km < 1
            ? `${Math.round(creator.distance_km * 1000)}m away`
            : `${creator.distance_km.toFixed(1)}km away`
          }</p>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([creator.longitude, creator.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [creators, selectedCreator, mapLoaded, onSelectCreator]);

  // Fly to selected creator
  useEffect(() => {
    if (selectedCreator && map.current) {
      map.current.flyTo({
        center: [selectedCreator.longitude, selectedCreator.latitude],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [selectedCreator]);

  return (
    <Card className="overflow-hidden relative">
      <div ref={mapContainer} className="w-full h-[500px] lg:h-[600px]" />
      
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary border border-white"></div>
          <span>Your location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-muted border-2 border-white"></div>
          <span>Nearby creators</span>
        </div>
      </div>
      
      {/* Creator count */}
      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm font-medium">
        {creators.length} creators nearby
      </div>
    </Card>
  );
};
