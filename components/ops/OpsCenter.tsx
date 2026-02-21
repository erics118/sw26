"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { mockFlights, mockAlerts } from "@/lib/ops/mockData";
import FlightDetailDrawer from "./FlightDetailDrawer";

const FlightMap = dynamic(() => import("./FlightMap"), { ssr: false });

export default function OpsCenter() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selectedFlight = mockFlights.find((f) => f.id === selectedId) ?? null;

  function handleSelect(id: string) {
    if (id === selectedId) {
      setSelectedId(null);
      setDrawerOpen(false);
    } else {
      setSelectedId(id);
      setDrawerOpen(true);
    }
  }

  return (
    <div className="flex h-[640px] overflow-hidden rounded-lg border border-zinc-800">
      <div className="relative flex-1">
        <FlightMap
          flights={mockFlights}
          selectedId={selectedId}
          onSelectFlight={handleSelect}
        />
      </div>
      {drawerOpen && (
        <FlightDetailDrawer
          flight={selectedFlight}
          alerts={mockAlerts}
          open={drawerOpen}
          onClose={() => {
            setSelectedId(null);
            setDrawerOpen(false);
          }}
        />
      )}
    </div>
  );
}
