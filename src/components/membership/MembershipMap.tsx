import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";

interface MembershipMapProps {
  locations: any[];
}

export const MembershipMap = ({ locations }: MembershipMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || locations.length === 0) return;

    // Mapbox public token (safe to include as it's a public token)
    const mapboxToken = "pk.eyJ1IjoiZXRoYW5hdWd1c3RlIiwiYSI6ImNtZzhvbDk0dzAwaHYycnB6eWp4Zjh2OHAifQ.4uCSa5SdtxZAnC2Xvx6V5w";
    
    mapboxgl.accessToken = mapboxToken;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [locations[0]?.longitude || 0, locations[0]?.latitude || 0],
      zoom: 12,
    });

    // Add markers for each location
    locations.forEach((location) => {
      const el = document.createElement("div");
      el.className = "marker";
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.backgroundImage = "url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)";
      el.style.backgroundSize = "100%";

      const escapeHtml = (s: unknown) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div>
          <h3 class="font-semibold">${escapeHtml(location.name)}</h3>
          <p class="text-sm text-muted-foreground">${escapeHtml(location.address)}</p>
          <p class="text-sm font-semibold text-primary">+${escapeHtml(location.points_per_visit)} points</p>
        </div>`
      );

      new mapboxgl.Marker(el)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map.current!);
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [locations]);

  if (locations.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No locations to display</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div ref={mapContainer} className="w-full h-[500px]" />
    </Card>
  );
};
