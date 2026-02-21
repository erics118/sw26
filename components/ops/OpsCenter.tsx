"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef } from "react";
import { mockFlights, mockAlerts } from "@/lib/ops/mockData";
import FlightDetailDrawer from "./FlightDetailDrawer";

const FlightMap = dynamic(() => import("./FlightMap"), { ssr: false });

const DRAWER_CLOSE_MS = 300;

export default function OpsCenter() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flight used by the drawer — keep the last selected flight around during
  // the close animation so the content doesn't vanish before the slide-out finishes.
  const [drawerFlight, setDrawerFlight] = useState(
    mockFlights.find((f) => f.id === selectedId) ?? null,
  );

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
      setDrawerFlight(mockFlights.find((f) => f.id === id) ?? null);
      setDrawerOpen(true);
    }
  }

  return (
    <div className="flex h-190 overflow-hidden rounded-lg border border-zinc-800">
      <div className="relative flex-1">
        <FlightMap
          flights={mockFlights}
          selectedId={selectedId}
          onSelectFlight={handleSelect}
        />
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
