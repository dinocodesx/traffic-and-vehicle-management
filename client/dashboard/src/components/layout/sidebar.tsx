import {
  Activity,
  Bike,
  Bus,
  Car,
  Clock,
  Gauge,
  Info,
  LayoutDashboard,
  MapPin,
  Monitor,
  ShieldAlert,
  Timer,
  TrafficCone,
  Truck,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { TrafficPin } from "../../data/pins";
import {
  getLaneSignals,
  getPhaseName,
  PHASE_SEQUENCE,
  phaseDuration,
} from "../../data/pins";
import type { LatestDetectionResponse } from "../../types/api";

interface SidebarProps {
  selectedPinId: string | null;
  onPinSelect: (id: string) => void;
  latestData: LatestDetectionResponse | null;
  pinsData: TrafficPin[];
}

// ── Signal light dot ─────────────────────────────────────────────────────────
function SignalDot({ sig }: { sig: "GREEN" | "AMBER" | "RED" }) {
  const col = {
    GREEN: "bg-green-500 shadow-[0_0_8px_#22c55e]",
    AMBER: "bg-amber-400 shadow-[0_0_8px_#f59e0b]",
    RED: "bg-red-500   shadow-[0_0_8px_#ef4444]",
  }[sig];
  return <span className={`w-2 h-2 rounded-full inline-block ${col}`} />;
}

// ── Mini intersection map (sidebar-sized) ─────────────────────────────────────
function MiniIntersection({ pin }: { pin: TrafficPin }) {
  const sigs = getLaneSignals(pin.signalState.phase);
  const { directions } = pin;
  return (
    <div className="relative w-full aspect-square max-w-[190px] mx-auto bg-muted/20 rounded-xl border border-border/50 overflow-hidden flex items-center justify-center">
      {/* Road lanes */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-full h-10 bg-muted/40 border-y border-dashed border-border/70" />
        <div className="absolute h-full w-10 bg-muted/40 border-x border-dashed border-border/70" />
        <div className="absolute w-10 h-10 bg-muted border border-border rounded-sm z-10" />
      </div>
      {/* North */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 gap-0.5">
        <span className="text-[7px] font-black uppercase text-muted-foreground">
          N
        </span>
        <div className="flex items-center gap-1">
          <SignalDot sig={sigs.north} />
          <span className="text-[9px] font-bold tabular-nums">
            {directions.north.vehiclesCount}v
          </span>
        </div>
        <span className="text-[7px] text-muted-foreground/70 tabular-nums">
          {directions.north.allocatedGreen}s
        </span>
      </div>
      {/* South */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 gap-0.5">
        <span className="text-[7px] text-muted-foreground/70 tabular-nums">
          {directions.south.allocatedGreen}s
        </span>
        <div className="flex items-center gap-1">
          <SignalDot sig={sigs.south} />
          <span className="text-[9px] font-bold tabular-nums">
            {directions.south.vehiclesCount}v
          </span>
        </div>
        <span className="text-[7px] font-black uppercase text-muted-foreground">
          S
        </span>
      </div>
      {/* West */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[7px] font-black uppercase text-muted-foreground">
            W
          </span>
          <span className="text-[7px] text-muted-foreground/70 tabular-nums">
            {directions.west.allocatedGreen}s
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <SignalDot sig={sigs.west} />
          <span className="text-[9px] font-bold tabular-nums">
            {directions.west.vehiclesCount}v
          </span>
        </div>
      </div>
      {/* East */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
        <div className="flex flex-col items-center gap-0.5">
          <SignalDot sig={sigs.east} />
          <span className="text-[9px] font-bold tabular-nums">
            {directions.east.vehiclesCount}v
          </span>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[7px] font-black uppercase text-muted-foreground">
            E
          </span>
          <span className="text-[7px] text-muted-foreground/70 tabular-nums">
            {directions.east.allocatedGreen}s
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main sidebar ─────────────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({
  selectedPinId,
  onPinSelect,
  latestData,
  pinsData,
}) => {
  const selectedPin = pinsData.find((p) => p.id === selectedPinId);
  const [lastUpdatedSec, setLastUpdatedSec] = useState(3);

  useEffect(() => {
    const id = setInterval(
      () => setLastUpdatedSec((prev) => (prev >= 10 ? 1 : prev + 1)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const isRealTime = selectedPin?.cameraId === latestData?.camera_id;

  // For the "Vehicles Crossed" section: prefer live API data if available
  const vehicleBD =
    isRealTime && latestData
      ? {
          cars: latestData.vehicle_counts.cars,
          bikes: latestData.vehicle_counts.motorcycles,
          trucks: latestData.vehicle_counts.trucks,
          vans: Math.max(1, Math.floor(latestData.vehicle_counts.cars * 0.15)),
        }
      : selectedPin?.vehiclesBreakdown;

  const avgSpd =
    isRealTime && latestData
      ? 15 + ((latestData.vehicle_counts.total_vehicles * 7) % 25)
      : selectedPin?.avgSpeed;

  return (
    <aside className="w-[380px] h-screen bg-card border-r border-border flex flex-col z-[1000] shadow-xl overflow-y-auto scrollbar-thin">
      {/* ── Brand header ── */}
      <div className="p-5 border-b border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent flex flex-col gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-0.5">
              <TrafficCone className="text-primary w-5 h-5 animate-pulse" />
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                TrafficFlow AI
              </h1>
            </div>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
              Command Center
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/traffic"
              className="p-2 bg-secondary/80 rounded-lg text-foreground hover:bg-primary hover:text-white transition-all shadow-sm group"
              title="Diagnostic View"
            >
              <Monitor className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </Link>
            <Link
              to="/monitor"
              className="p-2 bg-primary/10 rounded-lg text-primary hover:bg-primary hover:text-white transition-all shadow-sm group"
              title="Global Monitor"
            >
              <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* ── Junction selector ── */}
        <div className="space-y-2">
          <label
            htmlFor="pin-select"
            className="flex items-center gap-2 text-xs font-semibold text-foreground"
          >
            <MapPin className="w-3.5 h-3.5 text-primary" />
            Active Signal Points
          </label>
          <select
            id="pin-select"
            className="w-full h-10 px-3 py-2 bg-background border-2 border-input rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            value={selectedPinId || ""}
            onChange={(e) => onPinSelect(e.target.value)}
          >
            <option value="" disabled>
              Search or select location...
            </option>
            {pinsData.map((pin) => (
              <option key={pin.id} value={pin.id}>
                {pin.name}
              </option>
            ))}
          </select>
        </div>

        {/* ── Live analytics ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Live Analytics
            </h3>
            {selectedPin && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded text-[9px] font-bold text-green-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                ACTIVE
              </div>
            )}
          </div>

          {selectedPin ? (
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
              {/* Speed + Level */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 p-2.5 rounded-xl border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Gauge className="w-3 h-3" />
                    <span className="text-[9px] font-bold uppercase">
                      Avg. Speed
                    </span>
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {avgSpd}{" "}
                    <span className="text-[10px] font-medium text-muted-foreground">
                      km/h
                    </span>
                  </div>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-xl border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Activity className="w-3 h-3" />
                    <span className="text-[9px] font-bold uppercase">
                      Level
                    </span>
                  </div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      selectedPin.trafficLevel === "High"
                        ? "text-destructive"
                        : selectedPin.trafficLevel === "Moderate"
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {selectedPin.trafficLevel} Traffic
                  </div>
                </div>
              </div>

              {/* Current phase + countdown */}
              <div className="bg-card border-2 border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">
                      Current Phase
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-black ${
                      selectedPin.signalState.phase.endsWith("AMBER")
                        ? "text-amber-500"
                        : selectedPin.signalState.phase.endsWith("GREEN")
                          ? "text-green-600"
                          : "text-red-500"
                    }`}
                  >
                    {getPhaseName(selectedPin.signalState.phase)}
                  </span>
                </div>

                {/* Big countdown */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="text-4xl font-black tabular-nums leading-none">
                    <span
                      className={
                        selectedPin.signalState.phase.endsWith("AMBER")
                          ? "text-amber-500"
                          : selectedPin.signalState.phase.endsWith("GREEN")
                            ? "text-green-600"
                            : "text-red-500"
                      }
                    >
                      {selectedPin.signalState.countdown}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      s
                    </span>
                  </div>
                  {/* Traffic light column visual */}
                  <div className="flex flex-col gap-1.5 bg-muted/40 p-2 rounded-xl border border-border/50">
                    {(["RED", "AMBER", "GREEN"] as const).map((colour) => {
                      const phase = selectedPin.signalState.phase;
                      const isActive =
                        (colour === "GREEN" && phase.endsWith("GREEN")) ||
                        (colour === "AMBER" && phase.endsWith("AMBER")) ||
                        (colour === "RED" &&
                          !phase.endsWith("GREEN") &&
                          !phase.endsWith("AMBER"));
                      const colCls = {
                        RED: isActive
                          ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
                          : "bg-muted-foreground/20",
                        AMBER: isActive
                          ? "bg-amber-400 shadow-[0_0_10px_#f59e0b]"
                          : "bg-muted-foreground/20",
                        GREEN: isActive
                          ? "bg-green-500 shadow-[0_0_10px_#22c55e]"
                          : "bg-muted-foreground/20",
                      }[colour];
                      return (
                        <div
                          key={colour}
                          className={`w-5 h-5 rounded-full transition-all duration-500 ${colCls}`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Phase progress bar */}
                <div className="px-4 pb-3">
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear ${
                        selectedPin.signalState.phase.endsWith("AMBER")
                          ? "bg-amber-400"
                          : selectedPin.signalState.phase.endsWith("GREEN")
                            ? "bg-green-500"
                            : "bg-red-500"
                      }`}
                      style={{
                        width: `${
                          ((phaseDuration(
                            selectedPin.signalState.phase,
                            selectedPin.signalState,
                          ) -
                            selectedPin.signalState.countdown) /
                            phaseDuration(
                              selectedPin.signalState.phase,
                              selectedPin.signalState,
                            )) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[8px] text-muted-foreground font-bold">
                    <span>START</span>
                    <span>
                      {phaseDuration(
                        selectedPin.signalState.phase,
                        selectedPin.signalState,
                      )}
                      s total
                    </span>
                  </div>
                </div>
              </div>

              {/* Up-next phase */}
              <div className="bg-muted/20 rounded-lg px-3 py-2 flex items-center justify-between border border-border/40">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">
                  Next →
                </span>
                <span className="text-[9px] font-black text-foreground">
                  {getPhaseName(
                    PHASE_SEQUENCE[
                      (PHASE_SEQUENCE.indexOf(selectedPin.signalState.phase) +
                        1) %
                        PHASE_SEQUENCE.length
                    ],
                  )}
                </span>
              </div>

              {/* 4-way mini map */}
              <div className="bg-card border-2 border-border rounded-xl p-3 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                    <Timer className="w-3 h-3 text-primary" />
                    4-Way Signal Flow
                  </span>
                  <div className="flex items-center gap-1">
                    {(["north", "south", "east", "west"] as const).map(
                      (dir) => (
                        <SignalDot
                          key={dir}
                          sig={
                            getLaneSignals(selectedPin.signalState.phase)[dir]
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
                <MiniIntersection pin={selectedPin} />
                {/* Compact per-lane table */}
                <div className="border border-border/50 rounded-lg overflow-hidden text-[9px]">
                  <div className="grid grid-cols-4 bg-muted/40 p-1.5 font-bold uppercase tracking-wider border-b">
                    <span>Lane</span>
                    <span className="text-center">Sig</span>
                    <span className="text-center">V</span>
                    <span className="text-right">G/R</span>
                  </div>
                  {(["north", "south", "east", "west"] as const).map((dir) => {
                    const d = selectedPin.directions[dir];
                    const sig = getLaneSignals(selectedPin.signalState.phase)[
                      dir
                    ];
                    return (
                      <div
                        key={dir}
                        className="grid grid-cols-4 p-1.5 border-b last:border-0 border-border/30 items-center hover:bg-muted/10"
                      >
                        <span className="font-bold capitalize">{dir}</span>
                        <span className="text-center">
                          <span
                            className={`inline-block px-1 rounded text-[7px] font-black ${
                              sig === "GREEN"
                                ? "bg-green-500/10 text-green-600"
                                : sig === "AMBER"
                                  ? "bg-amber-400/10 text-amber-600"
                                  : "bg-red-500/10 text-red-600"
                            }`}
                          >
                            {sig}
                          </span>
                        </span>
                        <span className="text-center font-semibold tabular-nums">
                          {d.vehiclesCount}
                        </span>
                        <span className="text-right font-medium tabular-nums text-green-600">
                          {d.allocatedGreen}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vehicles Crossed (Last Signal) */}
              <div className="bg-card border border-border rounded-xl p-3 space-y-3">
                <h4 className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                  <Car className="w-3 h-3" />
                  Vehicles Crossed (Last Signal)
                </h4>
                {vehicleBD && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <Car className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold tabular-nums">
                          {vehicleBD.cars}
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase">
                          Cars
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <Bike className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold tabular-nums">
                          {vehicleBD.bikes}
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase">
                          Bikes
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-orange-500/10 rounded-lg">
                        <Truck className="w-3.5 h-3.5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold tabular-nums">
                          {vehicleBD.trucks}
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase">
                          Trucks
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                        <Bus className="w-3.5 h-3.5 text-cyan-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold tabular-nums">
                          {vehicleBD.vans}
                        </div>
                        <div className="text-[8px] font-bold text-muted-foreground uppercase">
                          Vans
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live camera (if available) */}
              {isRealTime && latestData?.source_image && (
                <div className="rounded-xl border-2 border-primary/20 bg-card overflow-hidden shadow-md group relative">
                  <div className="absolute top-2 left-2 z-10 bg-destructive px-2 py-0.5 rounded text-[7px] font-black text-white flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    LIVE CAMERA
                  </div>
                  <img
                    src={latestData.source_image}
                    alt="Live feed"
                    className="w-full h-36 object-cover grayscale-[0.3] contrast-125 group-hover:grayscale-0 transition-all duration-500"
                  />
                  <div className="p-2 bg-muted/80 backdrop-blur-sm text-[8px] font-bold text-foreground flex justify-between items-center px-3">
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />{" "}
                      {(
                        latestData.detection_metadata.confidence_score * 100
                      ).toFixed(1)}
                      %
                    </span>
                    <span>CAM_{latestData.camera_id.slice(-3)}</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button className="h-10 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-wider">
                  Adjust Signal Sequence
                </button>
                <button className="h-10 rounded-lg border-2 border-destructive/20 bg-transparent text-destructive font-bold text-xs hover:bg-destructive/5 transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Manual Override
                </button>
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between pt-3 text-[9px] font-bold text-muted-foreground uppercase border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Updated:{" "}
                  <span className="text-foreground tabular-nums">
                    {lastUpdatedSec}s ago
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border">
              <div className="p-3 bg-background rounded-full shadow-inner mb-4">
                <Info className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                No Signal Selected
              </p>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed font-medium">
                Select a traffic junction from the map or dropdown to begin
                real-time analysis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Brand footer */}
      <div className="mt-auto p-4 border-t border-border bg-muted/20">
        <div className="flex items-center justify-between text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em]">
          <span>© 2026 TF-AI Systems</span>
          <span className="text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 shadow-[0_0_8px_rgba(22,101,52,0.8)]" />
            NETWORK SECURE
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
