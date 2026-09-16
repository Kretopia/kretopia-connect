import { useEffect, useMemo, useRef } from "react";
// Use namespace import to avoid Vite optimizeDeps "DomUtil export missing" error
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2 } from "lucide-react";
import type { CreativeLocation } from "./LocationListItem";
import { fuzzyCoordinates } from "@/lib/fuzzyLocation";
import { getMaskedName } from "./NearbyCreatorCard";

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
  location_precision?: "exact" | "approximate" | "area_only";
}

interface NearbySession {
  id: string;
  title: string;
  description?: string;
  category: string;
  venue_name?: string;
  venue_address?: string;
  start_time: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  participant_count: number;
  max_participants: number;
  creator_name: string;
  creator_avatar?: string;
  created_by: string;
}

export type MapItemType = "creator" | "session" | "location";

interface UnifiedNearbyMapProps {
  creators: NearbyCreator[];
  sessions: NearbySession[];
  locations: CreativeLocation[];
  userLocation: { lat: number; lng: number };
  selectedItem: { type: MapItemType; id: string } | null;
  onSelectCreator: (creator: NearbyCreator | null) => void;
  onSelectSession: (session: NearbySession | null) => void;
  onSelectLocation: (location: CreativeLocation | null) => void;
  loading?: boolean;
  connectedIds?: Set<string>;
}

const EMPTY_CONNECTED_IDS = new Set<string>();

const LOCATION_TYPE_EMOJI: Record<string, string> = {
  studio: "🎙",
  creative_space: "🏛️",
  shoot_spot: "📸",
  venue: "🎭",
  music_store: "🎵",
  art_supply: "🛒",
  photo_lab: "📷",
  rental_house: "🏠",
};

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const getHslToken = (token: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value ? `hsl(${value})` : fallback;
};

const sanitizeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDistanceLabel = (distanceKm: number) =>
  distanceKm < 1 ? `~${Math.round(distanceKm * 1000)}m away` : `~${distanceKm.toFixed(1)}km away`;

interface MarkerPalette {
  primary: string;
  primarySoft: string;
  background: string;
  foreground: string;
  border: string;
  muted: string;
}

const buildUserIcon = (palette: MarkerPalette) =>
  L.divIcon({
    className: "",
    html: `
      <div style="position: relative; width: 20px; height: 20px; display: grid; place-items: center;">
        <div style="position: absolute; inset: -6px; border-radius: 9999px; background: ${palette.primarySoft}; opacity: 0.9;"></div>
        <div style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background: ${palette.primary}; border: 2px solid ${palette.background}; box-shadow: 0 0 0 2px ${palette.primarySoft};"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const buildCreatorIcon = ({
  label,
  avatarUrl,
  selected,
  palette,
}: {
  label: string;
  avatarUrl: string | null;
  selected: boolean;
  palette: MarkerPalette;
}) =>
  L.divIcon({
    className: "",
    html: `
      <div style="position: relative; width: 44px; height: 44px; transform: scale(${selected ? 1.1 : 1}); transition: transform 160ms ease;">
        <div style="position: absolute; inset: -4px; border-radius: 9999px; background: ${palette.primarySoft}; opacity: ${selected ? 1 : 0.7};"></div>
        <div style="position: relative; width: 44px; height: 44px; border-radius: 9999px; overflow: hidden; border: 2px solid ${selected ? palette.primary : palette.border}; background: ${palette.background}; display: flex; align-items: center; justify-content: center; color: ${palette.primary}; font-size: 14px; font-weight: 700; box-shadow: 0 10px 24px rgba(0,0,0,0.18);">
          ${avatarUrl ? `<img src="${sanitizeHtml(avatarUrl)}" alt="${sanitizeHtml(label)}" style="width: 100%; height: 100%; object-fit: cover;" />` : sanitizeHtml(label.charAt(0) || "U")}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });

const buildSessionIcon = ({
  count,
  avatarUrl,
  label,
  selected,
  palette,
}: {
  count: number;
  avatarUrl?: string;
  label: string;
  selected: boolean;
  palette: MarkerPalette;
}) =>
  L.divIcon({
    className: "",
    html: `
      <div style="position: relative; width: 46px; height: 46px; transform: scale(${selected ? 1.12 : 1}); transition: transform 160ms ease;">
        <div style="position: absolute; inset: -5px; border-radius: 9999px; background: ${palette.primarySoft}; opacity: ${selected ? 1 : 0.72};"></div>
        <div style="position: relative; width: 46px; height: 46px; border-radius: 9999px; overflow: hidden; border: 3px dashed ${palette.primary}; background: ${palette.background}; display: flex; align-items: center; justify-content: center; color: ${palette.primary}; font-size: 12px; font-weight: 700; box-shadow: 0 10px 24px rgba(0,0,0,0.18);">
          ${avatarUrl ? `<img src="${sanitizeHtml(avatarUrl)}" alt="${sanitizeHtml(label)}" style="width: 100%; height: 100%; object-fit: cover;" />` : "EV"}
        </div>
        <div style="position: absolute; right: -2px; bottom: -2px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9999px; background: ${palette.primary}; color: ${palette.background}; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; border: 2px solid ${palette.background};">
          ${count}
        </div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -23],
  });

const buildLocationIcon = ({
  emoji,
  selected,
  palette,
}: {
  emoji: string;
  selected: boolean;
  palette: MarkerPalette;
}) =>
  L.divIcon({
    className: "",
    html: `
      <div style="position: relative; width: 42px; height: 42px; transform: scale(${selected ? 1.08 : 1}); transition: transform 160ms ease;">
        <div style="position: absolute; inset: -4px; border-radius: 14px; background: ${palette.primarySoft}; opacity: ${selected ? 1 : 0.68};"></div>
        <div style="position: relative; width: 42px; height: 42px; border-radius: 14px; border: 2px solid ${palette.primary}; background: ${palette.background}; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 10px 24px rgba(0,0,0,0.18);">
          ${emoji}
        </div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -20],
  });

const creatorPopupHtml = ({
  creator,
  displayName,
  connected,
}: {
  creator: NearbyCreator;
  displayName: string;
  connected: boolean;
}) => `
  <div style="display:flex;flex-direction:column;gap:6px;min-width:170px;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:hsl(var(--primary));">Creator</div>
    <p style="margin:0;font-size:14px;font-weight:600;">${sanitizeHtml(displayName)}</p>
    <p style="margin:0;font-size:12px;color:hsl(var(--muted-foreground));">${sanitizeHtml(creator.role || "Creative")}</p>
    <p style="margin:0;font-size:12px;color:hsl(var(--primary));">${sanitizeHtml(formatDistanceLabel(creator.distance_km))}</p>
    <p style="margin:0;font-size:10px;color:hsl(var(--muted-foreground));font-style:italic;">Approximate location</p>
    ${!connected ? '<p style="margin:0;font-size:10px;color:hsl(var(--primary));">Connect to see full profile</p>' : ""}
  </div>
`;

const sessionPopupHtml = (session: NearbySession) => {
  const startTime = new Date(session.start_time);
  return `
    <div style="display:flex;flex-direction:column;gap:6px;min-width:180px;">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:hsl(var(--primary));">Event</div>
      <p style="margin:0;font-size:14px;font-weight:600;">${sanitizeHtml(session.title)}</p>
      <p style="margin:0;font-size:12px;color:hsl(var(--muted-foreground));">${sanitizeHtml(startTime.toLocaleDateString([], { month: "short", day: "numeric" }))} · ${sanitizeHtml(startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</p>
      ${session.venue_name ? `<p style="margin:0;font-size:12px;color:hsl(var(--muted-foreground));">${sanitizeHtml(session.venue_name)}</p>` : ""}
      <p style="margin:0;font-size:12px;color:hsl(var(--primary));">${session.participant_count}/${session.max_participants} joined</p>
    </div>
  `;
};

const locationPopupHtml = (location: CreativeLocation) => `
  <div style="display:flex;flex-direction:column;gap:6px;min-width:180px;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:hsl(var(--primary));">
      ${sanitizeHtml(location.location_type.replace("_", " "))}
    </div>
    <p style="margin:0;font-size:14px;font-weight:600;">${sanitizeHtml(location.name)}</p>
    ${location.address ? `<p style="margin:0;font-size:12px;color:hsl(var(--muted-foreground));">${sanitizeHtml(location.address)}</p>` : ""}
    ${location.average_rating ? `<p style="margin:0;font-size:12px;color:hsl(var(--primary));">⭐ ${location.average_rating.toFixed(1)}</p>` : ""}
  </div>
`;

export const UnifiedNearbyMap = ({
  creators,
  sessions,
  locations,
  userLocation,
  selectedItem,
  onSelectCreator,
  onSelectSession,
  onSelectLocation,
  loading,
  connectedIds = EMPTY_CONNECTED_IDS,
}: UnifiedNearbyMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLookupRef = useRef<Map<string, L.Marker>>(new Map());

  const palette = useMemo<MarkerPalette>(
    () => ({
      primary: getHslToken("--primary", "hsl(221 83% 53%)"),
      primarySoft: getHslToken("--accent", "hsl(221 83% 53% / 0.24)"),
      background: getHslToken("--background", "hsl(222 47% 11%)"),
      foreground: getHslToken("--foreground", "hsl(210 40% 98%)"),
      border: getHslToken("--border", "hsl(217 33% 24%)"),
      muted: getHslToken("--muted-foreground", "hsl(215 20% 65%)"),
    }),
    [],
  );

  const creatorPoints = useMemo(
    () =>
      creators.map((creator) => {
        const fuzzy = fuzzyCoordinates(
          creator.latitude,
          creator.longitude,
          creator.user_id,
          creator.location_precision || "approximate",
        );

        return {
          creator,
          lat: fuzzy.lat,
          lng: fuzzy.lng,
          connected: connectedIds.has(creator.user_id),
        };
      }),
    [connectedIds, creators],
  );

  const selectedTarget = useMemo(() => {
    if (!selectedItem) return null;

    if (selectedItem.type === "creator") {
      const match = creatorPoints.find(({ creator }) => creator.user_id === selectedItem.id);
      return match ? { lat: match.lat, lng: match.lng, zoom: 13 } : null;
    }

    if (selectedItem.type === "session") {
      const match = sessions.find((session) => session.id === selectedItem.id);
      return match ? { lat: match.latitude, lng: match.longitude, zoom: 13 } : null;
    }

    const location = locations.find((item) => item.id === selectedItem.id);
    return location ? { lat: location.latitude, lng: location.longitude, zoom: 14 } : null;
  }, [creatorPoints, locations, selectedItem, sessions]);

  const allPoints = useMemo<Array<[number, number]>>(
    () => [
      [userLocation.lat, userLocation.lng],
      ...creatorPoints.map(({ lat, lng }) => [lat, lng] as [number, number]),
      ...sessions.map((session) => [session.latitude, session.longitude] as [number, number]),
      ...locations.map((location) => [location.latitude, location.longitude] as [number, number]),
    ],
    [creatorPoints, locations, sessions, userLocation.lat, userLocation.lng],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      preferCanvas: true,
      attributionControl: true,
    }).setView([userLocation.lat, userLocation.lng], 11);

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    const timers = [0, 120, 320].map((delay) =>
      window.setTimeout(() => {
        map.invalidateSize();
      }, delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      markerLookupRef.current.clear();
      markersLayerRef.current?.clearLayers();
      map.remove();
      markersLayerRef.current = null;
      mapRef.current = null;
    };
  }, [userLocation.lat, userLocation.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedTarget) {
      map.flyTo([selectedTarget.lat, selectedTarget.lng], selectedTarget.zoom, {
        animate: true,
        duration: 0.8,
      });
      return;
    }

    if (allPoints.length > 1) {
      map.fitBounds(allPoints, {
        padding: [32, 32],
        maxZoom: 13,
      });
      return;
    }

    map.setView([userLocation.lat, userLocation.lng], 11);
  }, [allPoints, selectedTarget, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markerLookupRef.current.clear();

    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: buildUserIcon(palette),
      keyboard: false,
    }).bindPopup(
      `<div style="display:flex;flex-direction:column;gap:4px;min-width:170px;">
        <p style="margin:0;font-size:14px;font-weight:600;">Your location</p>
        <p style="margin:0;font-size:12px;color:hsl(var(--muted-foreground));">Used to discover nearby creators, events, and spots.</p>
      </div>`,
      { closeButton: false, offset: [0, -14], className: "nearby-map-popup" },
    );
    userMarker.addTo(layerGroup);

    creatorPoints.forEach(({ creator, lat, lng, connected }) => {
      const displayName = getMaskedName(creator.full_name, connected);
      const isSelected = selectedItem?.type === "creator" && selectedItem.id === creator.user_id;
      const marker = L.marker([lat, lng], {
        icon: buildCreatorIcon({
          label: displayName,
          avatarUrl: connected ? creator.avatar_url : null,
          selected: isSelected,
          palette,
        }),
      })
        .on("click", () => {
          onSelectCreator(creator);
          onSelectSession(null);
          onSelectLocation(null);
        })
        .bindPopup(creatorPopupHtml({ creator, displayName, connected }), {
          closeButton: false,
          offset: [0, -18],
          className: "nearby-map-popup",
        });

      marker.addTo(layerGroup);
      markerLookupRef.current.set(`creator:${creator.user_id}`, marker);
    });

    sessions.forEach((session) => {
      const isSelected = selectedItem?.type === "session" && selectedItem.id === session.id;
      const marker = L.marker([session.latitude, session.longitude], {
        icon: buildSessionIcon({
          count: session.participant_count,
          avatarUrl: session.creator_avatar,
          label: session.title,
          selected: isSelected,
          palette,
        }),
      })
        .on("click", () => {
          onSelectSession(session);
          onSelectCreator(null);
          onSelectLocation(null);
        })
        .bindPopup(sessionPopupHtml(session), {
          closeButton: false,
          offset: [0, -18],
          className: "nearby-map-popup",
        });

      marker.addTo(layerGroup);
      markerLookupRef.current.set(`session:${session.id}`, marker);
    });

    locations.forEach((location) => {
      const isSelected = selectedItem?.type === "location" && selectedItem.id === location.id;
      const marker = L.marker([location.latitude, location.longitude], {
        icon: buildLocationIcon({
          emoji: LOCATION_TYPE_EMOJI[location.location_type] || "📍",
          selected: isSelected,
          palette,
        }),
      })
        .on("click", () => {
          onSelectLocation(location);
          onSelectCreator(null);
          onSelectSession(null);
        })
        .bindPopup(locationPopupHtml(location), {
          closeButton: false,
          offset: [0, -18],
          className: "nearby-map-popup",
        });

      marker.addTo(layerGroup);
      markerLookupRef.current.set(`location:${location.id}`, marker);
    });

    window.requestAnimationFrame(() => map.invalidateSize());
  }, [
    creatorPoints,
    loading,
    locations,
    onSelectCreator,
    onSelectLocation,
    onSelectSession,
    palette,
    selectedItem,
    sessions,
    userLocation.lat,
    userLocation.lng,
  ]);

  useEffect(() => {
    if (!selectedItem) return;
    markerLookupRef.current.get(`${selectedItem.type}:${selectedItem.id}`)?.openPopup();
  }, [selectedItem]);

  return (
    <div className="relative h-full w-full min-h-[300px] overflow-hidden bg-muted/30">
      {/* Subtle grid skeleton so the map area never looks blank-black before tiles load */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)/0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div ref={mapContainerRef} className="relative h-full w-full" />

      {(loading || !userLocation) && (
        <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-background/75 backdrop-blur-[1px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">
            {!userLocation ? "Finding your area…" : "Loading map…"}
          </p>
        </div>
      )}
    </div>
  );
};
