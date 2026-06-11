/**
 * useTrafficSignalEngine
 *
 * A React hook that owns the full simulation for all junctions:
 *
 *  1. Every second  → tick each junction's phase countdown.  When it
 *     reaches zero, advance to the next phase in the 8-phase cycle and
 *     reset countdown to that phase's calculated duration.
 *
 *  2. Every 60 seconds → gradually fluctuate vehicle counts/speeds so
 *     that green allocations drift slowly (simulates real traffic change).
 *     Vehicle counts change by ±2 per direction per minute — smooth, not
 *     jerky.
 *
 * The hook returns [ pinsData ] which is a full TrafficPin[] array that
 * React will re-render every second as countdowns change.
 */

import { useEffect, useRef, useState } from "react";
import type { TrafficPin } from "../data/pins";
import { TRAFFIC_PINS, recalcPin, tickSignal } from "../data/pins";

export function useTrafficSignalEngine(): TrafficPin[] {
  const [pins, setPins] = useState<TrafficPin[]>(TRAFFIC_PINS);

  // We keep the pins in a ref so the intervals always see the latest value
  const pinsRef = useRef(pins);
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    // ── Tick every second ─────────────────────────────────────────────────
    const secondInterval = setInterval(() => {
      setPins((prev) =>
        prev.map((pin) => ({
          ...pin,
          signalState: tickSignal(pin.signalState),
        })),
      );
    }, 1000);

    // ── Slowly drift vehicle counts every 60 s ────────────────────────────
    const driftInterval = setInterval(() => {
      setPins((prev) => prev.map((pin) => recalcPin(pin)));
    }, 60_000);

    return () => {
      clearInterval(secondInterval);
      clearInterval(driftInterval);
    };
  }, []);

  return pins;
}
