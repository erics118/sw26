"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect } from "react";
import { mockAlerts } from "@/lib/ops/mockData";
import type { Flight } from "@/lib/ops/types";
import FlightDetailDrawer from "./FlightDetailDrawer";

const FlightMap = dynamic(() => import("./FlightMap"), { ssr: false });

const DRAWER_CLOSE_MS = 300;

export default function OpsCenter() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flight used by the drawer — keep the last selected flight around during
  // the close animation so the content doesn't vanish before the slide-out finishes.
  const [drawerFlight, setDrawerFlight] = useState<Flight | null>(null);

  // Fetch aircraft positions on mount
  useEffect(() => {
    async function fetchAircraftPositions() {
      try {
        const response = await fetch("/api/aircraft-positions");
        if (response.ok) {
          const data = await response.json();
          setFlights(data.flights || []);
        }
      } catch (error) {
        console.error("Failed to fetch aircraft positions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAircraftPositions();
  }, []);

  const startClose = useCallback(() => {
    setDrawerClosing(true);
    closeTimer.current = setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
      setSelectedId(null);
    }, DRAWER_CLOSE_MS);
  }, []);

  function handleSelect(id: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);

    if (id === selectedId && drawerOpen) {
      startClose();
    } else {
      setDrawerClosing(false);
      setSelectedId(id);
      const selected = flights.find((f) => f.id === id) ?? null;
      setDrawerFlight(selected);
      setDrawerOpen(true);
    }
  }

  return (
    <div className="flex h-[640px] overflow-hidden rounded-lg border border-zinc-800">
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center bg-zinc-900">
            <p className="text-zinc-500">Loading aircraft positions...</p>
          </div>
        ) : (
          <FlightMap
            flights={flights}
            selectedId={selectedId}
            onSelectFlight={handleSelect}
          />
        )}
      </div>
      {drawerOpen && (
        <FlightDetailDrawer
          flight={drawerFlight}
          alerts={mockAlerts}
          open={!drawerClosing}
          onClose={startClose}
        />
      )}
    </div>
  );
}
