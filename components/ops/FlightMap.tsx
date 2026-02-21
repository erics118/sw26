"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Flight } from "@/lib/ops/types";
import { Plane } from "lucide-react";

const NEON_GREEN = "#00e696";

// Commercial airliner silhouette SVG - neon green
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

// Aircraft markers component: incremental add/update/remove (no full teardown on dep change)
function AircraftMarkers({
  flights,
  selectedId,
  onSelect,
  onHover,
}: {
  flights: Flight[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (flight: Flight | null) => void;
}) {
  const map = useMap();
  const markersRef = useMemo(() => new Map<string, L.Marker>(), []);

  useEffect(() => {
    const flightIds = new Set(flights.map((f) => f.id));

    // Remove markers for flights no longer in the list
    markersRef.forEach((marker, id) => {
      if (!flightIds.has(id)) {
        marker.remove();
        markersRef.delete(id);
      }
    });

    // Add or update markers for current flights
    flights.forEach((flight) => {
      const icon = createAircraftIcon(flight.heading, flight.id === selectedId);
      const existing = markersRef.get(flight.id);

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
        markersRef.set(flight.id, marker);
      }
    });

    return () => {
      markersRef.forEach((marker) => marker.remove());
      markersRef.clear();
    };
  }, [flights, selectedId, map, onSelect, onHover, markersRef]);

  return null;
}

// Map center controller - flies to selected flight and signals when animation is done
function MapController({
  flight,
  selectedId,
  onFlyComplete,
}: {
  flight: Flight | null;
  selectedId: string | null;
  onFlyComplete: () => void;
}) {
  const map = useMap();
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!flight || !selectedId) return;

    const runId = ++runIdRef.current;
    let settleTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const startTimeoutId = setTimeout(() => {
      if (runId !== runIdRef.current) return;
      map.flyTo([flight.lat, flight.lon], 7, { duration: 1.2 });
      const handler = () => {
        if (runId !== runIdRef.current) return;
        settleTimeoutId = setTimeout(() => {
          if (runId === runIdRef.current) onFlyComplete();
        }, 150);
      };
      map.once("moveend", handler);
    }, 50);

    return () => {
      clearTimeout(startTimeoutId);
      if (settleTimeoutId != null) clearTimeout(settleTimeoutId);
      map.off("moveend");
    };
  }, [flight, selectedId, map, onFlyComplete]);
  return null;
}

// Invalidate map size when container resizes (e.g. drawer open/close)
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: true, pan: false });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

interface FlightMapProps {
  flights: Flight[];
  selectedId: string | null;
  onSelectFlight: (id: string) => void;
  /** Optional timestamp or label for "Last updated"; when omitted, shows placeholder */
  lastUpdated?: string;
}

// Detect when map tiles have loaded
function TileLoadDetector({ onReady }: { onReady: () => void }) {
  const map = useMap();
  useEffect(() => {
    let fired = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (fired) return;
      fired = true;
      if (timeoutId != null) clearTimeout(timeoutId);
      onReady();
    };

    map.whenReady(fire);
    timeoutId = setTimeout(fire, 2000);

    return () => {
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [map, onReady]);
  return null;
}

export default function FlightMap({
  flights,
  selectedId,
  onSelectFlight,
  lastUpdated,
}: FlightMapProps) {
  const [hoveredFlight, setHoveredFlight] = useState<Flight | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [routeVisibleForId, setRouteVisibleForId] = useState<string | null>(
    null,
  );
  const routeVisible = routeVisibleForId === selectedId;

  // Clear route visibility when selection is cleared so we don't show stale route
  useEffect(() => {
    if (selectedId === null) {
      queueMicrotask(() => setRouteVisibleForId(null));
    }
  }, [selectedId]);

  const airborneFlights = useMemo(
    () => flights.filter((f) => f.inAir),
    [flights],
  );
  const selectedFlight = useMemo(
    () => flights.find((f) => f.id === selectedId) ?? null,
    [flights, selectedId],
  );

  const handleHover = useCallback(
    (f: Flight | null) => setHoveredFlight(f),
    [],
  );
  const handleSelect = useCallback(
    (id: string) => onSelectFlight(id),
    [onSelectFlight],
  );
  const handleMapReady = useCallback(() => setMapReady(true), []);
  const handleFlyComplete = useCallback(
    () => setRouteVisibleForId(selectedId ?? null),
    [selectedId],
  );

  return (
    <div className="relative h-full w-full">
      {/* Loading overlay */}
      {!mapReady && (
        <div className="bg-background absolute inset-0 z-1000 flex flex-col items-center justify-center">
          <div className="relative mb-6">
            {/* Radar rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-primary/20 h-24 w-24 animate-[ping_2s_ease-out_infinite] rounded-full border" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-primary/30 h-16 w-16 animate-[ping_2s_ease-out_0.5s_infinite] rounded-full border" />
            </div>
            {/* Center plane icon */}
            <div className="relative flex h-24 w-24 items-center justify-center">
              <Plane
                className="text-primary h-8 w-8 animate-pulse"
                style={{
                  filter: "drop-shadow(0 0 8px hsl(160 100% 45% / 0.6))",
                }}
              />
            </div>
          </div>
          <div className="text-primary animate-pulse font-mono text-xs tracking-[0.3em] uppercase">
            Initializing Map
          </div>
          <div className="mt-3 flex gap-1">
            <span className="bg-primary h-1 w-1 animate-[bounce_1s_ease-in-out_infinite] rounded-full" />
            <span className="bg-primary h-1 w-1 animate-[bounce_1s_ease-in-out_0.2s_infinite] rounded-full" />
            <span className="bg-primary h-1 w-1 animate-[bounce_1s_ease-in-out_0.4s_infinite] rounded-full" />
          </div>
        </div>
      )}

      <MapContainer
        center={[38, -96]}
        zoom={5}
        className="h-full w-full"
        zoomControl={true}
        style={{ background: "hsl(222 30% 5%)" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          opacity={0.7}
        />

        <TileLoadDetector onReady={handleMapReady} />
        <MapResizer />
        <MapController
          flight={selectedFlight}
          selectedId={selectedId}
          onFlyComplete={handleFlyComplete}
        />

        <AircraftMarkers
          flights={airborneFlights}
          selectedId={selectedId}
          onSelect={handleSelect}
          onHover={handleHover}
        />

        {/* Route lines + airport markers ONLY for selected flight */}
        {routeVisible &&
          selectedFlight &&
          selectedFlight.originCoords &&
          selectedFlight.destCoords && (
            <>
              {/* Path already traveled: origin → trail points → current position (continuous line) */}
              {selectedFlight.trail?.length > 1 ? (
                <Polyline
                  positions={[
                    selectedFlight.originCoords,
                    ...selectedFlight.trail,
                    [selectedFlight.lat, selectedFlight.lon],
                  ]}
                  pathOptions={{
                    color: NEON_GREEN,
                    weight: 2,
                    opacity: 0.6,
                  }}
                />
              ) : (
                <Polyline
                  positions={[
                    selectedFlight.originCoords,
                    [selectedFlight.lat, selectedFlight.lon],
                  ]}
                  pathOptions={{
                    color: NEON_GREEN,
                    weight: 2,
                    opacity: 0.6,
                  }}
                />
              )}
              {/* Dashed line: plane -> destination (remaining) */}
              <Polyline
                positions={[
                  [selectedFlight.lat, selectedFlight.lon],
                  selectedFlight.destCoords,
                ]}
                pathOptions={{
                  color: NEON_GREEN,
                  weight: 2,
                  opacity: 0.4,
                  dashArray: "8 12",
                }}
              />
              {/* Origin airport marker - solid fill */}
              <CircleMarker
                center={selectedFlight.originCoords}
                radius={6}
                pathOptions={{
                  color: NEON_GREEN,
                  fillColor: NEON_GREEN,
                  fillOpacity: 0.6,
                  weight: 2,
                  opacity: 0.9,
                }}
              >
                <Tooltip
                  permanent
                  direction="bottom"
                  className="airport-tooltip"
                >
                  {selectedFlight.origin}
                </Tooltip>
              </CircleMarker>
              {/* Destination airport marker - dashed/hollow */}
              <CircleMarker
                center={selectedFlight.destCoords}
                radius={6}
                pathOptions={{
                  color: NEON_GREEN,
                  fillColor: NEON_GREEN,
                  fillOpacity: 0.1,
                  weight: 2,
                  opacity: 0.6,
                  dashArray: "4 4",
                }}
              >
                <Tooltip
                  permanent
                  direction="bottom"
                  className="airport-tooltip"
                >
                  {selectedFlight.destination}
                </Tooltip>
              </CircleMarker>
            </>
          )}
      </MapContainer>

      {/* Hover tooltip */}
      {hoveredFlight && (
        <div
          className="glass-card pointer-events-none absolute z-500 min-w-60 p-3"
          style={{ top: 80, right: 80 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-foreground font-mono text-sm font-bold">
              {hoveredFlight.callsign}
            </span>
            <span
              className={`chip ${
                hoveredFlight.status === "green"
                  ? "status-green"
                  : hoveredFlight.status === "yellow"
                    ? "status-yellow"
                    : "status-red"
              }`}
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

      {/* Last updated (wire lastUpdated from live data when available) */}
      <div className="glass-card absolute bottom-4 left-4 z-500 flex items-center gap-2 px-3 py-1.5">
        <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
        <span className="text-muted-foreground font-mono text-[10px]">
          LAST UPDATED:{" "}
          <span className="text-foreground">{lastUpdated ?? "—"}</span>
        </span>
      </div>
    </div>
  );
}
