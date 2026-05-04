import React, { useState, useEffect } from 'react';
import Sidebar from '../components/layout/sidebar';
import TrafficMap from '../components/layout/map';
import type { LatestDetectionResponse } from '../types/api';

const API_URL = 'http://localhost:8001/api/latest';

const Home: React.FC = () => {
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [latestData, setLatestData] = useState<LatestDetectionResponse | null>(null);
  const [isError, setIsError] = useState(false);

  // Poll the API for latest detection data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_URL);
        if (response.ok) {
          const data: LatestDetectionResponse = await response.json();
          setLatestData(data);
          setIsError(false);
          
          // Optimization: If no pin is selected and we get live data, 
          // we could optionally auto-select the camera's location.
          // For now, we'll just keep the latest data available.
        }
      } catch (error) {
        console.error('Failed to fetch traffic data:', error);
        setIsError(true);
      }
    };

    // Initial fetch
    fetchData();

    // Poll every 5 seconds
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  const handlePinSelect = (id: string) => {
    setSelectedPinId(id);
  };

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden">
      <Sidebar 
        selectedPinId={selectedPinId} 
        onPinSelect={handlePinSelect} 
        latestData={latestData}
      />
      <main className="flex-1 relative">
        {isError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-destructive text-destructive-foreground px-4 py-2 rounded-full text-xs font-bold shadow-2xl animate-bounce">
            ⚠️ API DISCONNECTED - CHECK SERVER
          </div>
        )}
        <TrafficMap 
          selectedPinId={selectedPinId} 
          onPinSelect={handlePinSelect} 
          latestData={latestData}
        />
      </main>
    </div>
  );
};

export default Home;
