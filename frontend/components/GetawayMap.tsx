"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { POIBase } from "@/lib/getaway";
import { iconForPoiType } from "@/lib/poi";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

const MARKER_COLORS: Record<string, string> = {
  getaway: "var(--accent)",
  activity: "#34d399",
  restaurant: "#fbbf24",
  flight: "#60a5fa",
  poi: "#a78bfa",
  note: "#9ca3af",
};

function poiLabel(poi: POIBase): string {
  if (poi.title?.trim()) return poi.title.trim();
  if (poi.poi_type === "getaway") return "Getaway";
  return iconForPoiType(poi.poi_type) + " " + poi.poi_type;
}

function createMarkerIcon(poiType: string, L: typeof import("leaflet")) {
  if (poiType === "getaway") {
    return L.divIcon({
      className: "map-marker-accent",
      html: `<div style="
          width: 20px;
          height: 20px;
          background: var(--accent);
          border: 2px solid rgba(255,255,255,0.9);
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  const color = MARKER_COLORS[poiType] ?? MARKER_COLORS.poi;
  const emoji = iconForPoiType(poiType);
  return L.divIcon({
    className: "map-marker-poi",
    html: `<div style="
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.9);
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        font-size: 13px;
        line-height: 1;
      ">${emoji}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    const L = require("leaflet");
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
  }, [map, points]);
  return null;
}

export default function GetawayMap({
  pois,
  isLoading = false,
  onPoiClick,
}: {
  pois: POIBase[];
  isLoading?: boolean;
  onPoiClick?: (poiId: string) => void;
}) {
  const withCoords = useMemo(
    () =>
      pois.filter(
        (p): p is POIBase & { lat: number; lng: number } =>
          p.lat != null && p.lng != null
      ),
    [pois]
  );

  const points = useMemo(
    () => withCoords.map((p) => [p.lat, p.lng] as [number, number]),
    [withCoords]
  );

  if (isLoading) {
    return (
      <div className="getaway-map getaway-map--loading">
        <p>Loading map…</p>
      </div>
    );
  }

  if (withCoords.length === 0) {
    return (
      <div className="getaway-map getaway-map--empty">
        <p>No items with location data yet.</p>
        <p className="getaway-map__hint">
          Scout listings to geocode getaways, or add pins on the board with a
          location.
        </p>
      </div>
    );
  }

  const L = typeof window !== "undefined" ? require("leaflet") : null;

  return (
    <div className="getaway-map">
      <MapContainer
        center={[withCoords[0].lat, withCoords[0].lng]}
        zoom={6}
        className="getaway-map__container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>, Geocoding by <a href="https://opencagedata.com">OpenCage</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {points.length > 0 && <FitBounds points={points} />}
        {withCoords.map((poi) => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lng]}
            icon={L ? createMarkerIcon(poi.poi_type, L) : undefined}
            eventHandlers={{
              click: () => onPoiClick?.(poi.id),
            }}
          >
            <Popup>
              <strong>{poiLabel(poi)}</strong>
              {(poi.location || poi.address) && (
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    fontSize: "0.85em",
                    color: "var(--muted)",
                  }}
                >
                  {[poi.location, poi.address].filter(Boolean).join(", ")}
                </p>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
