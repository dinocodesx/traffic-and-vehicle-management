import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Car, 
  ShieldCheck, 
  Cpu,
  History,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

type SignalState = 'RED' | 'ORANGE' | 'GREEN';

const Traffic: React.FC = () => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [signal, setSignal] = useState<SignalState>('RED');
  const [timer, setTimer] = useState(45);
  const [processedFrames, setProcessedFrames] = useState(1240);

  // Signal Logic: RED (45s) -> ORANGE (5s) -> GREEN (30s) -> ORANGE (5s)
  useEffect(() => {
    const countdown = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [signal]);

  // Refined Signal State Machine
  useEffect(() => {
    if (timer === 0) {
      if (signal === 'RED') {
        setSignal('ORANGE');
        setTimer(5);
      } else if (signal === 'ORANGE') {
        setSignal('GREEN'); 
        setTimer(30);
      } else if (signal === 'GREEN') {
        setSignal('RED');
        setTimer(45);
      }
    }
  }, [timer, signal]);

  // Simulate frame processing
  useEffect(() => {
    const frameUpdater = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % 60);
      setProcessedFrames(prev => prev + 1);
    }, 3000);
    return () => clearInterval(frameUpdater);
  }, []);

  const getFrameUrl = (index: number) => {
    // Using the real frames from the backend
    const formattedIndex = index.toString().padStart(4, '0');
    return `http://localhost:8000/frames/frame_${formattedIndex}.jpg`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Header */}
      <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center justify-between px-10 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link to="/" className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className="h-10 w-[1px] bg-slate-200" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-slate-900">Diagnostic Analysis</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">System ID: KOL_SEC5_Node_4</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-primary uppercase">Engine Status</span>
             <span className="text-xs font-bold flex items-center gap-2 text-slate-700">
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               OPTIMIZED
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
               <span className="text-xs font-black uppercase tracking-widest text-slate-800">LIVE FEED // CAM_04</span>
             </div>
             <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-100 text-[10px] font-bold tabular-nums text-slate-600 shadow-sm">
               FRM_{frameIndex.toString().padStart(4, '0')} // {new Date().toLocaleTimeString()}
             </div>
          </div>

          <img 
            src={getFrameUrl(frameIndex)} 
            alt="Traffic Camera" 
            className="w-full h-full object-cover transition-all duration-700"
          />

          {/* AI Bounding Box Overlays */}
          <div className="absolute inset-0 pointer-events-none border-[12px] border-white/10">
             <div className="absolute top-1/3 left-1/4 w-32 h-20 border-2 border-primary bg-primary/10 flex flex-col p-1 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                <span className="text-[8px] font-black bg-primary text-white w-fit px-1">CAR [98%]</span>
             </div>
             <div className="absolute top-1/2 left-1/2 w-40 h-24 border-2 border-amber-500 bg-amber-500/10 flex flex-col p-1 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <span className="text-[8px] font-black bg-amber-500 text-white w-fit px-1">BUS [94%]</span>
             </div>
             <div className="absolute bottom-1/4 right-1/3 w-20 h-16 border-2 border-violet-500 bg-violet-500/10 flex flex-col p-1 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                <span className="text-[8px] font-black bg-violet-500 text-white w-fit px-1">BIKE [89%]</span>
             </div>
          </div>

          <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
             <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200 shadow-lg max-w-xs">
                <h4 className="text-[10px] font-black uppercase text-primary mb-2 tracking-widest">Inference Details</h4>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Deep Neural Network processing current frame with 14.2ms latency. Object detection verified across 3 parallel nodes.
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
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Signal status</h2>
             </div>

             <div className="flex justify-between items-center bg-slate-50 p-10 rounded-[2rem] border border-slate-100 relative shadow-inner">
                {/* Traffic Light UI */}
                <div className="flex flex-col gap-6 bg-slate-200/50 p-4 rounded-3xl border border-slate-200">
                   <div className={`w-14 h-14 rounded-full border-4 shadow-xl transition-all duration-500 ${signal === 'RED' ? 'bg-red-500 border-red-200 shadow-red-500/20 scale-110' : 'bg-slate-300 border-slate-400/20'}`} />
                   <div className={`w-14 h-14 rounded-full border-4 shadow-xl transition-all duration-500 ${signal === 'ORANGE' ? 'bg-amber-400 border-amber-100 shadow-amber-400/20 scale-110' : 'bg-slate-300 border-slate-400/20'}`} />
                   <div className={`w-14 h-14 rounded-full border-4 shadow-xl transition-all duration-500 ${signal === 'GREEN' ? 'bg-green-500 border-green-200 shadow-green-500/20 scale-110' : 'bg-slate-300 border-slate-400/20'}`} />
                </div>

                <div className="text-center flex flex-col items-center flex-1 ml-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Next Phase In</span>
                   <div className="text-8xl font-black tabular-nums tracking-tighter text-slate-900 drop-shadow-sm">
                     {timer}
                   </div>
                   <span className="text-lg font-bold text-slate-400 mt-2">SECONDS</span>
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
                   <span className="text-3xl font-black text-slate-900">42</span>
                   <span className="text-[10px] font-bold text-green-600 font-bold">+8% trend</span>
                </div>
                <div className="space-y-1 mt-2">
                   <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                      <span>Cars</span>
                      <span>28</span>
                   </div>
                   <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="w-2/3 h-full bg-primary" />
                   </div>
                </div>
             </div>

             <div className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                   <History className="w-3.5 h-3.5" />
                   Total Processed
                </div>
                <div className="flex items-baseline gap-2">
                   <span className="text-3xl font-black tabular-nums text-slate-900">{processedFrames.toLocaleString()}</span>
                   <span className="text-[10px] font-bold text-slate-400">Frames</span>
                </div>
                <div className="text-[9px] font-bold text-primary mt-auto flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                   PROCESSING AT 30FPS
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
