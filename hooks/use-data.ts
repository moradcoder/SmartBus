'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Bus, BusLine, Station, Announcement, Settings } from '@/lib/types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  return { settings, loading };
}

export function useBuses() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBuses = useCallback(async () => {
    const { data } = await supabase
      .from('buses')
      .select('*, line:lines(*)')
      .order('plate');
    if (data) setBuses(data as unknown as Bus[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBuses();
  }, [fetchBuses]);

  return { buses, loading, refetch: fetchBuses };
}

export function useLines() {
  const [lines, setLines] = useState<BusLine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLines = useCallback(async () => {
    const { data } = await supabase.from('lines').select('*').order('number');
    if (data) setLines(data as unknown as BusLine[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  return { lines, loading, refetch: fetchLines };
}

export function useStations() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStations = useCallback(async () => {
    const { data } = await supabase.from('stations').select('*').order('name_fr');
    if (data) setStations(data as unknown as Station[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  return { stations, loading, refetch: fetchStations };
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false });
    if (data) setAnnouncements(data as unknown as Announcement[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return { announcements, loading, refetch: fetchAnnouncements };
}

export function useStats() {
  const [stats, setStats] = useState({ activeBuses: 0, totalLines: 0, totalStations: 0, totalBuses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [busesRes, linesRes, stationsRes] = await Promise.all([
        supabase.from('buses').select('status'),
        supabase.from('lines').select('id', { count: 'exact', head: true }),
        supabase.from('stations').select('id', { count: 'exact', head: true }),
      ]);
      const buses = (busesRes.data as unknown as { status: string }[]) || [];
      setStats({
        activeBuses: buses.filter((b) => b.status === 'active').length,
        totalBuses: buses.length,
        totalLines: linesRes.count || 0,
        totalStations: stationsRes.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  return { stats, loading };
}
