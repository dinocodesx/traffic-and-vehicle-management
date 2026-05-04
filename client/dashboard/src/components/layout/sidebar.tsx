import React, { useState, useEffect } from 'react';
import { TRAFFIC_PINS } from '../../data/pins';
import { 
  MapPin, 
  Info, 
  Clock, 
  Gauge, 
  Timer, 
  TrafficCone, 
  ShieldAlert, 
  Car, 
  Bike, 
  Truck, 
  Bus,
  Activity
} from 'lucide-react';
import type { LatestDetectionResponse } from '../../types/api';

interface SidebarProps {
  selectedPinId: string | null;
  onPinSelect: (id: string) => void;
  latestData: LatestDetectionResponse | null;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedPinId, onPinSelect, latestData }) => {
  const selectedPin = TRAFFIC_PINS.find(p => p.id === selectedPinId);
  const [lastUpdatedSec, setLastUpdatedSec] = useState(Math.floor(Math.random() * 9) + 1);

  // Simulate "Last Updated" between 1-10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdatedSec(prev => {
        if (prev >= 10) return 1;
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isRealTime = selectedPin?.cameraId === latestData?.camera_id;
  
  // Use latestData if available, otherwise fallback to mock data
  const stats = isRealTime && latestData ? {
    avgSpeed: 15 + Math.floor(Math.random() * 20), // Simulated speed for live
    greenTime: latestData.traffic_light_timing.green_light_sec,
    redTime: latestData.traffic_light_timing.red_light_sec,
    trafficLevel: latestData.vehicle_counts.total_vehicles > 100 ? 'High' : (latestData.vehicle_counts.total_vehicles > 50 ? 'Moderate' : 'Low'),
    vehicles: {
      cars: latestData.vehicle_counts.cars,
      bikes: latestData.vehicle_counts.motorcycles,
      trucks: latestData.vehicle_counts.trucks,
      vans: Math.floor(latestData.vehicle_counts.cars * 0.15) // Proxy for vans
    }
  } : selectedPin ? {
    avgSpeed: selectedPin.avgSpeed,
    greenTime: selectedPin.lastGreenTime,
    redTime: selectedPin.lastRedTime,
    trafficLevel: selectedPin.trafficLevel,
    vehicles: selectedPin.vehiclesBreakdown
  } : null;

  return (
    <aside className="w-[380px] h-screen bg-card border-r border-border flex flex-col z-[1000] shadow-xl overflow-y-auto scrollbar-thin">
      <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <TrafficCone className="text-primary w-6 h-6 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">TrafficFlow AI</h1>
        </div>
        <p className="text-sm text-muted-foreground font-medium">Kolkata Real-time Command Center</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Selector Section */}
        <div className="space-y-3">
          <label htmlFor="pin-select" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            Active Signal Points
          </label>
          <select
            id="pin-select"
            className="w-full h-11 px-3 py-2 bg-background border-2 border-input rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            value={selectedPinId || ''}
            onChange={(e) => onPinSelect(e.target.value)}
          >
            <option value="" disabled>Search or select location...</option>
            {TRAFFIC_PINS.map((pin) => (
              <option key={pin.id} value={pin.id}>{pin.name}</option>
            ))}
          </select>
        </div>

        {/* Live Analytics Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Activity className="w-4 h-4 text-primary" />
              Live Analytics
            </h3>
            {selectedPin && (
               <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded text-[10px] font-bold text-green-600">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>
                 ACTIVE
               </div>
            )}
          </div>
          
          {selectedPin && stats ? (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              {/* Main Metric Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Gauge className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Avg. Speed</span>
                  </div>
                  <div className="text-xl font-bold tabular-nums">{stats.avgSpeed} <span className="text-xs font-medium text-muted-foreground">km/h</span></div>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Level</span>
                  </div>
                  <div className={`text-sm font-bold mt-1 ${
                    stats.trafficLevel === 'High' ? 'text-destructive' :
                    stats.trafficLevel === 'Moderate' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {stats.trafficLevel} Traffic
                  </div>
                </div>
              </div>

              {/* Signal Timing Card */}
              <div className="bg-card border-2 border-border rounded-xl overflow-hidden shadow-sm">
                 <div className="px-4 py-2 border-b bg-muted/50 flex items-center gap-2">
                   <Timer className="w-3.5 h-3.5 text-primary" />
                   <span className="text-[10px] font-bold uppercase text-muted-foreground">Last Signal Timing</span>
                 </div>
                 <div className="p-4 flex divide-x divide-border">
                    <div className="flex-1 pr-4">
                      <div className="text-[10px] font-bold text-green-600 uppercase mb-1">Green Light</div>
                      <div className="text-2xl font-black tabular-nums">{stats.greenTime}<span className="text-sm font-normal text-muted-foreground ml-1">sec</span></div>
                    </div>
                    <div className="flex-1 pl-4">
                      <div className="text-[10px] font-bold text-destructive uppercase mb-1">Red Light</div>
                      <div className="text-2xl font-black tabular-nums">{stats.redTime}<span className="text-sm font-normal text-muted-foreground ml-1">sec</span></div>
                    </div>
                 </div>
              </div>

              {/* Vehicle Breakdown */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <Car className="w-3.5 h-3.5" />
                  Vehicles Crossed (Last Signal)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-500/10 rounded-lg"><Car className="w-4 h-4 text-blue-600" /></div>
                     <div>
                       <div className="text-xs font-bold">{stats.vehicles.cars}</div>
                       <div className="text-[9px] text-muted-foreground font-medium uppercase">Cars</div>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-purple-500/10 rounded-lg"><Bike className="w-4 h-4 text-purple-600" /></div>
                     <div>
                       <div className="text-xs font-bold">{stats.vehicles.bikes}</div>
                       <div className="text-[9px] text-muted-foreground font-medium uppercase">Bikes</div>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-orange-500/10 rounded-lg"><Truck className="w-4 h-4 text-orange-600" /></div>
                     <div>
                       <div className="text-xs font-bold">{stats.vehicles.trucks}</div>
                       <div className="text-[9px] text-muted-foreground font-medium uppercase">Trucks</div>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-cyan-500/10 rounded-lg"><Bus className="w-4 h-4 text-cyan-600" /></div>
                     <div>
                       <div className="text-xs font-bold">{stats.vehicles.vans}</div>
                       <div className="text-[9px] text-muted-foreground font-medium uppercase">Vans</div>
                     </div>
                   </div>
                </div>
              </div>

              {/* Live Camera Feed */}
              {isRealTime && latestData?.source_image && (
                 <div className="rounded-xl border-2 border-primary/20 bg-card overflow-hidden shadow-md group relative">
                   <div className="absolute top-2 left-2 z-10 bg-destructive px-2 py-0.5 rounded text-[8px] font-black text-white flex items-center gap-1">
                     <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                     LIVE CAMERA
                   </div>
                   <img src={latestData.source_image} alt="Live feed" className="w-full h-40 object-cover grayscale-[0.3] contrast-125 group-hover:grayscale-0 transition-all duration-500" />
                   <div className="p-2 bg-muted/80 backdrop-blur-sm text-[9px] font-bold text-foreground flex justify-between items-center px-4">
                     <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Confidence: {(latestData.detection_metadata.confidence_score * 100).toFixed(1)}%</span>
                     <span>CAM_{latestData.camera_id.slice(-3)}</span>
                   </div>
                 </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2 pt-2">
                <button className="h-11 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-wider">
                  Adjust Signal Sequence
                </button>
                <button className="h-11 rounded-lg border-2 border-destructive/20 bg-transparent text-destructive font-bold text-xs hover:bg-destructive/5 transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Manual Override
                </button>
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between pt-4 text-[10px] font-bold text-muted-foreground uppercase border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Updated: <span className="text-foreground tabular-nums">{lastUpdatedSec}s ago</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border">
              <div className="p-4 bg-background rounded-full shadow-inner mb-6">
                <Info className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">No Signal Selected</p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-medium">
                Please select a traffic junction from the map or dropdown to begin real-time vehicle flow analysis.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-border bg-muted/20">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground uppercase font-black tracking-[0.2em]">
          <span>© 2026 TF-AI Systems</span>
          <span className="text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 shadow-[0_0_8px_rgba(22,101,52,0.8)]"></span>
            NETWORK SECURE
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
