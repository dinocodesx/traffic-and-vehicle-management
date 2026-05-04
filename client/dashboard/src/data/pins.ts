export interface TrafficPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  trafficLevel: 'Low' | 'Moderate' | 'High';
  lastUpdated: string;
  vehiclesCount: number;
  cameraId?: string;
  avgSpeed: number; // in km/h
  lastGreenTime: number; // in sec
  lastRedTime: number; // in sec
  vehiclesBreakdown: {
    cars: number;
    bikes: number;
    trucks: number;
    vans: number;
  };
}

export const KOKATA_CENTER: [number, number] = [22.5726, 88.3639];

export const TRAFFIC_PINS: TrafficPin[] = [
  { 
    id: '1', name: 'Park Street Crossing', lat: 22.5529, lng: 88.3519, trafficLevel: 'High', lastUpdated: '2s ago', vehiclesCount: 120, cameraId: 'ip_camera_001',
    avgSpeed: 15, lastGreenTime: 30, lastRedTime: 60,
    vehiclesBreakdown: { cars: 75, bikes: 30, trucks: 5, vans: 10 }
  },
  { 
    id: '2', name: 'Howrah Bridge', lat: 22.5851, lng: 88.3468, trafficLevel: 'High', lastUpdated: '1s ago', vehiclesCount: 250, cameraId: 'ip_camera_002',
    avgSpeed: 12, lastGreenTime: 45, lastRedTime: 90,
    vehiclesBreakdown: { cars: 150, bikes: 60, trucks: 25, vans: 15 }
  },
  { 
    id: '3', name: 'Victoria Memorial Crossing', lat: 22.5448, lng: 88.3426, trafficLevel: 'Moderate', lastUpdated: '5s ago', vehiclesCount: 65, cameraId: 'ip_camera_003',
    avgSpeed: 35, lastGreenTime: 40, lastRedTime: 40,
    vehiclesBreakdown: { cars: 40, bikes: 15, trucks: 2, vans: 8 }
  },
  { 
    id: '4', name: 'Sealdah Station', lat: 22.5671, lng: 88.3712, trafficLevel: 'High', lastUpdated: '3s ago', vehiclesCount: 180, cameraId: 'ip_camera_004',
    avgSpeed: 10, lastGreenTime: 35, lastRedTime: 75,
    vehiclesBreakdown: { cars: 100, bikes: 50, trucks: 10, vans: 20 }
  },
  { 
    id: '5', name: 'Esplanade Square', lat: 22.5645, lng: 88.3522, trafficLevel: 'High', lastUpdated: '1s ago', vehiclesCount: 145, cameraId: 'ip_camera_005',
    avgSpeed: 18, lastGreenTime: 45, lastRedTime: 60,
    vehiclesBreakdown: { cars: 85, bikes: 40, trucks: 5, vans: 15 }
  },
  { 
    id: '6', name: 'Gariahat Market', lat: 22.5192, lng: 88.3663, trafficLevel: 'Moderate', lastUpdated: '7s ago', vehiclesCount: 85,
    avgSpeed: 25, lastGreenTime: 40, lastRedTime: 50,
    vehiclesBreakdown: { cars: 50, bikes: 25, trucks: 2, vans: 8 }
  },
  { 
    id: '7', name: 'Shyambazar Five-Point', lat: 22.6001, lng: 88.3705, trafficLevel: 'Moderate', lastUpdated: '4s ago', vehiclesCount: 95,
    avgSpeed: 22, lastGreenTime: 45, lastRedTime: 55,
    vehiclesBreakdown: { cars: 55, bikes: 30, trucks: 3, vans: 7 }
  },
  { 
    id: '8', name: 'Ultadanga Crossing', lat: 22.5912, lng: 88.3881, trafficLevel: 'High', lastUpdated: '2s ago', vehiclesCount: 160,
    avgSpeed: 15, lastGreenTime: 35, lastRedTime: 70,
    vehiclesBreakdown: { cars: 90, bikes: 50, trucks: 8, vans: 12 }
  },
  { 
    id: '9', name: 'Salt Lake Sector V', lat: 22.5735, lng: 88.4331, trafficLevel: 'Moderate', lastUpdated: '10s ago', vehiclesCount: 55,
    avgSpeed: 40, lastGreenTime: 50, lastRedTime: 30,
    vehiclesBreakdown: { cars: 35, bikes: 15, trucks: 1, vans: 4 }
  },
  { 
    id: '10', name: 'Science City Crossing', lat: 22.5392, lng: 88.3968, trafficLevel: 'Low', lastUpdated: '8s ago', vehiclesCount: 30,
    avgSpeed: 50, lastGreenTime: 60, lastRedTime: 20,
    vehiclesBreakdown: { cars: 20, bikes: 8, trucks: 0, vans: 2 }
  },
  { 
    id: '11', name: 'Jadavpur 8B', lat: 22.4992, lng: 88.3712, trafficLevel: 'Moderate', lastUpdated: '8s ago', vehiclesCount: 75,
    avgSpeed: 28, lastGreenTime: 40, lastRedTime: 40,
    vehiclesBreakdown: { cars: 45, bikes: 20, trucks: 2, vans: 8 }
  },
  { 
    id: '12', name: 'Tollygunge Phari', lat: 22.5112, lng: 88.3452, trafficLevel: 'Low', lastUpdated: '9s ago', vehiclesCount: 40,
    avgSpeed: 45, lastGreenTime: 55, lastRedTime: 25,
    vehiclesBreakdown: { cars: 25, bikes: 10, trucks: 1, vans: 4 }
  },
  { 
    id: '13', name: 'Hazra Crossing', lat: 22.5265, lng: 88.3478, trafficLevel: 'Moderate', lastUpdated: '6s ago', vehiclesCount: 90,
    avgSpeed: 24, lastGreenTime: 40, lastRedTime: 50,
    vehiclesBreakdown: { cars: 55, bikes: 25, trucks: 3, vans: 7 }
  },
  { 
    id: '14', name: 'Behala Chowrasta', lat: 22.4942, lng: 88.3122, trafficLevel: 'High', lastUpdated: '4s ago', vehiclesCount: 110,
    avgSpeed: 18, lastGreenTime: 35, lastRedTime: 65,
    vehiclesBreakdown: { cars: 65, bikes: 30, trucks: 5, vans: 10 }
  },
  { 
    id: '15', name: 'Dum Dum Station', lat: 22.6217, lng: 88.3789, trafficLevel: 'Moderate', lastUpdated: '9s ago', vehiclesCount: 70,
    avgSpeed: 26, lastGreenTime: 40, lastRedTime: 45,
    vehiclesBreakdown: { cars: 40, bikes: 20, trucks: 2, vans: 8 }
  },
  { 
    id: '16', name: 'College Street', lat: 22.5744, lng: 88.3629, trafficLevel: 'Moderate', lastUpdated: '5s ago', vehiclesCount: 80,
    avgSpeed: 22, lastGreenTime: 45, lastRedTime: 45,
    vehiclesBreakdown: { cars: 50, bikes: 20, trucks: 2, vans: 8 }
  },
  { 
    id: '17', name: 'Rabindra Sadan', lat: 22.5402, lng: 88.3475, trafficLevel: 'High', lastUpdated: '2s ago', vehiclesCount: 130,
    avgSpeed: 14, lastGreenTime: 30, lastRedTime: 70,
    vehiclesBreakdown: { cars: 80, bikes: 35, trucks: 5, vans: 10 }
  },
  { 
    id: '18', name: 'New Alipore', lat: 22.5142, lng: 88.3245, trafficLevel: 'Low', lastUpdated: '10s ago', vehiclesCount: 35,
    avgSpeed: 48, lastGreenTime: 60, lastRedTime: 20,
    vehiclesBreakdown: { cars: 22, bikes: 10, trucks: 0, vans: 3 }
  },
  { 
    id: '19', name: 'Chingrighata Crossing', lat: 22.5622, lng: 88.4032, trafficLevel: 'High', lastUpdated: '3s ago', vehiclesCount: 155,
    avgSpeed: 12, lastGreenTime: 40, lastRedTime: 80,
    vehiclesBreakdown: { cars: 95, bikes: 40, trucks: 10, vans: 10 }
  },
  { 
    id: '20', name: 'New Town Action Area I', lat: 22.5852, lng: 88.4612, trafficLevel: 'Low', lastUpdated: '10s ago', vehiclesCount: 25,
    avgSpeed: 55, lastGreenTime: 70, lastRedTime: 20,
    vehiclesBreakdown: { cars: 15, bikes: 8, trucks: 0, vans: 2 }
  },
];
