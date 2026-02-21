"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Flight } from "@/lib/ops/types";
import { Plane } from "lucide-react";

const NEON_GREEN = "#00e696";
const LINE_OPTS = { color: NEON_GREEN, weight: 2 };

/** DOM-based circle icons so start/end stay stable during map fly (no SVG glitch) */
function createRoutePointIcon(kind: "origin" | "dest") {
  const isOrigin = kind === "origin";
  const style = isOrigin
    ? `width:12px;height:12px;border-radius:50%;background:${NEON_GREEN};opacity:0.9;border:1px solid ${NEON_GREEN};`
    : `width:12px;height:12px;border-radius:50%;background:${NEON_GREEN};opacity:0.15;border:2px dashed ${NEON_GREEN};`;
  return L.divIcon({
    html: `<div style="${style}"></div>`,
    className: "route-point-marker",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}
const ORIGIN_ICON = createRoutePointIcon("origin");
const DEST_ICON = createRoutePointIcon("dest");

function createAircraftIcon(heading: number, selected: boolean) {
  const size = selected ? 36 : 26;
  const glow = selected ? 10 : 5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="${NEON_GREEN}" stroke="${selected ? "#fff" : "none"}" stroke-width="${selected ? 0.4 : 0}" style="transform: rotate(${heading}deg); filter: drop-shadow(0 0 ${glow}px ${NEON_GREEN});">
    <path d="M16 2 C15.2 2 14.5 2.8 14.5 4 L14.5 11 L4 16.5 L4 19 L14.5 16 L14.5 25 L11 27.5 L11 29.5 L16 28 L21 29.5 L21 27.5 L17.5 25 L17.5 16 L28 19 L28 16.5 L17.5 11 L17.5 4 C17.5 2.8 16.8 2 16 2Z"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "aircraft-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function AircraftMarkers({
  flights,
  selectedId,
  onSelect,
  onHover,
}: {
  flights: Flight[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (f: Flight | null) => void;
}) {
  const map = useMap();
  const markersRef = useRef(new Map<string, L.Marker>());

  useEffect(() => {
    const ref = markersRef.current;
    const ids = new Set(flights.map((f) => f.id));

    ref.forEach((marker, id) => {
      if (!ids.has(id)) {
        marker.remove();
        ref.delete(id);
      }
    });

    flights.forEach((flight) => {
      const icon = createAircraftIcon(flight.heading, flight.id === selectedId);
      const existing = ref.get(flight.id);
      if (existing) {
        existing.setLatLng([flight.lat, flight.lon]);
        existing.setIcon(icon);
        existing.setZIndexOffset(flight.id === selectedId ? 1000 : 0);
      } else {
        const marker = L.marker([flight.lat, flight.lon], {
          icon,
          zIndexOffset: flight.id === selectedId ? 1000 : 0,
        });
        marker.on("click", () => onSelect(flight.id));
        marker.on("mouseover", () => onHover(flight));
        marker.on("mouseout", () => onHover(null));
        marker.addTo(map);
        ref.set(flight.id, marker);
      }
    });

    return () => {
      ref.forEach((m) => m.remove());
      ref.clear();
    };
  }, [flights, selectedId, map, onSelect, onHover]);

  return null;
}

/** One place: map ready, resize, fly to selection */
function MapSetup({
  onReady,
  selectedFlight,
}: {
  onReady: () => void;
  selectedFlight: Flight | null;
}) {
  const map = useMap();

  useEffect(() => {
    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      onReady();
    };
    map.whenReady(fire);
    const t = setTimeout(fire, 2000);
    return () => clearTimeout(t);
  }, [map, onReady]);

  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => {
    if (!selectedFlight) return;
    map.flyTo([selectedFlight.lat, selectedFlight.lon], map.getZoom(), {
      duration: 1.2,
    });
    // Intentionally depend only on id so we don't re-fly when flight object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedFlight?.id]);

  return null;
}

interface FlightMapProps {
  flights: Flight[];
  selectedId: string | null;
  onSelectFlight: (id: string) => void;
  lastUpdated?: string;
}

export default function FlightMap({
  flights,
  selectedId,
  onSelectFlight,
  lastUpdated,
}: FlightMapProps) {
  const [hoveredFlight, setHoveredFlight] = useState<Flight | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const airborneFlights = useMemo(
    () => flights.filter((f) => f.inAir),
    [flights],
  );
  const selectedFlight = flights.find((f) => f.id === selectedId) ?? null;

  const showRoute = selectedFlight?.originCoords && selectedFlight?.destCoords;
  const traveledPositions = useMemo((): [number, number][] | null => {
    if (!showRoute || !selectedFlight) return null;
    return selectedFlight.trail?.length > 1
      ? [
          selectedFlight.originCoords,
          ...selectedFlight.trail,
          [selectedFlight.lat, selectedFlight.lon],
        ]
      : [selectedFlight.originCoords, [selectedFlight.lat, selectedFlight.lon]];
  }, [showRoute, selectedFlight]);
  const remainingPositions = useMemo((): [number, number][] | null => {
    if (!showRoute || !selectedFlight) return null;
    return [
      [selectedFlight.lat, selectedFlight.lon],
      selectedFlight.destCoords,
    ];
  }, [showRoute, selectedFlight]);

  return (
    <div className="relative h-full w-full">
      {!mapReady && (
        <div className="bg-background absolute inset-0 z-1000 flex flex-col items-center justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="border-primary/20 absolute inset-0 animate-[ping_2s_ease-out_infinite] rounded-full border" />
            <Plane
              className="text-primary relative h-8 w-8 animate-pulse"
              style={{ filter: "drop-shadow(0 0 8px hsl(160 100% 45% / 0.6))" }}
            />
          </div>
          <div className="text-primary mt-4 font-mono text-xs tracking-widest uppercase">
            Loading map
          </div>
        </div>
      )}

      <MapContainer
        center={[38, -96]}
        zoom={5}
        className="h-full w-full"
        zoomControl
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        keyboard
        style={{ background: "hsl(222 30% 5%)" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          opacity={0.7}
        />
        <MapSetup
          onReady={() => setMapReady(true)}
          selectedFlight={selectedId ? selectedFlight : null}
        />
        <AircraftMarkers
          flights={airborneFlights}
          selectedId={selectedId}
          onSelect={onSelectFlight}
          onHover={setHoveredFlight}
        />

        {showRoute &&
          selectedFlight &&
          traveledPositions &&
          remainingPositions && (
            <>
              <Polyline
                key={`traveled-${selectedId}`}
                positions={traveledPositions}
                pathOptions={{ ...LINE_OPTS, opacity: 0.6 }}
              />
              <Polyline
                key={`remaining-${selectedId}`}
                positions={remainingPositions}
                pathOptions={{ ...LINE_OPTS, opacity: 0.4, dashArray: "8 12" }}
              />
              <Marker
                key={`origin-${selectedId}`}
                position={selectedFlight.originCoords}
                icon={ORIGIN_ICON}
              >
                <Tooltip
                  permanent
                  direction="bottom"
                  className="airport-tooltip"
                >
                  {selectedFlight.origin}
                </Tooltip>
              </Marker>
              <Marker
                key={`dest-${selectedId}`}
                position={selectedFlight.destCoords}
                icon={DEST_ICON}
              >
                <Tooltip
                  permanent
                  direction="bottom"
                  className="airport-tooltip"
                >
                  {selectedFlight.destination}
                </Tooltip>
              </Marker>
            </>
          )}
      </MapContainer>

      {hoveredFlight && (
        <div className="glass-card pointer-events-none absolute top-20 right-20 z-500 min-w-60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-foreground font-mono text-sm font-bold">
              {hoveredFlight.callsign}
            </span>
            <span
              className={`chip ${hoveredFlight.status === "green" ? "status-green" : hoveredFlight.status === "yellow" ? "status-yellow" : "status-red"}`}
            >
              {hoveredFlight.status}
            </span>
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            <div>
              Tail:{" "}
              <span className="text-foreground font-mono">
                {hoveredFlight.tail}
              </span>
            </div>
            <div>
              Route:{" "}
              <span className="text-foreground font-mono">
                {hoveredFlight.origin} → {hoveredFlight.destination}
              </span>
            </div>
            <div>
              Alt:{" "}
              <span className="text-foreground font-mono">
                {hoveredFlight.altitude.toLocaleString()} ft
              </span>
            </div>
            <div>
              GS:{" "}
              <span className="text-foreground font-mono">
                {hoveredFlight.groundspeed} kts
              </span>
            </div>
            <div>
              ETA:{" "}
              <span className="text-foreground font-mono">
                {hoveredFlight.eta}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card pointer-events-none absolute bottom-4 left-4 z-500 flex items-center gap-2 px-3 py-1.5">
        <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
        <span className="text-muted-foreground font-mono text-[10px]">
          LAST UPDATED:{" "}
          <span className="text-foreground">{lastUpdated ?? "—"}</span>
        </span>
      </div>
    </div>
  );
}
