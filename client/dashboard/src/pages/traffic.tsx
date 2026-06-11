import {
  AlertCircle,
  ArrowLeft,
  Car,
  Cpu,
  History,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LatestDetectionResponse } from "../types/api";

type SignalState = "RED" | "ORANGE" | "GREEN";
const API_URL = "http://localhost:8001/api/latest";

const Traffic: React.FC = () => {
  const [latestData, setLatestData] = useState<LatestDetectionResponse | null>(
    null,
  );
  const [trafficState, setTrafficState] = useState<{
    signal: SignalState;
    timer: number;
  }>({ signal: "RED", timer: 45 });
  const { signal, timer } = trafficState;
  const [processedFrames, setProcessedFrames] = useState(1240);

  const latestDataRef = useRef(latestData);
  useEffect(() => {
    latestDataRef.current = latestData;
  }, [latestData]);

  // Poll the API for latest detection data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_URL);
        if (response.ok) {
          const data: LatestDetectionResponse = await response.json();
          setLatestData(data);
          setProcessedFrames((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Failed to fetch traffic data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Combined Signal Logic and State Machine countdown
  useEffect(() => {
    const countdown = setInterval(() => {
      setTrafficState((prev) => {
        if (prev.timer <= 1) {
          const currentLatestData = latestDataRef.current;
          const greenDuration =
            currentLatestData?.traffic_light_timing.green_light_sec || 30;
          const redDuration =
            currentLatestData?.traffic_light_timing.red_light_sec || 45;

          if (prev.signal === "RED") {
            return { signal: "ORANGE", timer: 5 };
          } else if (prev.signal === "ORANGE") {
            return { signal: "GREEN", timer: greenDuration };
          } else {
            return { signal: "RED", timer: redDuration };
          }
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Header */}
      <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center justify-between px-10 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className="h-10 w-[1px] bg-slate-200" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-slate-900">
              Diagnostic Analysis
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
              System ID: {latestData?.camera_id || "KOL_SEC5_Node_4"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-primary uppercase">
              Engine Status
            </span>
            <span className="text-xs font-bold flex items-center gap-2 text-slate-700">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              LIVE FEED ACTIVE
            </span>
          </div>
        </div>
      </header>

      {/* Content Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 gap-6">
        {/* Left: HD Camera View */}
        <div className="flex-[1.4] relative rounded-[2.5rem] overflow-hidden border border-slate-200 bg-white shadow-xl group min-h-[400px]">
          <div className="absolute top-8 left-8 z-10 flex flex-col gap-3">
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                LIVE FEED //{" "}
                {latestData?.camera_id.split("-").pop()?.toUpperCase() ||
                  "CAM_04"}
              </span>
            </div>
            <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-100 text-[10px] font-bold tabular-nums text-slate-600 shadow-sm">
              {latestData?.timestamp
                ? new Date(latestData.timestamp).toLocaleTimeString()
                : new Date().toLocaleTimeString()}
            </div>
          </div>

          {latestData?.source_image ? (
            <img
              src={latestData.source_image}
              alt="Traffic Camera"
              className="w-full h-full object-cover transition-all duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-bold">
              WAITING FOR STREAM...
            </div>
          )}

          {/* AI Bounding Box Overlays (Simulated but linked to active status) */}
          {latestData && (
            <div className="absolute inset-0 pointer-events-none border-[12px] border-white/10">
              <div className="absolute top-1/3 left-1/4 w-32 h-20 border-2 border-primary bg-primary/10 flex flex-col p-1 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                <span className="text-[8px] font-black bg-primary text-white w-fit px-1">
                  CAR [
                  {(
                    latestData.detection_metadata.confidence_score * 100
                  ).toFixed(0)}
                  %]
                </span>
              </div>
              {latestData.vehicle_counts.buses > 0 && (
                <div className="absolute top-1/2 left-1/2 w-40 h-24 border-2 border-amber-500 bg-amber-500/10 flex flex-col p-1 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <span className="text-[8px] font-black bg-amber-500 text-white w-fit px-1">
                    BUS [94%]
                  </span>
                </div>
              )}
              {latestData.vehicle_counts.motorcycles > 0 && (
                <div className="absolute bottom-1/4 right-1/3 w-20 h-16 border-2 border-violet-500 bg-violet-500/10 flex flex-col p-1 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                  <span className="text-[8px] font-black bg-violet-500 text-white w-fit px-1">
                    BIKE [89%]
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200 shadow-lg max-w-xs">
              <h4 className="text-[10px] font-black uppercase text-primary mb-2 tracking-widest">
                Inference Details
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {latestData
                  ? `Model ${latestData.detection_metadata.model_version} processing with ${latestData.detection_metadata.processing_time_ms}ms latency. Object detection verified with ${(latestData.detection_metadata.confidence_score * 100).toFixed(1)}% confidence.`
                  : "Initialising YOLOv8 engine for real-time spatial analysis..."}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center bg-white/90 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <Cpu className="w-5 h-5 text-slate-600" />
              </div>
              <div className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center bg-white/90 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
                <ShieldCheck className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Analytics & Signal */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
          {/* Signal Control Card */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 flex flex-col gap-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                Signal status
              </h2>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-[8px] font-black text-green-600 uppercase">
                    Green Calc
                  </div>
                  <div className="text-xs font-bold">
                    {latestData?.traffic_light_timing.green_light_sec || "--"}s
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] font-black text-red-600 uppercase">
                    Red Calc
                  </div>
                  <div className="text-xs font-bold">
                    {latestData?.traffic_light_timing.red_light_sec || "--"}s
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-10 rounded-[2rem] border border-slate-100 relative shadow-inner">
              {/* Traffic Light UI */}
              <div className="flex flex-col gap-6 bg-slate-200/50 p-4 rounded-3xl border border-slate-200">
                <div
                  className={`w-14 h-14 rounded-full border-4 shadow-xl transition-all duration-500 ${signal === "RED" ? "bg-red-500 border-red-200 shadow-red-500/20 scale-110" : "bg-slate-300 border-slate-400/20"}`}
                />
                <div
                  className={`w-14 h-14 rounded-full border-4 shadow-xl transition-all duration-500 ${signal === "ORANGE" ? "bg-amber-400 border-amber-100 shadow-amber-400/20 scale-110" : "bg-slate-300 border-slate-400/20"}`}
                />
                <div
                  className={`w-14 h-14 rounded-full border-4 shadow-xl transition-all duration-500 ${signal === "GREEN" ? "bg-green-500 border-green-200 shadow-green-500/20 scale-110" : "bg-slate-300 border-slate-400/20"}`}
                />
              </div>

              <div className="text-center flex flex-col items-center flex-1 ml-4">
                <span className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">
                  Next Phase In
                </span>
                <div className="text-8xl font-black tabular-nums tracking-tighter text-slate-900 drop-shadow-sm">
                  {timer}
                </div>
                <span className="text-lg font-bold text-slate-400 mt-2">
                  SECONDS
                </span>
              </div>

              <div className="absolute top-4 right-4">
                <AlertCircle className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          </div>

          {/* Detail Analytics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                <Car className="w-3.5 h-3.5" />
                Vehicle Count
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {latestData?.vehicle_counts.total_vehicles || 0}
                </span>
                <span className="text-[10px] font-bold text-green-600">
                  LIVE
                </span>
              </div>
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                  <span>Cars</span>
                  <span>{latestData?.vehicle_counts.cars || 0}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((latestData?.vehicle_counts.cars || 0) / (latestData?.vehicle_counts.total_vehicles || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                <History className="w-3.5 h-3.5" />
                Total Processed
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums text-slate-900">
                  {processedFrames.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Frames
                </span>
              </div>
              <div className="text-[9px] font-bold text-primary mt-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                PROCESSING AT{" "}
                {latestData
                  ? Math.round(
                      1000 / latestData.detection_metadata.processing_time_ms,
                    )
                  : 30}{" "}
                FPS
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-auto flex gap-4 pt-4">
            <button className="flex-1 h-14 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-200">
              Download Log
            </button>
            <button className="flex-1 h-14 border border-slate-200 bg-white text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98]">
              Sync Config
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Traffic;
