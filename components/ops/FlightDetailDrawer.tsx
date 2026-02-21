"use client";

import {
  X,
  Plane,
  Users,
  AlertTriangle,
  Wrench,
  ChevronRight,
  CloudLightning,
  MapPin,
  Shield,
} from "lucide-react";
import type { Flight, Alert } from "@/lib/ops/types";

interface FlightDetailDrawerProps {
  flight: Flight | null;
  alerts: Alert[];
  open: boolean;
  onClose: () => void;
}

const alertTypeIcon: Record<string, typeof AlertTriangle> = {
  Weather: CloudLightning,
  NOTAM: MapPin,
  Maintenance: Wrench,
  Crew: Shield,
};

export default function FlightDetailDrawer({
  flight,
  alerts,
  open,
  onClose,
}: FlightDetailDrawerProps) {
  if (!flight) return null;

  const flightAlerts = alerts.filter((a) => a.flightId === flight.id);

  return (
    <div
      className={`glass-panel border-border/50 flex h-full w-[380px] flex-col overflow-hidden border-l duration-300 ${
        open
          ? "animate-in slide-in-from-right"
          : "animate-out slide-out-to-right"
      }`}
    >
      {/* Header */}
      <div className="border-border/50 flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Plane className="text-primary h-4 w-4" />
          <h3 className="text-foreground text-sm font-semibold">
            Flight Details
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {/* Flight card */}
        <div className="glass-card neon-glow p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-foreground font-mono text-lg font-bold">
                {flight.callsign}
              </div>
              <div className="text-muted-foreground text-xs">
                {flight.tail} • {flight.aircraftType}
              </div>
            </div>
            <span
              className={`chip text-xs ${
                flight.status === "green"
                  ? "status-green"
                  : flight.status === "yellow"
                    ? "status-yellow"
                    : "status-red"
              }`}
            >
              {flight.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <div>
                <span className="text-muted-foreground">Route</span>
                <div className="text-foreground flex items-center gap-1 font-mono font-medium">
                  {flight.origin}{" "}
                  <ChevronRight className="text-primary h-3 w-3" />{" "}
                  {flight.destination}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">ETD</span>
                <div className="text-foreground font-mono font-medium">
                  {flight.etd}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Altitude</span>
                <div className="text-foreground font-mono font-medium">
                  {flight.altitude.toLocaleString()} ft
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-muted-foreground">Client</span>
                <div className="text-foreground font-medium">
                  {flight.client}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">ETA</span>
                <div className="text-foreground font-mono font-medium">
                  {flight.eta}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> PAX
                </span>
                <div className="text-foreground font-mono font-medium">
                  {flight.pax}
                </div>
              </div>
            </div>
          </div>

          {/* Risk reasons */}
          {flight.reasons.length > 0 && (
            <div className="border-border/30 mt-3 border-t pt-3">
              <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                Risk Factors
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {flight.reasons.map((r) => (
                  <span
                    key={r}
                    className={`chip ${
                      flight.status === "red" ? "status-red" : "status-yellow"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
              Alerts ({flightAlerts.length})
            </span>
          </div>
          {flightAlerts.length > 0 ? (
            <div className="space-y-2">
              {flightAlerts.map((alert) => {
                const Icon = alertTypeIcon[alert.type] || AlertTriangle;
                return (
                  <div key={alert.id} className="glass-card p-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                          alert.severity === "red"
                            ? "text-danger"
                            : "text-warning"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span
                            className={`chip text-[8px] ${
                              alert.severity === "red"
                                ? "status-red"
                                : "status-yellow"
                            }`}
                          >
                            {alert.type}
                          </span>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {alert.timestamp}
                          </span>
                        </div>
                        <p className="text-foreground text-xs font-medium">
                          {alert.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                          {alert.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card p-4 text-center">
              <p className="text-muted-foreground text-xs">
                No alerts for this flight
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
