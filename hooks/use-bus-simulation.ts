'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Bus } from '@/lib/types';

const UPDATE_INTERVAL = 5000;

export function useBusSimulation(buses: Bus[]) {
  const [simulatedBuses, setSimulatedBuses] = useState<Bus[]>(buses);
  const waypointsRef = useRef<Map<string, [number, number][]>>(new Map());
  const progressRef = useRef<Map<string, { segment: number; t: number }>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSimulatedBuses(buses);
    buses.forEach((bus) => {
      if (bus.line?.waypoints && bus.line.waypoints.length > 0) {
        waypointsRef.current.set(bus.id, bus.line.waypoints);
        if (!progressRef.current.has(bus.id)) {
          progressRef.current.set(bus.id, { segment: 0, t: 0 });
        }
      }
    });
  }, [buses]);

  const tick = useCallback(() => {
    setSimulatedBuses((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((bus) => {
        const wps = waypointsRef.current.get(bus.id);
        if (!wps || wps.length < 2 || bus.status !== 'active') return bus;

        const prog = progressRef.current.get(bus.id) || { segment: 0, t: 0 };
        const [lat1, lng1] = wps[prog.segment];
        const [lat2, lng2] = wps[(prog.segment + 1) % wps.length];

        const step = 0.04;
        const newT = prog.t + step;

        if (newT >= 1) {
          const nextSeg = (prog.segment + 1) % wps.length;
          progressRef.current.set(bus.id, { segment: nextSeg, t: 0 });
          const lat = lat2;
          const lng = lng2;
          const heading = Math.round(calculateBearing(lat1, lng1, lat2, lng2));
          return { ...bus, current_lat: lat, current_lng: lng, heading, speed: 25 + Math.random() * 20, last_updated: new Date().toISOString() };
        }

        progressRef.current.set(bus.id, { segment: prog.segment, t: newT });
        const lat = lat1 + (lat2 - lat1) * newT;
        const lng = lng1 + (lng2 - lng1) * newT;
        const heading = Math.round(calculateBearing(lat1, lng1, lat2, lng2));
        return { ...bus, current_lat: lat, current_lng: lng, heading, speed: 25 + Math.random() * 20, last_updated: new Date().toISOString() };
      });
    });
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (buses.length > 0) {
      intervalRef.current = setInterval(tick, UPDATE_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [buses, tick]);

  return simulatedBuses;
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
