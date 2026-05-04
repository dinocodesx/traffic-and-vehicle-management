import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { TRAFFIC_PINS, KOKATA_CENTER } from '../../data/pins';
import type { LatestDetectionResponse } from '../../types/api';

interface MapProps {
  selectedPinId: string | null;
  onPinSelect: (id: string) => void;
  latestData: LatestDetectionResponse | null;
}

// Custom markers for normal (blue) and selected (green) states
const createMarkerIcon = (color: string, isLive: boolean) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        ${isLive ? '<div class="absolute w-6 h-6 bg-blue-500/30 rounded-full animate-ping"></div>' : ''}
        <div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); z-index: 10;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const blueIcon = createMarkerIcon('#3b82f6', false);
const greenIcon = createMarkerIcon('#22c55e', false);
const liveIcon = createMarkerIcon('#3b82f6', true);
const selectedLiveIcon = createMarkerIcon('#22c55e', true);

// Component to handle map view changes when a pin is selected
const ChangeView: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const TrafficMap: React.FC<MapProps> = ({ selectedPinId, onPinSelect, latestData }) => {
  const selectedPin = TRAFFIC_PINS.find(p => p.id === selectedPinId);

  return (
    <div className="w-full h-full relative group">
      <MapContainer 
        center={KOKATA_CENTER} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {selectedPin && <ChangeView center={[selectedPin.lat, selectedPin.lng]} />}

        {TRAFFIC_PINS.map((pin) => {
          const isSelected = pin.id === selectedPinId;
          const isLive = pin.cameraId === latestData?.camera_id;
          
          let icon = blueIcon;
          if (isSelected && isLive) icon = selectedLiveIcon;
          else if (isSelected) icon = greenIcon;
          else if (isLive) icon = liveIcon;

          return (
            <Marker
              key={pin.id}
              position={[pin.lat, pin.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onPinSelect(pin.id),
              }}
            >
              <Popup>
                <div className="p-1">
                  <h3 className="font-bold text-sm mb-1">{pin.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      pin.trafficLevel === 'High' ? 'bg-destructive' :
                      pin.trafficLevel === 'Moderate' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></span>
                    {pin.trafficLevel} Traffic
                  </p>
                  {isLive && (
                    <p className="text-[10px] text-blue-600 font-bold mt-1 animate-pulse">● LIVE FEED ACTIVE</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Custom Map Controls (Shadcn style) */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="bg-card border border-border rounded-md shadow-lg flex flex-col overflow-hidden">
          <button className="p-2 hover:bg-accent transition-colors border-b border-border" title="Zoom In">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button className="p-2 hover:bg-accent transition-colors" title="Zoom Out">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrafficMap;
