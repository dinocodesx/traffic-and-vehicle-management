/**
 * /traffic — Highway Camera Feed  (design matches Home / Sidebar aesthetic)
 *
 * Signal timing logic:
 *   greenSecs = 15 + 75 × (frameVehicles / maxVehiclesInSet)   → more vehicles = more green
 *   redSecs   = inverse of green (fewer vehicles = longer red)
 *   amber     = always 5 s
 * Cycle: GREEN → AMBER → RED → advance frame → repeat endlessly
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  Layers,
  RotateCcw,
  ShieldCheck,
  Timer,
  TrafficCone,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BBox {
  x1: number; y1: number; x2: number; y2: number;
  width: number; height: number; center_x: number; center_y: number;
}
interface Detection {
  id: number; class_id: number;
  class_name: "car" | "motorcycle" | "bus" | "truck";
  confidence: number; bbox: BBox;
}
interface ImageAnnotation {
  file_name: string; annotated_path: string;
  image_width: number; image_height: number;
  total_vehicles: number;
  vehicle_counts: { car: number; motorcycle: number; bus: number; truck: number };
  detections: Detection[];
}
interface AnnotationsJson {
  metadata: {
    total_images: number; processed_at: string; model: string;
    confidence_threshold: number; grand_total_vehicles: number;
    grand_vehicle_counts: { car: number; motorcycle: number; bus: number; truck: number };
  };
  images: ImageAnnotation[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GREEN_MIN  = 15;
const GREEN_MAX  = 90;
const AMBER_SECS = 5;
type SignalState = "GREEN" | "AMBER" | "RED";

const CLASS_META = {
  car:        { color: "#22c55e", bg: "rgba(34,197,94,0.07)",  text: "text-green-600",  badge: "bg-green-500" },
  motorcycle: { color: "#f59e0b", bg: "rgba(245,158,11,0.07)", text: "text-amber-600",  badge: "bg-amber-400" },
  bus:        { color: "#3b82f6", bg: "rgba(59,130,246,0.07)", text: "text-blue-600",   badge: "bg-blue-500"  },
  truck:      { color: "#a855f7", bg: "rgba(168,85,247,0.07)", text: "text-purple-600", badge: "bg-purple-500" },
} as const;

function computeGreen(v: number, maxV: number) {
  if (maxV === 0) return GREEN_MIN;
  return Math.round(GREEN_MIN + (GREEN_MAX - GREEN_MIN) * Math.min(1, v / maxV));
}

// ─── SVG bbox overlay ─────────────────────────────────────────────────────────
function BBoxOverlay({ detections, imgW, imgH }: { detections: Detection[]; imgW: number; imgH: number }) {
  return (
    <svg
      viewBox={`0 0 ${imgW} ${imgH}`}
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {detections.map(det => {
        const c = CLASS_META[det.class_name];
        const { x1, y1, x2, y2, width, height } = det.bbox;
        const tick = Math.min(width, height) * 0.22;
        return (
          <g key={det.id} filter="url(#glow)">
            <rect x={x1} y={y1} width={width} height={height}
              fill={c.bg} stroke={c.color} strokeWidth="2.5" rx="2" />
            {/* Corner ticks */}
            {([[x1,y1,1,1],[x2,y1,-1,1],[x1,y2,1,-1],[x2,y2,-1,-1]] as [number,number,number,number][]).map(([cx,cy,dx,dy], i) => (
              <g key={i}>
                <line x1={cx} y1={cy} x2={cx+dx*tick} y2={cy} stroke={c.color} strokeWidth="4" strokeLinecap="round" />
                <line x1={cx} y1={cy} x2={cx} y2={cy+dy*tick} stroke={c.color} strokeWidth="4" strokeLinecap="round" />
              </g>
            ))}
            {/* Label */}
            <rect x={x1} y={Math.max(0, y1 - 26)} width={det.class_name.length * 7.5 + 52} height={22} fill={c.color} rx="3" />
            <text x={x1 + 5} y={Math.max(0, y1 - 26) + 15} fill="white" fontSize="12" fontWeight="800" fontFamily="monospace">
              {det.class_name.toUpperCase()}  {(det.confidence * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Sidebar panel ────────────────────────────────────────────────────────────
function SidebarPanel({
  annotations, frame, frameIdx, signal, countdown, greenSecs, redSecs, totalCycles, maxV,
  showOverlay, onToggleOverlay, onGoTo,
}: {
  annotations: AnnotationsJson; frame: ImageAnnotation; frameIdx: number;
  signal: SignalState; countdown: number; greenSecs: number; redSecs: number;
  totalCycles: number; maxV: number;
  showOverlay: boolean; onToggleOverlay: () => void;
  onGoTo: (i: number) => void;
}) {
  const phaseTotal = signal === "GREEN" ? greenSecs : signal === "AMBER" ? AMBER_SECS : redSecs;
  const phasePct   = Math.max(0, Math.min(100, ((phaseTotal - countdown) / phaseTotal) * 100));
  const density    = Math.round((frame.total_vehicles / maxV) * 100);

  return (
    <aside className="w-[380px] h-full bg-card border-r border-border flex flex-col overflow-y-auto shadow-xl scrollbar-thin z-10">

      {/* Brand */}
      <div className="p-5 border-b border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrafficCone className="text-primary w-5 h-5 animate-pulse" />
            <div>
              <h1 className="text-base font-bold tracking-tight">TrafficFlow AI</h1>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Highway Diagnostic Feed</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onToggleOverlay}
              className={`p-2 rounded-lg transition-all shadow-sm ${showOverlay ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-primary/10"}`}
              title="Toggle detection overlay"
            >
              {showOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <Link to="/" className="p-2 bg-secondary rounded-lg text-foreground hover:bg-primary hover:text-white transition-all shadow-sm" title="Home">
              <LayoutDashboard className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5 flex-1">

        {/* ── Signal Control ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Signal Control
            </h3>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded text-[9px] font-bold text-green-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              ACTIVE
            </div>
          </div>

          {/* Traffic light + countdown */}
          <div className="bg-card border-2 border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-6">
              {/* Light housing */}
              <div className="flex flex-col gap-2 bg-muted/40 p-3 rounded-xl border border-border">
                {(["RED","AMBER","GREEN"] as const).map(colour => {
                  const on = signal === colour;
                  const cls = {
                    RED:   on ? "bg-red-500 shadow-[0_0_20px_6px_rgba(239,68,68,0.45)]"   : "bg-muted-foreground/20",
                    AMBER: on ? "bg-amber-400 shadow-[0_0_20px_6px_rgba(251,191,36,0.45)]" : "bg-muted-foreground/20",
                    GREEN: on ? "bg-green-500 shadow-[0_0_20px_6px_rgba(34,197,94,0.45)]"  : "bg-muted-foreground/20",
                  }[colour];
                  return <div key={colour} className={`w-8 h-8 rounded-full transition-all duration-500 ${cls}`} />;
                })}
              </div>

              {/* Countdown */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Next Phase In</span>
                <div className={`text-5xl font-black tabular-nums leading-none ${
                  signal === "GREEN" ? "text-green-600" : signal === "AMBER" ? "text-amber-500" : "text-destructive"
                }`}>{countdown}</div>
                <span className="text-xs font-bold text-muted-foreground">SECONDS</span>
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
                  <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    signal === "GREEN" ? "bg-green-500" : signal === "AMBER" ? "bg-amber-400" : "bg-destructive"
                  }`} style={{ width: `${phasePct}%` }} />
                </div>
                <div className="flex justify-between w-full text-[8px] text-muted-foreground font-bold mt-0.5 px-0.5">
                  <span>0s</span><span>{phaseTotal}s total</span>
                </div>
              </div>
            </div>

            {/* Next phase label */}
            <div className="mt-3 flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5 border border-border/50">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Current</span>
              <span className={`text-[9px] font-black uppercase ${
                signal === "GREEN" ? "text-green-600" : signal === "AMBER" ? "text-amber-500" : "text-destructive"
              }`}>{signal} PHASE</span>
            </div>
          </div>

          {/* Timing cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
              <div className="text-[8px] font-black uppercase text-green-600/70 mb-1">Green Alloc.</div>
              <div className="text-2xl font-black text-green-600 tabular-nums">{greenSecs}s</div>
              <div className="text-[8px] text-muted-foreground font-bold mt-0.5">{frame.total_vehicles}v · {density}% load</div>
            </div>
            <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-3">
              <div className="text-[8px] font-black uppercase text-destructive/70 mb-1">Red Alloc.</div>
              <div className="text-2xl font-black text-destructive tabular-nums">{redSecs}s</div>
              <div className="text-[8px] text-muted-foreground font-bold mt-0.5">Amber = {AMBER_SECS}s fixed</div>
            </div>
          </div>
        </div>

        {/* ── Frame Info ── */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-primary" /> Frame Detections
            </h4>
            <span className="text-[8px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {frame.file_name}
            </span>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Total Vehicles</span>
            <span className="text-2xl font-black tabular-nums">{frame.total_vehicles}</span>
          </div>

          {/* Per-class bars */}
          {(["car", "truck", "bus", "motorcycle"] as const).map(cls => {
            const count = frame.vehicle_counts[cls];
            const pct   = frame.total_vehicles > 0 ? (count / frame.total_vehicles) * 100 : 0;
            const m     = CLASS_META[cls];
            return (
              <div key={cls} className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold uppercase">
                  <span className={m.text}>{cls}</span>
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: m.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Detections list ── */}
        {frame.detections.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-4 bg-muted/50 px-3 py-2 text-[8px] font-black uppercase text-muted-foreground tracking-wider border-b border-border">
              <span>#</span><span>Class</span><span className="text-center">Conf</span><span className="text-right">W×H px</span>
            </div>
            <div className="max-h-44 overflow-y-auto divide-y divide-border/40">
              {frame.detections.map((det, i) => {
                const m = CLASS_META[det.class_name];
                return (
                  <div key={det.id} className="grid grid-cols-4 px-3 py-2 text-[9px] items-center hover:bg-muted/20 transition-colors">
                    <span className="text-muted-foreground font-bold tabular-nums">{i + 1}</span>
                    <span className={`font-black capitalize ${m.text}`}>{det.class_name}</span>
                    <span className="text-center tabular-nums font-bold">{(det.confidence * 100).toFixed(0)}%</span>
                    <span className="text-right tabular-nums text-muted-foreground font-bold">
                      {Math.round(det.bbox.width)}×{Math.round(det.bbox.height)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Session stats ── */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Timer className="w-3 h-3 text-primary" /> Session Stats
          </h4>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              { label: "Frame",   val: `${frameIdx + 1} / ${annotations.metadata.total_images}` },
              { label: "Loops",   val: totalCycles },
              { label: "Total Detected", val: annotations.metadata.grand_total_vehicles },
              { label: "Conf Thr.", val: `${annotations.metadata.confidence_threshold * 100}%` },
            ].map(({ label, val }) => (
              <div key={label} className="bg-muted/30 rounded-xl p-2.5 border border-border/50">
                <div className="text-base font-black tabular-nums">{val}</div>
                <div className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Frame scrubber ── */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-primary" /> Frame Timeline
          </h4>
          <div className="flex flex-wrap gap-1">
            {annotations.images.map((img, i) => {
              const isActive = i === frameIdx;
              const r = img.total_vehicles / maxV;
              return (
                <button
                  key={i}
                  onClick={() => onGoTo(i)}
                  title={`${img.file_name} — ${img.total_vehicles} vehicles`}
                  className={`w-[18px] h-[18px] rounded-sm transition-all ${
                    isActive
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-card scale-125"
                      : "hover:scale-110 hover:ring-1 hover:ring-border"
                  }`}
                  style={{
                    backgroundColor: isActive
                      ? "hsl(221.2 83.2% 53.3%)"
                      : `hsl(${140 - r * 80} ${50 + r * 30}% ${40 + r * 20}% / ${0.4 + r * 0.5})`,
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground font-bold">
            <span>Low load</span><span>High load</span>
          </div>
        </div>

        {/* ── Model footer ── */}
        <div className="flex items-center gap-2 text-[8px] font-bold text-muted-foreground py-2">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {annotations.metadata.model} · Processed {annotations.metadata.processed_at.split("T")[0]}
        </div>
      </div>
    </aside>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const Traffic: React.FC = () => {
  const [annotations, setAnnotations] = useState<AnnotationsJson | null>(null);
  const [loading, setLoading]         = useState(true);
  const [frameIdx, setFrameIdx]       = useState(0);
  const [signal, setSignal]           = useState<SignalState>("GREEN");
  const [countdown, setCountdown]     = useState(GREEN_MIN);
  const [showOverlay, setShowOverlay] = useState(true);
  const [totalCycles, setTotalCycles] = useState(0);

  const signalRef    = useRef<SignalState>("GREEN");
  const countdownRef = useRef(GREEN_MIN);
  const frameIdxRef  = useRef(0);
  const annsRef      = useRef<AnnotationsJson | null>(null);

  useEffect(() => { signalRef.current    = signal;      }, [signal]);
  useEffect(() => { countdownRef.current = countdown;   }, [countdown]);
  useEffect(() => { frameIdxRef.current  = frameIdx;    }, [frameIdx]);
  useEffect(() => { annsRef.current      = annotations; }, [annotations]);

  // Load JSON
  useEffect(() => {
    fetch("/annotations.json")
      .then(r => r.json())
      .then((data: AnnotationsJson) => {
        setAnnotations(data);
        const maxV = Math.max(...data.images.map(i => i.total_vehicles));
        setCountdown(computeGreen(data.images[0].total_vehicles, maxV));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const advanceFrame = useCallback(() => {
    const data = annsRef.current;
    if (!data) return;
    const nextIdx = (frameIdxRef.current + 1) % data.images.length;
    const maxV    = Math.max(...data.images.map(i => i.total_vehicles));
    setFrameIdx(nextIdx);
    setSignal("GREEN");
    setCountdown(computeGreen(data.images[nextIdx].total_vehicles, maxV));
    if (nextIdx === 0) setTotalCycles(c => c + 1);
  }, []);

  const goToFrame = useCallback((idx: number) => {
    const data = annsRef.current;
    if (!data) return;
    const maxV = Math.max(...data.images.map(i => i.total_vehicles));
    setFrameIdx(idx);
    setSignal("GREEN");
    setCountdown(computeGreen(data.images[idx].total_vehicles, maxV));
  }, []);

  // Signal tick
  useEffect(() => {
    if (!annotations) return;
    const maxV = Math.max(...annotations.images.map(i => i.total_vehicles));

    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev > 1) return prev - 1;

        const cur = signalRef.current;
        if (cur === "GREEN") { setSignal("AMBER"); return AMBER_SECS; }
        if (cur === "AMBER") {
          const frame   = annsRef.current!.images[frameIdxRef.current];
          const redSecs = Math.max(GREEN_MIN, computeGreen(maxV - frame.total_vehicles, maxV));
          setSignal("RED");
          return redSecs;
        }
        advanceFrame();
        return 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [annotations, advanceFrame]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen bg-background items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <TrafficCone className="w-10 h-10 text-primary animate-pulse" />
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Loading YOLO Annotations…
          </p>
        </div>
      </div>
    );
  }

  if (!annotations) {
    return (
      <div className="flex h-screen w-screen bg-background items-center justify-center text-destructive font-bold">
        Failed to load annotations.json
      </div>
    );
  }

  const frame     = annotations.images[frameIdx];
  const maxV      = Math.max(...annotations.images.map(i => i.total_vehicles));
  const greenSecs = computeGreen(frame.total_vehicles, maxV);
  const redSecs   = Math.max(GREEN_MIN, computeGreen(maxV - frame.total_vehicles, maxV));
  const imgSrc    = `/ip_camera_annotated/${frame.file_name}`;

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden">

      {/* ── Left: Sidebar panel ── */}
      <SidebarPanel
        annotations={annotations} frame={frame} frameIdx={frameIdx}
        signal={signal} countdown={countdown}
        greenSecs={greenSecs} redSecs={redSecs}
        totalCycles={totalCycles} maxV={maxV}
        showOverlay={showOverlay}
        onToggleOverlay={() => setShowOverlay(o => !o)}
        onGoTo={goToFrame}
      />

      {/* ── Right: Camera viewport (fills remaining space like the map) ── */}
      <main className="flex-1 relative overflow-hidden">

        {/* Annotated image */}
        <img
          key={imgSrc}
          src={imgSrc}
          alt={`Highway frame ${frameIdx}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        />

        {/* SVG detection overlay */}
        {showOverlay && frame.detections.length > 0 && (
          <div className="absolute inset-0">
            <BBoxOverlay detections={frame.detections} imgW={frame.image_width} imgH={frame.image_height} />
          </div>
        )}

        {/* Signal phase progress bar — bottom edge of viewport */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-background/40 backdrop-blur-sm z-10">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              signal === "GREEN" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" :
              signal === "AMBER" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" :
                                   "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            }`}
            style={{
              width: `${Math.max(0, Math.min(100,
                ((
                  (signal === "GREEN" ? greenSecs : signal === "AMBER" ? AMBER_SECS : redSecs)
                  - countdown
                ) / (signal === "GREEN" ? greenSecs : signal === "AMBER" ? AMBER_SECS : redSecs)) * 100
              ))}%`,
            }}
          />
        </div>

        {/* Top-left HUD  (matches the map popup card style) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="bg-card/90 backdrop-blur-md px-3 py-2 rounded-xl border border-border shadow-md flex items-center gap-2.5">
            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">
              LIVE · CAM_HWY_01
            </span>
          </div>
          <div className="bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-[9px] font-bold text-muted-foreground tabular-nums">
            {frame.image_width} × {frame.image_height} · {frame.file_name}
          </div>
          <div className="bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-green-600" />
            <span className="text-[9px] font-black text-green-600 uppercase">
              {frame.total_vehicles} vehicle{frame.total_vehicles !== 1 ? "s" : ""} detected
            </span>
          </div>
        </div>

        {/* Top-right: current signal badge (like the map zoom controls) */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          {/* Signal badge */}
          <div className={`bg-card/90 backdrop-blur-md px-4 py-2 rounded-xl border shadow-md flex items-center gap-3 ${
            signal === "GREEN" ? "border-green-500/30" :
            signal === "AMBER" ? "border-amber-400/30" : "border-destructive/30"
          }`}>
            <div className={`w-4 h-4 rounded-full ${
              signal === "GREEN" ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]" :
              signal === "AMBER" ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" :
                                   "bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.8)]"
            }`} />
            <div className="text-right">
              <div className={`text-xs font-black uppercase ${
                signal === "GREEN" ? "text-green-600" :
                signal === "AMBER" ? "text-amber-500" : "text-destructive"
              }`}>{signal}</div>
              <div className="text-[9px] font-bold text-muted-foreground tabular-nums">{countdown}s remaining</div>
            </div>
          </div>

          {/* Navigation controls (same card style as map zoom) */}
          <div className="bg-card border border-border rounded-xl shadow-md flex flex-col overflow-hidden">
            <button
              onClick={() => goToFrame((frameIdx - 1 + annotations.images.length) % annotations.images.length)}
              className="p-3 hover:bg-accent transition-colors border-b border-border flex items-center justify-center gap-1.5 group"
              title="Previous frame"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-[9px] font-black uppercase">Prev</span>
            </button>
            <button
              onClick={() => goToFrame((frameIdx + 1) % annotations.images.length)}
              className="p-3 hover:bg-accent transition-colors flex items-center justify-center gap-1.5 group"
              title="Next frame"
            >
              <span className="text-[9px] font-black uppercase">Next</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Back to home */}
          <Link
            to="/"
            className="bg-card border border-border rounded-xl shadow-md p-3 hover:bg-accent transition-colors flex items-center justify-center gap-2 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[9px] font-black uppercase">Home</span>
          </Link>

          {/* Restart cycle */}
          <button
            onClick={() => goToFrame(0)}
            className="bg-card border border-border rounded-xl shadow-md p-3 hover:bg-accent transition-colors flex items-center justify-center gap-2 group"
            title="Restart from frame 0"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-[9px] font-black uppercase">Reset</span>
          </button>
        </div>

        {/* Bottom-left: model info (like map attribution) */}
        <div className="absolute bottom-6 left-4 z-10">
          <div className="bg-card/90 backdrop-blur-md px-3 py-2 rounded-xl border border-border shadow-md max-w-xs">
            <h4 className="text-[9px] font-black uppercase text-primary mb-1 tracking-widest">
              YOLO Inference Details
            </h4>
            <p className="text-[9px] text-muted-foreground leading-relaxed font-medium">
              Model <span className="font-black text-foreground">{annotations.metadata.model}</span> · conf ≥ {annotations.metadata.confidence_threshold} ·{" "}
              frame {frameIdx + 1} of {annotations.metadata.total_images} ·{" "}
              <span className={
                signal === "GREEN" ? "text-green-600 font-black" :
                signal === "AMBER" ? "text-amber-500 font-black" : "text-destructive font-black"
              }>{signal} {countdown}s</span>
            </p>
          </div>
        </div>

        {/* Vehicle type legend (bottom-right) */}
        {showOverlay && (
          <div className="absolute bottom-6 right-4 z-10">
            <div className="bg-card/90 backdrop-blur-md px-3 py-2.5 rounded-xl border border-border shadow-md space-y-1.5">
              <div className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mb-2">Detection Classes</div>
              {(Object.entries(CLASS_META) as [string, typeof CLASS_META.car][]).map(([cls, m]) => (
                <div key={cls} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: m.color }} />
                  <span className={`text-[9px] font-bold capitalize ${m.text}`}>{cls}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Traffic;
