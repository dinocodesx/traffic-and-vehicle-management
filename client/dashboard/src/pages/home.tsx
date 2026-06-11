import React, { useEffect, useState } from "react";
import TrafficMap from "../components/layout/map";
import Sidebar from "../components/layout/sidebar";
import { useTrafficSignalEngine } from "../hooks/useTrafficSignalEngine";
import type { LatestDetectionResponse } from "../types/api";

const API_URL = "http://localhost:8001/api/latest";

const Home: React.FC = () => {
  const pinsData = useTrafficSignalEngine();

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [latestData, setLatestData] = useState<LatestDetectionResponse | null>(
    null,
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(API_URL);
        if (res.ok) setLatestData(await res.json());
      } catch {
        // server not running — silently ignore
      }
    };
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden">
      <Sidebar
        selectedPinId={selectedPinId}
        onPinSelect={setSelectedPinId}
        latestData={latestData}
        pinsData={pinsData}
      />
      <main className="flex-1 relative">
        <TrafficMap
          selectedPinId={selectedPinId}
          onPinSelect={setSelectedPinId}
          latestData={latestData}
          pinsData={pinsData}
        />
      </main>
    </div>
  );
};

export default Home;
