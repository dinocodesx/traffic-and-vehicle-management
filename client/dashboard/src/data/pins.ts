// ─── Signal Phase Model ───────────────────────────────────────────────────────
//
// Real-world 4-way intersection operates in a 6-phase cycle:
//
//  Phase 1  NS_GREEN      North + South through traffic (GREEN), E+W RED
//  Phase 2  NS_AMBER      North + South amber warning (5 s), E+W RED
//  Phase 3  NS_LEFT_GREEN North→East & South→West protected left-turn (GREEN)
//  Phase 4  NS_LEFT_AMBER Amber clearance (5 s)
//  Phase 5  EW_GREEN      East + West through traffic (GREEN), N+S RED
//  Phase 6  EW_AMBER      East + West amber warning (5 s), N+S RED
//  Phase 7  EW_LEFT_GREEN East→South & West→North protected left-turn (GREEN)
//  Phase 8  EW_LEFT_AMBER Amber clearance (5 s) → back to Phase 1
//
// Green durations for each phase are proportional to the vehicle count waiting
// in those lanes, bounded to [15, 90] seconds.
// Amber is always a fixed 5 seconds.
// ─────────────────────────────────────────────────────────────────────────────

export type SignalPhase =
  | "NS_GREEN"
  | "NS_AMBER"
  | "NS_LEFT_GREEN"
  | "NS_LEFT_AMBER"
  | "EW_GREEN"
  | "EW_AMBER"
  | "EW_LEFT_GREEN"
  | "EW_LEFT_AMBER";

export type LaneSignal = "GREEN" | "AMBER" | "RED";

// Per-direction signal colour derived from the active phase
export function getLaneSignals(phase: SignalPhase): {
  north: LaneSignal;
  south: LaneSignal;
  east: LaneSignal;
  west: LaneSignal;
} {
  switch (phase) {
    case "NS_GREEN":
      return { north: "GREEN", south: "GREEN", east: "RED", west: "RED" };
    case "NS_AMBER":
      return { north: "AMBER", south: "AMBER", east: "RED", west: "RED" };
    case "NS_LEFT_GREEN":
      // North turning left (east-bound) + South turning left (west-bound)
      return { north: "GREEN", south: "GREEN", east: "RED", west: "RED" };
    case "NS_LEFT_AMBER":
      return { north: "AMBER", south: "AMBER", east: "RED", west: "RED" };
    case "EW_GREEN":
      return { north: "RED", south: "RED", east: "GREEN", west: "GREEN" };
    case "EW_AMBER":
      return { north: "RED", south: "RED", east: "AMBER", west: "AMBER" };
    case "EW_LEFT_GREEN":
      // East turning left (south-bound) + West turning left (north-bound)
      return { north: "RED", south: "RED", east: "GREEN", west: "GREEN" };
    case "EW_LEFT_AMBER":
      return { north: "RED", south: "RED", east: "AMBER", west: "AMBER" };
  }
}

// Human-readable label for each phase
export function getPhaseName(phase: SignalPhase): string {
  switch (phase) {
    case "NS_GREEN":
      return "N↑S↓ Through";
    case "NS_AMBER":
      return "N↑S↓ Clearing";
    case "NS_LEFT_GREEN":
      return "N→E + S→W Turn";
    case "NS_LEFT_AMBER":
      return "N→E + S→W Clearing";
    case "EW_GREEN":
      return "E→W← Through";
    case "EW_AMBER":
      return "E→W← Clearing";
    case "EW_LEFT_GREEN":
      return "E→S + W→N Turn";
    case "EW_LEFT_AMBER":
      return "E→S + W→N Clearing";
  }
}

// Sequence of all 8 phases in order
export const PHASE_SEQUENCE: SignalPhase[] = [
  "NS_GREEN",
  "NS_AMBER",
  "NS_LEFT_GREEN",
  "NS_LEFT_AMBER",
  "EW_GREEN",
  "EW_AMBER",
  "EW_LEFT_GREEN",
  "EW_LEFT_AMBER",
];

// ─── Vehicle Breakdown ────────────────────────────────────────────────────────

export interface VehicleBreakdown {
  cars: number;
  bikes: number;
  trucks: number;
  vans: number;
}

/** Return total vehicles from a breakdown */
export const sumBreakdown = (b: VehicleBreakdown) =>
  b.cars + b.bikes + b.trucks + b.vans;

// ─── Direction-level traffic snapshot ─────────────────────────────────────────

export interface DirectionTraffic {
  vehiclesCount: number;
  vehiclesBreakdown: VehicleBreakdown;
  avgSpeed: number; // km/h
  trafficLevel: "Low" | "Moderate" | "High";
  /** Calculated green phase duration for this direction pair (seconds) */
  allocatedGreen: number;
}

// ─── Per-junction signal state (the real-time engine data) ───────────────────

export interface JunctionSignalState {
  phase: SignalPhase;
  /** Seconds remaining in the current phase */
  countdown: number;
  /** Calculated duration for NS through-green (seconds) */
  nsGreenSecs: number;
  /** Calculated duration for NS left-turn-green (seconds) */
  nsLeftSecs: number;
  /** Calculated duration for EW through-green (seconds) */
  ewGreenSecs: number;
  /** Calculated duration for EW left-turn-green (seconds) */
  ewLeftSecs: number;
}

// ─── Full TrafficPin ──────────────────────────────────────────────────────────

export interface TrafficPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  trafficLevel: "Low" | "Moderate" | "High";
  lastUpdated: string;
  vehiclesCount: number;
  cameraId?: string;
  avgSpeed: number;
  /** Green duration of the currently-active through phase */
  lastGreenTime: number;
  /** Red duration for the currently-idle pair */
  lastRedTime: number;
  vehiclesBreakdown: VehicleBreakdown;
  directions: {
    north: DirectionTraffic;
    south: DirectionTraffic;
    east: DirectionTraffic;
    west: DirectionTraffic;
  };
  /** Live signal phase engine state */
  signalState: JunctionSignalState;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const KOKATA_CENTER: [number, number] = [22.5726, 88.3639];

const AMBER_SECS = 5;
const GREEN_MIN = 15;
const GREEN_MAX = 90;
// Left-turn phases are shorter – usually ≈40 % of the through-green, min 10 s
const LEFT_RATIO = 0.4;
const LEFT_MIN = 10;

function trafficLevel(v: number): "Low" | "Moderate" | "High" {
  if (v > 60) return "High";
  if (v > 25) return "Moderate";
  return "Low";
}

/**
 * Given four direction vehicle counts, proportionally allocate green durations.
 * NS and EW are paired — their combined demand determines green split.
 */
function allocateGreenTimes(
  northV: number,
  southV: number,
  eastV: number,
  westV: number,
): { nsGreen: number; ewGreen: number; nsLeft: number; ewLeft: number } {
  const nsTotal = northV + southV;
  const ewTotal = eastV + westV;
  const grand = nsTotal + ewTotal || 1;

  const nsGreen = Math.max(
    GREEN_MIN,
    Math.min(
      GREEN_MAX,
      Math.round(GREEN_MIN + (GREEN_MAX - GREEN_MIN) * (nsTotal / grand)),
    ),
  );
  const ewGreen = Math.max(
    GREEN_MIN,
    Math.min(
      GREEN_MAX,
      Math.round(GREEN_MIN + (GREEN_MAX - GREEN_MIN) * (ewTotal / grand)),
    ),
  );

  const nsLeft = Math.max(LEFT_MIN, Math.round(nsGreen * LEFT_RATIO));
  const ewLeft = Math.max(LEFT_MIN, Math.round(ewGreen * LEFT_RATIO));

  return { nsGreen, ewGreen, nsLeft, ewLeft };
}

/** Return the duration (seconds) of a given phase based on the signal state */
export function phaseDuration(
  phase: SignalPhase,
  ss: JunctionSignalState,
): number {
  switch (phase) {
    case "NS_GREEN":
      return ss.nsGreenSecs;
    case "NS_LEFT_GREEN":
      return ss.nsLeftSecs;
    case "EW_GREEN":
      return ss.ewGreenSecs;
    case "EW_LEFT_GREEN":
      return ss.ewLeftSecs;
    default:
      return AMBER_SECS;
  }
}

/** Advance to the next phase, returning a fresh JunctionSignalState */
export function advancePhase(ss: JunctionSignalState): JunctionSignalState {
  const currentIdx = PHASE_SEQUENCE.indexOf(ss.phase);
  const nextPhase = PHASE_SEQUENCE[(currentIdx + 1) % PHASE_SEQUENCE.length];
  return {
    ...ss,
    phase: nextPhase,
    countdown: phaseDuration(nextPhase, ss),
  };
}

/**
 * Tick one second on a junction's signal state.
 * Returns the (possibly new-phase) state.
 */
export function tickSignal(ss: JunctionSignalState): JunctionSignalState {
  if (ss.countdown > 1) {
    return { ...ss, countdown: ss.countdown - 1 };
  }
  return advancePhase(ss);
}

// ─── Breakdown helpers ────────────────────────────────────────────────────────

/** Nudge values so none are multiples of 5 (realistic, non-rounded appearance) */
function deMultiply5(b: VehicleBreakdown): VehicleBreakdown {
  let { cars, bikes, trucks, vans } = b;
  if (cars % 5 === 0) cars += 3;
  if (bikes % 5 === 0) bikes += 2;
  if (trucks % 5 === 0 && trucks > 0) trucks += 1;
  if (vans % 5 === 0 && vans > 0) vans += 2;
  return { cars, bikes, trucks, vans };
}

function mkBreakdown(
  cars: number,
  bikes: number,
  trucks: number,
  vans: number,
): VehicleBreakdown {
  return deMultiply5({ cars, bikes, trucks, vans });
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function makePin(
  id: string,
  name: string,
  lat: number,
  lng: number,
  lastUpdated: string,
  cameraId: string | undefined,
  initialPhase: SignalPhase,
  /** Countdown offset so junctions start at different points in their cycle */
  countdownOffset: number,
  northB: VehicleBreakdown,
  southB: VehicleBreakdown,
  eastB: VehicleBreakdown,
  westB: VehicleBreakdown,
  speeds: [number, number, number, number], // N S E W km/h
): TrafficPin {
  const northV = sumBreakdown(northB);
  const southV = sumBreakdown(southB);
  const eastV = sumBreakdown(eastB);
  const westV = sumBreakdown(westB);

  const { nsGreen, ewGreen, nsLeft, ewLeft } = allocateGreenTimes(
    northV,
    southV,
    eastV,
    westV,
  );

  const ss: JunctionSignalState = {
    phase: initialPhase,
    countdown: Math.max(
      1,
      phaseDuration(initialPhase, {
        phase: initialPhase,
        countdown: 0,
        nsGreenSecs: nsGreen,
        ewGreenSecs: ewGreen,
        nsLeftSecs: nsLeft,
        ewLeftSecs: ewLeft,
      }) - countdownOffset,
    ),
    nsGreenSecs: nsGreen,
    ewGreenSecs: ewGreen,
    nsLeftSecs: nsLeft,
    ewLeftSecs: ewLeft,
  };

  const totalCount = northV + southV + eastV + westV;
  const avgSpeed = Math.round(speeds.reduce((a, b) => a + b, 0) / 4);

  const makeDir = (
    v: number,
    b: VehicleBreakdown,
    spd: number,
  ): DirectionTraffic => ({
    vehiclesCount: v,
    vehiclesBreakdown: b,
    avgSpeed: spd,
    trafficLevel: trafficLevel(v),
    allocatedGreen: 0, // filled below
  });

  const directions = {
    north: { ...makeDir(northV, northB, speeds[0]), allocatedGreen: nsGreen },
    south: { ...makeDir(southV, southB, speeds[1]), allocatedGreen: nsGreen },
    east: { ...makeDir(eastV, eastB, speeds[2]), allocatedGreen: ewGreen },
    west: { ...makeDir(westV, westB, speeds[3]), allocatedGreen: ewGreen },
  };

  return {
    id,
    name,
    lat,
    lng,
    trafficLevel: trafficLevel(
      totalCount > 3 ? Math.round(totalCount / 4) : totalCount,
    ),
    lastUpdated,
    vehiclesCount: totalCount,
    cameraId,
    avgSpeed,
    lastGreenTime: nsGreen,
    lastRedTime: ewGreen + nsLeft + nsLeft + AMBER_SECS * 4,
    vehiclesBreakdown: {
      cars: northB.cars + southB.cars + eastB.cars + westB.cars,
      bikes: northB.bikes + southB.bikes + eastB.bikes + westB.bikes,
      trucks: northB.trucks + southB.trucks + eastB.trucks + westB.trucks,
      vans: northB.vans + southB.vans + eastB.vans + westB.vans,
    },
    directions,
    signalState: ss,
  };
}

// ─── Simulation helpers (exported so pages can call them) ─────────────────────

/** Gradually fluctuate one numeric value by at most `range` per tick */
export function nudge(val: number, range: number, min = 0, max = 9999): number {
  const delta = Math.floor(Math.random() * (range * 2 + 1)) - range;
  return Math.max(min, Math.min(max, val + delta));
}

/** Fluctuate a breakdown, ensuring no value is a multiple of 5 */
export function fluctuateBreakdown(b: VehicleBreakdown): VehicleBreakdown {
  let cars = nudge(b.cars, 2, 1);
  let bikes = nudge(b.bikes, 2, 0);
  let trucks = nudge(b.trucks, 1, 0);
  let vans = nudge(b.vans, 1, 0);
  if (cars % 5 === 0) cars += 3;
  if (bikes % 5 === 0) bikes += 2;
  if (trucks % 5 === 0 && trucks > 0) trucks += 1;
  if (vans % 5 === 0 && vans > 0) vans += 2;
  return { cars, bikes, trucks, vans };
}

/**
 * Recalculate a pin's signal timings from fresh vehicle counts and
 * update the direction data.  Does NOT tick the phase — the signal engine
 * does that separately every second.
 */
export function recalcPin(pin: TrafficPin): TrafficPin {
  const northB = fluctuateBreakdown(pin.directions.north.vehiclesBreakdown);
  const southB = fluctuateBreakdown(pin.directions.south.vehiclesBreakdown);
  const eastB = fluctuateBreakdown(pin.directions.east.vehiclesBreakdown);
  const westB = fluctuateBreakdown(pin.directions.west.vehiclesBreakdown);

  const northV = sumBreakdown(northB);
  const southV = sumBreakdown(southB);
  const eastV = sumBreakdown(eastB);
  const westV = sumBreakdown(westB);

  const northSpd = nudge(pin.directions.north.avgSpeed, 2, 5, 70);
  const southSpd = nudge(pin.directions.south.avgSpeed, 2, 5, 70);
  const eastSpd = nudge(pin.directions.east.avgSpeed, 2, 5, 70);
  const westSpd = nudge(pin.directions.west.avgSpeed, 2, 5, 70);

  const { nsGreen, ewGreen, nsLeft, ewLeft } = allocateGreenTimes(
    northV,
    southV,
    eastV,
    westV,
  );

  const newSS: JunctionSignalState = {
    ...pin.signalState,
    nsGreenSecs: nsGreen,
    ewGreenSecs: ewGreen,
    nsLeftSecs: nsLeft,
    ewLeftSecs: ewLeft,
    // Do NOT reset countdown — the live tick handles that
  };

  const totalCount = northV + southV + eastV + westV;
  const avgSpeed = Math.round((northSpd + southSpd + eastSpd + westSpd) / 4);

  return {
    ...pin,
    trafficLevel: trafficLevel(Math.round(totalCount / 4)),
    vehiclesCount: totalCount,
    avgSpeed,
    lastGreenTime: nsGreen,
    lastRedTime: ewGreen,
    vehiclesBreakdown: {
      cars: northB.cars + southB.cars + eastB.cars + westB.cars,
      bikes: northB.bikes + southB.bikes + eastB.bikes + westB.bikes,
      trucks: northB.trucks + southB.trucks + eastB.trucks + westB.trucks,
      vans: northB.vans + southB.vans + eastB.vans + westB.vans,
    },
    directions: {
      north: {
        vehiclesCount: northV,
        vehiclesBreakdown: northB,
        avgSpeed: northSpd,
        trafficLevel: trafficLevel(northV),
        allocatedGreen: nsGreen,
      },
      south: {
        vehiclesCount: southV,
        vehiclesBreakdown: southB,
        avgSpeed: southSpd,
        trafficLevel: trafficLevel(southV),
        allocatedGreen: nsGreen,
      },
      east: {
        vehiclesCount: eastV,
        vehiclesBreakdown: eastB,
        avgSpeed: eastSpd,
        trafficLevel: trafficLevel(eastV),
        allocatedGreen: ewGreen,
      },
      west: {
        vehiclesCount: westV,
        vehiclesBreakdown: westB,
        avgSpeed: westSpd,
        trafficLevel: trafficLevel(westV),
        allocatedGreen: ewGreen,
      },
    },
    signalState: newSS,
  };
}

// ─── 20 Kolkata 4-Way Junctions ───────────────────────────────────────────────
// Each pin starts at a different phase + countdown offset so they aren't
// all in sync — just like real junctions.

export const TRAFFIC_PINS: TrafficPin[] = [
  makePin(
    "1",
    "Park Street Crossing",
    22.5529,
    88.3519,
    "2s ago",
    "ip_camera_001",
    "NS_GREEN",
    8,
    mkBreakdown(23, 11, 2, 4),
    mkBreakdown(29, 13, 1, 3),
    mkBreakdown(18, 8, 0, 2),
    mkBreakdown(21, 9, 2, 3),
    [18, 16, 22, 14],
  ),

  makePin(
    "2",
    "Howrah Bridge Approach",
    22.5851,
    88.3468,
    "1s ago",
    "ip_camera_002",
    "EW_GREEN",
    14,
    mkBreakdown(57, 23, 8, 7),
    mkBreakdown(62, 27, 9, 8),
    mkBreakdown(46, 19, 4, 6),
    mkBreakdown(51, 22, 7, 5),
    [12, 10, 15, 13],
  ),

  makePin(
    "3",
    "Victoria Memorial Crossing",
    22.5448,
    88.3426,
    "5s ago",
    "ip_camera_003",
    "NS_LEFT_GREEN",
    4,
    mkBreakdown(18, 8, 1, 3),
    mkBreakdown(14, 7, 0, 2),
    mkBreakdown(22, 9, 1, 4),
    mkBreakdown(16, 6, 1, 2),
    [32, 36, 30, 34],
  ),

  makePin(
    "4",
    "Sealdah Station Crossing",
    22.5671,
    88.3712,
    "3s ago",
    "ip_camera_004",
    "EW_AMBER",
    3,
    mkBreakdown(41, 21, 4, 8),
    mkBreakdown(37, 19, 3, 7),
    mkBreakdown(45, 24, 5, 9),
    mkBreakdown(34, 17, 2, 6),
    [10, 12, 9, 11],
  ),

  makePin(
    "5",
    "Esplanade Crossing",
    22.5645,
    88.3522,
    "1s ago",
    "ip_camera_005",
    "NS_GREEN",
    22,
    mkBreakdown(31, 14, 2, 6),
    mkBreakdown(35, 16, 1, 5),
    mkBreakdown(27, 12, 2, 4),
    mkBreakdown(29, 13, 1, 5),
    [16, 18, 15, 20],
  ),

  makePin(
    "6",
    "Gariahat Crossing",
    22.5192,
    88.3663,
    "7s ago",
    undefined,
    "EW_LEFT_GREEN",
    7,
    mkBreakdown(18, 9, 1, 3),
    mkBreakdown(23, 12, 1, 4),
    mkBreakdown(16, 8, 0, 2),
    mkBreakdown(19, 11, 1, 3),
    [24, 26, 22, 28],
  ),

  makePin(
    "7",
    "Shyambazar Crossing",
    22.6001,
    88.3705,
    "4s ago",
    undefined,
    "NS_AMBER",
    2,
    mkBreakdown(21, 11, 2, 3),
    mkBreakdown(24, 13, 1, 4),
    mkBreakdown(19, 9, 1, 3),
    mkBreakdown(22, 12, 1, 4),
    [20, 22, 18, 24],
  ),

  makePin(
    "8",
    "Ultadanga Crossing",
    22.5912,
    88.3881,
    "2s ago",
    undefined,
    "EW_GREEN",
    19,
    mkBreakdown(37, 19, 3, 5),
    mkBreakdown(41, 22, 4, 6),
    mkBreakdown(32, 16, 2, 4),
    mkBreakdown(35, 18, 3, 5),
    [14, 16, 13, 17],
  ),

  makePin(
    "9",
    "Salt Lake Sector V Crossing",
    22.5735,
    88.4331,
    "10s ago",
    undefined,
    "NS_LEFT_AMBER",
    3,
    mkBreakdown(13, 6, 0, 2),
    mkBreakdown(15, 7, 1, 3),
    mkBreakdown(11, 5, 0, 1),
    mkBreakdown(14, 6, 0, 2),
    [38, 42, 36, 40],
  ),

  makePin(
    "10",
    "Science City Crossing",
    22.5392,
    88.3968,
    "8s ago",
    undefined,
    "EW_LEFT_AMBER",
    2,
    mkBreakdown(7, 3, 0, 1),
    mkBreakdown(8, 4, 0, 1),
    mkBreakdown(6, 3, 0, 1),
    mkBreakdown(7, 3, 0, 1),
    [48, 52, 46, 50],
  ),

  makePin(
    "11",
    "Jadavpur Crossing",
    22.4992,
    88.3712,
    "8s ago",
    undefined,
    "NS_GREEN",
    11,
    mkBreakdown(17, 9, 1, 3),
    mkBreakdown(19, 10, 1, 4),
    mkBreakdown(14, 7, 0, 2),
    mkBreakdown(17, 8, 1, 3),
    [26, 30, 25, 29],
  ),

  makePin(
    "12",
    "Tollygunge Phari Crossing",
    22.5112,
    88.3452,
    "9s ago",
    undefined,
    "EW_GREEN",
    6,
    mkBreakdown(11, 4, 0, 2),
    mkBreakdown(12, 5, 1, 2),
    mkBreakdown(8, 3, 0, 1),
    mkBreakdown(11, 4, 0, 2),
    [42, 46, 40, 44],
  ),

  makePin(
    "13",
    "Hazra Crossing",
    22.5265,
    88.3478,
    "6s ago",
    undefined,
    "NS_LEFT_GREEN",
    8,
    mkBreakdown(21, 9, 1, 3),
    mkBreakdown(23, 11, 1, 4),
    mkBreakdown(17, 8, 1, 2),
    mkBreakdown(20, 10, 1, 3),
    [22, 25, 21, 26],
  ),

  makePin(
    "14",
    "Behala Chowrasta Crossing",
    22.4942,
    88.3122,
    "4s ago",
    undefined,
    "EW_AMBER",
    1,
    mkBreakdown(26, 12, 2, 4),
    mkBreakdown(29, 14, 2, 5),
    mkBreakdown(22, 10, 1, 3),
    mkBreakdown(24, 12, 1, 4),
    [16, 20, 15, 19],
  ),

  makePin(
    "15",
    "Dum Dum Crossing",
    22.6217,
    88.3789,
    "9s ago",
    undefined,
    "NS_GREEN",
    16,
    mkBreakdown(14, 8, 1, 3),
    mkBreakdown(17, 9, 1, 4),
    mkBreakdown(12, 7, 0, 2),
    mkBreakdown(15, 8, 1, 3),
    [24, 28, 23, 27],
  ),

  makePin(
    "16",
    "College Street Crossing",
    22.5744,
    88.3629,
    "5s ago",
    undefined,
    "EW_LEFT_GREEN",
    5,
    mkBreakdown(18, 8, 1, 3),
    mkBreakdown(20, 9, 1, 4),
    mkBreakdown(15, 7, 0, 2),
    mkBreakdown(18, 8, 1, 3),
    [20, 24, 19, 23],
  ),

  makePin(
    "17",
    "Rabindra Sadan Crossing",
    22.5402,
    88.3475,
    "2s ago",
    undefined,
    "NS_AMBER",
    4,
    mkBreakdown(29, 14, 2, 4),
    mkBreakdown(32, 15, 2, 5),
    mkBreakdown(25, 12, 1, 3),
    mkBreakdown(28, 13, 1, 4),
    [12, 15, 11, 16],
  ),

  makePin(
    "18",
    "New Alipore Crossing",
    22.5142,
    88.3245,
    "10s ago",
    undefined,
    "EW_GREEN",
    12,
    mkBreakdown(8, 4, 0, 1),
    mkBreakdown(9, 5, 0, 2),
    mkBreakdown(7, 3, 0, 1),
    mkBreakdown(8, 4, 0, 1),
    [45, 50, 44, 48],
  ),

  makePin(
    "19",
    "Chingrighata Crossing",
    22.5622,
    88.4032,
    "3s ago",
    undefined,
    "NS_LEFT_GREEN",
    9,
    mkBreakdown(34, 16, 4, 4),
    mkBreakdown(39, 18, 5, 5),
    mkBreakdown(29, 13, 3, 3),
    mkBreakdown(33, 15, 3, 4),
    [10, 13, 9, 14],
  ),

  makePin(
    "20",
    "New Town Action Area Crossing",
    22.5852,
    88.4612,
    "10s ago",
    undefined,
    "EW_LEFT_AMBER",
    4,
    mkBreakdown(6, 3, 0, 1),
    mkBreakdown(7, 4, 0, 1),
    mkBreakdown(5, 2, 0, 1),
    mkBreakdown(6, 3, 0, 1),
    [52, 58, 50, 56],
  ),
];
