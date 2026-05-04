import React, { useState, useEffect } from 'react';
import { TRAFFIC_PINS } from '../data/pins';
import type { TrafficPin } from '../data/pins';
import { 
  Activity, 
  Car, 
  Bike, 
  Truck, 
  Bus, 
  Clock, 
  Gauge, 
  TrafficCone, 
  ChevronRight,
  LayoutDashboard,
  X,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Monitor: React.FC = () => {
  const [pinsData, setPinsData] = useState<TrafficPin[]>(TRAFFIC_PINS);
  const [countdown, setCountdown] = useState(10);
  const [selectedPin, setSelectedPin] = useState<TrafficPin | null>(null);

  // Update data every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
    }, 1000);

    const dataUpdater = setInterval(() => {
      setPinsData(currentPins => currentPins.map(pin => {
        const fluctuate = (val: number, range: number) => Math.max(0, val + Math.floor(Math.random() * range * 2) - range);
        const newCars = fluctuate(pin.vehiclesBreakdown.cars, 5);
        const newBikes = fluctuate(pin.vehiclesBreakdown.bikes, 3);
        const newTrucks = fluctuate(pin.vehiclesBreakdown.trucks, 1);
        const newVans = fluctuate(pin.vehiclesBreakdown.vans, 2);
        const total = newCars + newBikes + newTrucks + newVans;
        
        return {
          ...pin,
          avgSpeed: Math.max(5, Math.min(60, fluctuate(pin.avgSpeed, 4))),
          vehiclesCount: total,
          trafficLevel: total > 150 ? 'High' : (total > 70 ? 'Moderate' : 'Low'),
          vehiclesBreakdown: { cars: newCars, bikes: newBikes, trucks: newTrucks, vans: newVans }
        };
      }));
    }, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(dataUpdater);
    };
  }, []);

  // Mock historical data for 7 days
  const getHistoricalData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(day => ({
      day,
      total: 800 + Math.floor(Math.random() * 1200),
      avgSpeed: 20 + Math.floor(Math.random() * 30),
      peakHour: `${16 + Math.floor(Math.random() * 4)}:00`,
      trend: Math.random() > 0.5 ? 'up' : 'down'
    }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card px-8 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <TrafficCone className="text-primary w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Global Traffic Monitor</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Kolkata Metro Surveillance</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider">Next Sync in {countdown}s</span>
          </div>
          
          <Link to="/" className="flex items-center gap-2 text-xs font-bold hover:text-primary transition-colors bg-secondary px-4 py-2 rounded-md">
            <LayoutDashboard className="w-4 h-4" />
            Home View
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1800px] mx-auto">
          {pinsData.map((pin) => (
            <div 
              key={pin.id} 
              onClick={() => setSelectedPin(pin)}
              className="group bg-card border-2 border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col cursor-pointer active:scale-[0.98]"
            >
              {/* Card Header */}
              <div className="p-5 border-b bg-muted/10">
                <div className="flex justify-between items-start mb-3">
                  <div className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm ${
                    pin.trafficLevel === 'High' ? 'bg-destructive text-destructive-foreground' :
                    pin.trafficLevel === 'Moderate' ? 'bg-yellow-500 text-yellow-950' : 
                    'bg-green-600 text-white'
                  }`}>
                    {pin.trafficLevel}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Gauge className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold tabular-nums">{pin.avgSpeed} km/h</span>
                  </div>
                </div>
                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{pin.name}</h3>
              </div>

              {/* Stats Body */}
              <div className="p-5 space-y-5 flex-1">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Activity className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground uppercase">Live Flow</span>
                   </div>
                   <div className="text-2xl font-black tabular-nums">{pin.vehiclesCount}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-xs font-black">{pin.vehiclesBreakdown.cars}</div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase">Cars</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-l pl-4 border-border/50">
                    <Bike className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="text-xs font-black">{pin.vehiclesBreakdown.bikes}</div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase">Bikes</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t pt-2 border-border/50">
                    <Truck className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="text-xs font-black">{pin.vehiclesBreakdown.trucks}</div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase">Trucks</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-l pt-2 pl-4 border-border/50">
                    <Bus className="w-4 h-4 text-cyan-500" />
                    <div>
                      <div className="text-xs font-black">{pin.vehiclesBreakdown.vans}</div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase">Vans</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-4 bg-muted/30 mt-auto flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  CLICK FOR HISTORY
                </div>
                <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Detail Drawer Overlay */}
      {selectedPin && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedPin(null)}
          />
          <div className="relative w-full max-w-2xl bg-card border-l h-full shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
            {/* Drawer Header */}
            <div className="p-8 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <TrafficCone className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">{selectedPin.name}</h2>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> 7-Day Historical Analytics
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPin(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 p-8 overflow-y-auto space-y-8">
              {/* Summary Section */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-secondary/50 p-6 rounded-3xl border border-border">
                  <div className="text-[10px] font-black text-muted-foreground uppercase mb-2">Total Vehicles</div>
                  <div className="text-3xl font-black">7.4k</div>
                  <div className="text-[10px] font-bold text-green-600 flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3" /> +12% from last week
                  </div>
                </div>
                <div className="bg-secondary/50 p-6 rounded-3xl border border-border">
                  <div className="text-[10px] font-black text-muted-foreground uppercase mb-2">Avg Speed</div>
                  <div className="text-3xl font-black">24 <span className="text-sm">km/h</span></div>
                  <div className="text-[10px] font-bold text-destructive flex items-center gap-1 mt-1">
                    <ArrowDownRight className="w-3 h-3" /> -5% from last week
                  </div>
                </div>
                <div className="bg-secondary/50 p-6 rounded-3xl border border-border">
                  <div className="text-[10px] font-black text-muted-foreground uppercase mb-2">Peak Delay</div>
                  <div className="text-3xl font-black">18 <span className="text-sm">min</span></div>
                  <div className="text-[10px] font-bold text-yellow-600 flex items-center gap-1 mt-1">
                    STABLE
                  </div>
                </div>
              </div>

              {/* 7-Day Table */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                   <Activity className="w-4 h-4 text-primary" />
                   Daily Performance Breakdown
                </h3>
                <div className="border rounded-3xl overflow-hidden bg-card shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left py-4 px-6 text-[10px] font-black uppercase tracking-tighter">Day</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black uppercase tracking-tighter">Total Flow</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black uppercase tracking-tighter">Avg Speed</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black uppercase tracking-tighter">Peak Hour</th>
                        <th className="text-right py-4 px-6 text-[10px] font-black uppercase tracking-tighter">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {getHistoricalData().map((data) => (
                        <tr key={data.day} className="hover:bg-muted/20 transition-colors group">
                          <td className="py-4 px-6 font-bold text-sm">{data.day}</td>
                          <td className="py-4 px-6 text-center tabular-nums font-medium">{data.total}</td>
                          <td className="py-4 px-6 text-center tabular-nums text-muted-foreground">{data.avgSpeed} km/h</td>
                          <td className="py-4 px-6 text-center font-bold text-xs text-primary">{data.peakHour}</td>
                          <td className="py-4 px-6 text-right">
                             <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                               data.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                             }`}>
                               {data.trend === 'up' ? 'Clear' : 'Heavy'}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Note */}
              <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  * Analytics are generated based on real-time sensor data and historical pattern recognition. Accuracy is rated at 98.4% for this sector.
                </p>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-8 border-t bg-muted/20 flex gap-4">
               <button className="flex-1 h-12 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20">
                 Export PDF Report
               </button>
               <button className="h-12 px-6 border-2 border-border font-black text-xs uppercase tracking-widest rounded-xl hover:bg-secondary transition-all">
                 Compare
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="p-6 border-t bg-muted/10 text-center relative z-10">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
          TF-AI Global Monitor System • Status: <span className="text-green-600">Secure</span> • Node: Kolkata_Metro_01
        </p>
      </footer>
    </div>
  );
};

export default Monitor;
