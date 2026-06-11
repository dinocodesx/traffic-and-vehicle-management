import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  Bus,
  Calendar,
  Car,
  ChevronRight,
  Clock,
  Gauge,
  LayoutDashboard,
  Timer,
  TrafficCone,
  Truck,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { TrafficPin } from "../data/pins";
import {
  getLaneSignals,
  getPhaseName,
  PHASE_SEQUENCE,
  phaseDuration,
} from "../data/pins";
import { useTrafficSignalEngine } from "../hooks/useTrafficSignalEngine";

// ─── Static historical data (once per page load) ─────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATIC_HISTORICAL_DATA = DAYS.map((day) => ({
  day,
  total: 800 + Math.floor(Math.random() * 1200),
  avgSpeed: 20 + Math.floor(Math.random() * 30),
  peakHour: `${16 + Math.floor(Math.random() * 4)}:00`,
  trend: Math.random() > 0.5 ? "up" : "down",
}));

// ─── Helper: signal dot ───────────────────────────────────────────────────────
function SignalDot({
  sig,
  size = "md",
}: {
  sig: "GREEN" | "AMBER" | "RED";
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = { sm: "w-2 h-2", md: "w-3.5 h-3.5", lg: "w-5 h-5" };
  const colMap = {
    GREEN: "bg-green-500 shadow-[0_0_12px_#22c55e]",
    AMBER: "bg-amber-400 shadow-[0_0_12px_#f59e0b]",
    RED: "bg-red-500   shadow-[0_0_12px_#ef4444]",
  };
  return (
    <span
      className={`rounded-full inline-block ${sizeMap[size]} ${colMap[sig]}`}
    />
  );
}

// ─── Helper: phase progress bar ───────────────────────────────────────────────
function PhaseProgressBar({ pin }: { pin: TrafficPin }) {
  const { signalState } = pin;
  const total = phaseDuration(signalState.phase, signalState);
  const pct = total > 0 ? ((total - signalState.countdown) / total) * 100 : 0;
  const isAmber = signalState.phase.endsWith("AMBER");
  const isGreen = signalState.phase.endsWith("GREEN");
  const barColor = isAmber
    ? "bg-amber-400"
    : isGreen
      ? "bg-green-500"
      : "bg-red-500";

  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-1000 ease-linear ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Helper: mini intersection visualiser (used in cards + drawer) ────────────
function IntersectionDiagram({
  pin,
  large = false,
}: {
  pin: TrafficPin;
  large?: boolean;
}) {
  const { signalState } = pin;
  const sigs = getLaneSignals(signalState.phase);
  const boxSz = large ? "w-[280px] h-[280px]" : "w-full aspect-square";
  const roadW = large ? "h-16 border-y" : "h-10 border-y";
  const roadH = large ? "w-16 border-x" : "w-10 border-x";
  const junc = large ? "w-16 h-16" : "w-10 h-10";
  const dotSz = large ? "md" : "sm";
  const textSz = large ? "text-[10px]" : "text-[8px]";
  const vSz = large ? "text-sm" : "text-[9px]";

  const { directions } = pin;

  return (
    <div
      className={`relative ${boxSz} max-w-[280px] mx-auto bg-card rounded-2xl border border-border shadow-inner overflow-hidden flex items-center justify-center`}
    >
      {/* Road lanes */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`absolute w-full ${roadW} bg-muted/30 border-dashed border-border/70`}
        />
        <div
          className={`absolute h-full ${roadH} bg-muted/30 border-dashed border-border/70`}
        />
        <div
          className={`absolute ${junc} bg-muted border-2 border-border rounded-sm z-10`}
        />
      </div>

      {/* North */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 gap-0.5">
        <span
          className={`${textSz} font-black uppercase text-muted-foreground`}
        >
          N
        </span>
        <div className="flex items-center gap-1">
          <SignalDot sig={sigs.north} size={dotSz} />
          <span className={`${vSz} font-bold tabular-nums`}>
            {directions.north.vehiclesCount}v
          </span>
        </div>
        <span className={`${textSz} text-muted-foreground/70 tabular-nums`}>
          {directions.north.allocatedGreen}s G
        </span>
      </div>

      {/* South */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 gap-0.5">
        <span className={`${textSz} text-muted-foreground/70 tabular-nums`}>
          {directions.south.allocatedGreen}s G
        </span>
        <div className="flex items-center gap-1">
          <SignalDot sig={sigs.south} size={dotSz} />
          <span className={`${vSz} font-bold tabular-nums`}>
            {directions.south.vehiclesCount}v
          </span>
        </div>
        <span
          className={`${textSz} font-black uppercase text-muted-foreground`}
        >
          S
        </span>
      </div>

      {/* West */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20">
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={`${textSz} font-black uppercase text-muted-foreground`}
          >
            W
          </span>
          <span className={`${textSz} text-muted-foreground/70 tabular-nums`}>
            {directions.west.allocatedGreen}s
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <SignalDot sig={sigs.west} size={dotSz} />
          <span className={`${vSz} font-bold tabular-nums`}>
            {directions.west.vehiclesCount}v
          </span>
        </div>
      </div>

      {/* East */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-20">
        <div className="flex flex-col items-center gap-0.5">
          <SignalDot sig={sigs.east} size={dotSz} />
          <span className={`${vSz} font-bold tabular-nums`}>
            {directions.east.vehiclesCount}v
          </span>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <span
            className={`${textSz} font-black uppercase text-muted-foreground`}
          >
            E
          </span>
          <span className={`${textSz} text-muted-foreground/70 tabular-nums`}>
            {directions.east.allocatedGreen}s
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Monitor page ─────────────────────────────────────────────────────────────
const Monitor: React.FC = () => {
  const pinsData = useTrafficSignalEngine();
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const selectedPin = pinsData.find((p) => p.id === selectedPinId) || null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* ── Header ── */}
      <header className="border-b bg-card px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <TrafficCone className="text-primary w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">
              Global Traffic Monitor
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Kolkata Metro Surveillance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider">
              Live Signal Engine
            </span>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold hover:text-primary transition-colors bg-secondary px-4 py-2 rounded-md"
          >
            <LayoutDashboard className="w-4 h-4" />
            Home View
          </Link>
        </div>
      </header>

      {/* ── Cards Grid ── */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1800px] mx-auto">
          {pinsData.map((pin) => {
            const sigs = getLaneSignals(pin.signalState.phase);
            const isAmber = pin.signalState.phase.endsWith("AMBER");

            return (
              <div
                key={pin.id}
                onClick={() => setSelectedPinId(pin.id)}
                className="group bg-card border-2 border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col cursor-pointer active:scale-[0.98]"
              >
                {/* Card header */}
                <div className="p-4 border-b bg-muted/10">
                  <div className="flex justify-between items-start mb-2">
                    <div
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm ${
                        pin.trafficLevel === "High"
                          ? "bg-destructive text-destructive-foreground"
                          : pin.trafficLevel === "Moderate"
                            ? "bg-yellow-500 text-yellow-950"
                            : "bg-green-600 text-white"
                      }`}
                    >
                      {pin.trafficLevel}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Gauge className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold tabular-nums">
                        {pin.avgSpeed} km/h
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                    {pin.name}
                  </h3>
                </div>

                {/* Phase + countdown */}
                <div
                  className={`px-4 py-2.5 flex items-center justify-between border-b ${
                    isAmber
                      ? "bg-amber-500/5"
                      : pin.signalState.phase.endsWith("GREEN")
                        ? "bg-green-500/5"
                        : "bg-muted/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Timer className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] font-black uppercase text-muted-foreground">
                      {getPhaseName(pin.signalState.phase)}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-black tabular-nums ${
                      isAmber
                        ? "text-amber-500"
                        : pin.signalState.phase.endsWith("GREEN")
                          ? "text-green-600"
                          : "text-red-500"
                    }`}
                  >
                    {pin.signalState.countdown}s
                  </span>
                </div>

                {/* Progress bar */}
                <div className="px-4 pt-2">
                  <PhaseProgressBar pin={pin} />
                </div>

                {/* Mini intersection diagram */}
                <div className="p-3 flex-1">
                  <IntersectionDiagram pin={pin} />
                </div>

                {/* N/S/E/W signal states */}
                <div className="px-4 pb-3 grid grid-cols-4 gap-1">
                  {(["north", "south", "east", "west"] as const).map((dir) => (
                    <div key={dir} className="flex flex-col items-center gap-1">
                      <SignalDot sig={sigs[dir]} size="sm" />
                      <span className="text-[8px] font-black uppercase text-muted-foreground">
                        {dir[0]}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Stats footer */}
                <div className="px-4 py-2 border-t bg-muted/10 grid grid-cols-4 gap-1">
                  <div className="flex flex-col items-center">
                    <Car className="w-3 h-3 text-blue-500 mb-0.5" />
                    <span className="text-[9px] font-bold tabular-nums">
                      {pin.vehiclesBreakdown.cars}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Bike className="w-3 h-3 text-purple-500 mb-0.5" />
                    <span className="text-[9px] font-bold tabular-nums">
                      {pin.vehiclesBreakdown.bikes}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Truck className="w-3 h-3 text-orange-500 mb-0.5" />
                    <span className="text-[9px] font-bold tabular-nums">
                      {pin.vehiclesBreakdown.trucks}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Bus className="w-3 h-3 text-cyan-500 mb-0.5" />
                    <span className="text-[9px] font-bold tabular-nums">
                      {pin.vehiclesBreakdown.vans}
                    </span>
                  </div>
                </div>

                {/* Click hint */}
                <div className="px-4 py-2.5 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    DETAILS
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Detail Drawer ── */}
      {selectedPin && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedPinId(null)}
          />
          <div className="relative w-full max-w-2xl bg-card border-l h-full shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
            {/* Drawer header */}
            <div className="p-6 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <TrafficCone className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">
                    {selectedPin.name}
                  </h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Live Signal + 7-Day
                    Analytics
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPinId(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-secondary/50 p-4 rounded-2xl border border-border">
                  <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">
                    Total Vehicles
                  </div>
                  <div className="text-2xl font-black">
                    {selectedPin.vehiclesCount}
                  </div>
                  <div className="text-[9px] font-bold text-green-600 flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3" /> Junction total
                  </div>
                </div>
                <div className="bg-secondary/50 p-4 rounded-2xl border border-border">
                  <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">
                    Avg Speed
                  </div>
                  <div className="text-2xl font-black">
                    {selectedPin.avgSpeed} <span className="text-xs">km/h</span>
                  </div>
                  <div className="text-[9px] font-bold text-destructive flex items-center gap-1 mt-1">
                    <ArrowDownRight className="w-3 h-3" /> All directions
                  </div>
                </div>
                <div className="bg-secondary/50 p-4 rounded-2xl border border-border">
                  <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">
                    Phase Countdown
                  </div>
                  <div
                    className={`text-2xl font-black tabular-nums ${
                      selectedPin.signalState.phase.endsWith("AMBER")
                        ? "text-amber-500"
                        : selectedPin.signalState.phase.endsWith("GREEN")
                          ? "text-green-600"
                          : "text-red-500"
                    }`}
                  >
                    {selectedPin.signalState.countdown}s
                  </div>
                  <div className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">
                    {getPhaseName(selectedPin.signalState.phase)}
                  </div>
                </div>
              </div>

              {/* Full phase cycle timeline */}
              <div className="bg-muted/10 border-2 border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary" />
                  Signal Phase Cycle — Full Sequence
                </h3>
                <div className="space-y-1.5">
                  {PHASE_SEQUENCE.map((phase, i) => {
                    const isActive = phase === selectedPin.signalState.phase;
                    const dur = phaseDuration(phase, selectedPin.signalState);
                    const isAmber = phase.endsWith("AMBER");
                    const isGreen = phase.endsWith("GREEN");
                    return (
                      <div
                        key={phase}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                          isActive
                            ? "bg-primary/5 border border-primary/20"
                            : "border border-transparent"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-black w-4 tabular-nums ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {i + 1}
                        </span>
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            isAmber
                              ? "bg-amber-400"
                              : isGreen
                                ? "bg-green-500"
                                : "bg-red-500"
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold flex-1 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {getPhaseName(phase)}
                        </span>
                        {isActive ? (
                          <span className="text-[10px] font-black text-primary tabular-nums">
                            {selectedPin.signalState.countdown}s left
                          </span>
                        ) : (
                          <span className="text-[9px] text-muted-foreground tabular-nums">
                            {dur}s
                          </span>
                        )}
                        {isActive && (
                          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isAmber ? "bg-amber-400" : "bg-green-500"}`}
                              style={{
                                width: `${((dur - selectedPin.signalState.countdown) / dur) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4-way intersection diagram + table */}
              <div className="bg-muted/10 border-2 border-border rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <TrafficCone className="w-4 h-4 text-primary" />
                    4-Way Intersection (Real-Time)
                  </h3>
                  <span
                    className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${
                      selectedPin.signalState.phase.endsWith("AMBER")
                        ? "bg-amber-500/10 text-amber-600"
                        : selectedPin.signalState.phase.endsWith("GREEN")
                          ? "bg-green-500/10 text-green-600"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {getPhaseName(selectedPin.signalState.phase)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <IntersectionDiagram pin={selectedPin} large />

                  {/* Per-direction table */}
                  <div className="space-y-3">
                    <div className="border border-border/60 rounded-xl overflow-hidden text-xs">
                      <div className="grid grid-cols-5 bg-muted/50 p-2.5 font-black text-[9px] uppercase tracking-wider border-b border-border/60">
                        <span>Lane</span>
                        <span className="text-center">Signal</span>
                        <span className="text-center">Vehicles</span>
                        <span className="text-center">G Alloc</span>
                        <span className="text-right">Speed</span>
                      </div>
                      {(["north", "south", "east", "west"] as const).map(
                        (dir) => {
                          const d = selectedPin.directions[dir];
                          const sig = getLaneSignals(
                            selectedPin.signalState.phase,
                          )[dir];
                          return (
                            <div
                              key={dir}
                              className="grid grid-cols-5 p-2.5 items-center border-b last:border-0 border-border/40 hover:bg-muted/10"
                            >
                              <span className="font-extrabold capitalize">
                                {dir}
                              </span>
                              <span className="text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black ${
                                    sig === "GREEN"
                                      ? "bg-green-500/10 text-green-600"
                                      : sig === "AMBER"
                                        ? "bg-amber-400/10 text-amber-600"
                                        : "bg-red-500/10 text-red-600"
                                  }`}
                                >
                                  <SignalDot sig={sig} size="sm" /> {sig}
                                </span>
                              </span>
                              <span className="text-center font-bold tabular-nums">
                                {d.vehiclesCount}
                              </span>
                              <span className="text-center font-bold text-green-600 tabular-nums">
                                {d.allocatedGreen}s
                              </span>
                              <span className="text-right text-muted-foreground tabular-nums">
                                {d.avgSpeed}km/h
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>

                    {/* Vehicle breakdown per direction */}
                    <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
                      <h4 className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                        Vehicles Crossed — Last Signal
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {(["north", "south", "east", "west"] as const).map(
                          (dir) => {
                            const bd =
                              selectedPin.directions[dir].vehiclesBreakdown;
                            return (
                              <div
                                key={dir}
                                className="bg-muted/30 rounded-lg p-2.5 space-y-1.5"
                              >
                                <div className="text-[9px] font-black uppercase text-muted-foreground border-b border-border/40 pb-1">
                                  {dir}
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px]">
                                  <span className="text-blue-500 font-bold">
                                    Cars
                                  </span>{" "}
                                  <span className="tabular-nums font-bold">
                                    {bd.cars}
                                  </span>
                                  <span className="text-purple-500 font-bold">
                                    Bikes
                                  </span>{" "}
                                  <span className="tabular-nums font-bold">
                                    {bd.bikes}
                                  </span>
                                  <span className="text-orange-500 font-bold">
                                    Trucks
                                  </span>
                                  <span className="tabular-nums font-bold">
                                    {bd.trucks}
                                  </span>
                                  <span className="text-cyan-500 font-bold">
                                    Vans
                                  </span>{" "}
                                  <span className="tabular-nums font-bold">
                                    {bd.vans}
                                  </span>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7-day historical table */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                  <Activity className="w-4 h-4 text-primary" />
                  Daily Performance Breakdown
                </h3>
                <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left py-3 px-5 text-[9px] font-black uppercase tracking-tighter">
                          Day
                        </th>
                        <th className="text-center py-3 px-5 text-[9px] font-black uppercase tracking-tighter">
                          Total Flow
                        </th>
                        <th className="text-center py-3 px-5 text-[9px] font-black uppercase tracking-tighter">
                          Avg Speed
                        </th>
                        <th className="text-center py-3 px-5 text-[9px] font-black uppercase tracking-tighter">
                          Peak
                        </th>
                        <th className="text-right py-3 px-5 text-[9px] font-black uppercase tracking-tighter">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {STATIC_HISTORICAL_DATA.map((d) => (
                        <tr
                          key={d.day}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-3 px-5 font-bold text-sm">
                            {d.day}
                          </td>
                          <td className="py-3 px-5 text-center tabular-nums font-medium">
                            {d.total}
                          </td>
                          <td className="py-3 px-5 text-center tabular-nums text-muted-foreground">
                            {d.avgSpeed} km/h
                          </td>
                          <td className="py-3 px-5 text-center font-bold text-xs text-primary">
                            {d.peakHour}
                          </td>
                          <td className="py-3 px-5 text-right">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                d.trend === "up"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {d.trend === "up" ? "Clear" : "Heavy"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  * Signal timings are calculated using proportional
                  vehicle-count allocation. Green phases run {15}–{90} s. Amber
                  clearance is always 5 s. Left-turn phases run ≈40 % of
                  through-green duration.
                </p>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="p-6 border-t bg-muted/20 flex gap-4">
              <button className="flex-1 h-11 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20">
                Export PDF Report
              </button>
              <button className="h-11 px-5 border-2 border-border font-black text-xs uppercase tracking-widest rounded-xl hover:bg-secondary transition-all">
                Compare
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-5 border-t bg-muted/10 text-center">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
          TF-AI Global Monitor System • Status:{" "}
          <span className="text-green-600">Secure</span> • Node:
          Kolkata_Metro_01
        </p>
      </footer>
    </div>
  );
};

export default Monitor;
