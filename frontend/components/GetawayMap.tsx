"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
  getaways,
  onGetawayClick,
}: {
  getaways: { id: string; name?: string; location?: string; region?: string; lat?: number; lng?: number }[];
  onGetawayClick?: (getawayId: string) => void;
}) {
  const withCoords = useMemo(
    () =>
      getaways.filter(
        (g) => g.lat != null && g.lng != null
      ) as { id: string; name?: string; location?: string; region?: string; lat: number; lng: number }[],
    [getaways]
  );

  const points = useMemo(
    () => withCoords.map((g) => [g.lat, g.lng] as [number, number]),
    [withCoords]
  );

  if (withCoords.length === 0) {
    return (
      <div className="getaway-map getaway-map--empty">
        <p>No getaways with location data yet. Paste listings to geocode them.</p>
        <p className="getaway-map__hint">Geocoding runs when you paste listing text.</p>
      </div>
    );
  }

  const L = typeof window !== "undefined" ? require("leaflet") : null;
  const AccentIcon = L
    ? L.divIcon({
        className: "map-marker-accent",
        html: `<div style="
          width: 20px;
          height: 20px;
          background: #c45c26;
          border: 2px solid rgba(255,255,255,0.9);
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
    : null;

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
        {withCoords.map((g) => (
          <Marker
            key={g.id}
            position={[g.lat, g.lng]}
            icon={AccentIcon ?? undefined}
            eventHandlers={{
              click: () => onGetawayClick?.(g.id),
            }}
          >
            <Popup>
              <strong>{g.name || "Getaway"}</strong>
              {(g.location || g.region) && (
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.85em", color: "var(--muted)" }}>
                  {[g.location, g.region].filter(Boolean).join(", ")}
                </p>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
