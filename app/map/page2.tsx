// app/map/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bus, RefreshCw, Loader2, AlertCircle, MapPin, Navigation, Target, 
  Maximize2, Minimize2, Layers 
} from 'lucide-react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Dynamically import Leaflet components
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);
const useMap = dynamic(
  () => import('react-leaflet').then((mod) => mod.useMap),
  { ssr: false }
);

// Types
interface BusData {
  id: string;
  plate: string;
  current_lat: number;
  current_lng: number;
  speed: number;
  heading: number;
  last_updated: string;
  line_id: string;
  status: string;
  line?: {
    id: string;
    number: string;
    name_ar: string;
    name_fr: string;
    color: string;
    waypoints: [number, number][];
  };
}

interface Station {
  id: string;
  name_ar: string;
  name_fr: string;
  lat: number;
  lng: number;
  type: string;
  status: string;
  line_id: string;
}

interface Line {
  id: string;
  number: string;
  name_ar: string;
  name_fr: string;
  color: string;
  status: string;
  waypoints: [number, number][];
}

// Custom icons
const createBusIcon = (color: string = '#3b82f6', isSelected: boolean = false) => {
  const size = isSelected ? 40 : 32;
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? 18 : 14}px;
        transition: all 0.3s;
      ">
        🚌
      </div>
    `,
    className: 'bus-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

const createStationIcon = (type: string) => {
  const icons = {
    bus: '🚌',
    tram: '🚋',
    train: '🚆',
    metro: '🚇',
  };
  const emoji = icons[type as keyof typeof icons] || '📍';
  return L.divIcon({
    html: `
      <div style="
        background: #ffffff;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid #3b82f6;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">
        ${emoji}
      </div>
    `,
    className: 'station-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Map Controller Component - Fixed
function MapController({ onMapReady, onMapMove, isFollowingBus, selectedBus, buses }) {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    // ✅ التأكد من أن map موجود وجاهز
    if (!map) {
      console.warn('Map not available');
      return;
    }

    console.log('✅ MapController: Map is ready', map);

    // استدعاء onMapReady مع الكائن الصحيح
    onMapReady(map);
    setIsMapLoaded(true);

    // ✅ التحقق من وجود zoomControl قبل استخدامه
    if (map.zoomControl) {
      try {
        map.zoomControl.setPosition('bottomright');
      } catch (e) {
        console.warn('Could not set zoom control position:', e);
      }
    }
    
    // ✅ إضافة مستمعي الأحداث
    try {
      map.on('move', () => {
        if (onMapMove) {
          onMapMove(map);
        }
      });

      map.on('zoom', () => {
        if (onMapMove) {
          onMapMove(map);
        }
      });

      map.on('drag', () => {
        if (onMapMove) {
          onMapMove(map);
        }
      });
    } catch (e) {
      console.warn('Could not add event listeners:', e);
    }

    // ✅ تنظيف المستمعين عند إزالة المكون
    return () => {
      try {
        map.off('move');
        map.off('zoom');
        map.off('drag');
      } catch (e) {
        console.warn('Could not remove event listeners:', e);
      }
    };
  }, [map, onMapReady, onMapMove]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!map) return;
    const container = map.getContainer();
    const parent = container.parentElement;
    if (parent) {
      if (!document.fullscreenElement) {
        parent.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    }
  };

  // Fit bounds
  const fitBounds = () => {
    if (!map) return;
    const points: [number, number][] = [];
    buses.forEach((bus: BusData) => {
      if (bus.current_lat && bus.current_lng) {
        points.push([bus.current_lat, bus.current_lng]);
      }
    });
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView([33.5731, -7.5898], 12);
    }
  };

  // Zoom controls
  const zoomIn = () => {
    if (!map) return;
    map.setView(map.getCenter(), map.getZoom() + 1);
  };

  const zoomOut = () => {
    if (!map) return;
    map.setView(map.getCenter(), map.getZoom() - 1);
  };

  if (!isMapLoaded) {
    return null;
  }

  return (
    <>
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm shadow-md hover:bg-background w-9 h-9 p-0"
          onClick={fitBounds}
          title="Fit all buses"
        >
          <Target className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm shadow-md hover:bg-background w-9 h-9 p-0"
          onClick={toggleFullscreen}
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm shadow-md hover:bg-background w-9 h-9 p-0 text-lg font-bold"
          onClick={zoomIn}
          title="Zoom In"
        >
          +
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm shadow-md hover:bg-background w-9 h-9 p-0 text-lg font-bold"
          onClick={zoomOut}
          title="Zoom Out"
        >
          −
        </Button>
      </div>

      {/* Following Indicator */}
      {isFollowingBus && selectedBus && (
        <div className="absolute top-20 left-4 z-[1000] bg-primary/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-primary/30">
          <span className="text-xs text-primary flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            🎯 Following: {selectedBus.plate}
          </span>
        </div>
      )}
    </>
  );
}

// Bus Marker Component
const BusMarker = memo(({ bus, onClick, isSelected }: { bus: BusData; onClick: () => void; isSelected: boolean }) => {
  if (!bus.current_lat || !bus.current_lng) return null;
  
  const color = bus.line?.color || '#3b82f6';
  const icon = createBusIcon(color, isSelected);
  
  return (
    <Marker
      position={[bus.current_lat, bus.current_lng]}
      icon={icon}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="p-1 min-w-[180px]">
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-primary" />
            <p className="font-semibold">{bus.plate}</p>
            <Badge variant={bus.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
              {bus.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {bus.line?.name_ar || 'No line'}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>🚀 {bus.speed?.toFixed(0) || 0} km/h</span>
            <span>🧭 {bus.heading || 0}°</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">
            📍 {bus.current_lat?.toFixed(5)}, {bus.current_lng?.toFixed(5)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

BusMarker.displayName = 'BusMarker';

// Station Marker Component
const StationMarker = memo(({ station, onClick }: { station: Station; onClick: () => void }) => {
  const icon = createStationIcon(station.type);
  
  return (
    <Marker
      position={[station.lat, station.lng]}
      icon={icon}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="p-1 min-w-[150px]">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <p className="font-semibold">{station.name_ar}</p>
          </div>
          <p className="text-sm text-muted-foreground">{station.name_fr}</p>
          <div className="mt-1 text-xs text-muted-foreground">
            {station.type === 'bus' ? '🚌 Bus' : 
             station.type === 'tram' ? '🚋 Tram' : 
             station.type === 'train' ? '🚆 Train' : '🚇 Metro'}
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

StationMarker.displayName = 'StationMarker';

export default function MapPage() {
  const { locale } = useI18n();
  const [buses, setBuses] = useState<BusData[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState<BusData | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [center] = useState<[number, number]>([33.5731, -7.5898]);
  const [isFollowingBus, setIsFollowingBus] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [initialBoundsApplied, setInitialBoundsApplied] = useState(false);
  const [tileProvider, setTileProvider] = useState('openstreetmap');
  
  const subscriptionRef = useRef<any>(null);
  const followIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // ============================================
  // Fetch data from database
  // ============================================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo('Loading data...');

      const [busesRes, stationsRes, linesRes] = await Promise.all([
        supabase
          .from('buses')
          .select(`
            *,
            line:lines(
              id,
              number,
              name_ar,
              name_fr,
              color,
              waypoints
            )
          `)
          .eq('status', 'active')
          .order('plate'),
        supabase
          .from('stations')
          .select('*')
          .eq('status', 'active')
          .order('name_ar'),
        supabase
          .from('lines')
          .select('*')
          .eq('status', 'active')
          .order('number')
      ]);

      if (busesRes.error) throw new Error(busesRes.error.message);
      if (stationsRes.error) throw new Error(stationsRes.error.message);
      if (linesRes.error) throw new Error(linesRes.error.message);

      const busesData = busesRes.data || [];
      const stationsData = stationsRes.data || [];
      const linesData = linesRes.data || [];

      setDebugInfo(
        `🟢 Buses: ${busesData.length} | ` +
        `Stations: ${stationsData.length} | ` +
        `Lines: ${linesData.length}`
      );

      setBuses(busesData);
      setStations(stationsData);
      setLines(linesData);
      setLastUpdate(new Date());

      if (busesData.length === 0) {
        setError('No active buses. Please add buses in the admin panel.');
      }

    } catch (err: any) {
      console.error('Error fetching map data:', err);
      setError(err.message);
      setDebugInfo('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // Update bus positions (simulation)
  // ============================================
  const updateBusPositions = useCallback(async () => {
    try {
      const { data: currentBuses } = await supabase
        .from('buses')
        .select('id, line_id, line:lines(id, waypoints)')
        .eq('status', 'active');

      if (!currentBuses || currentBuses.length === 0) return;

      const updatePromises = currentBuses.map(async (bus) => {
        const waypoints = bus.line?.waypoints;
        if (!waypoints || waypoints.length < 2) return null;
        
        const randomIndex = Math.floor(Math.random() * (waypoints.length - 1));
        const progress = Math.random();
        
        const lat = waypoints[randomIndex][0] + (waypoints[randomIndex + 1][0] - waypoints[randomIndex][0]) * progress;
        const lng = waypoints[randomIndex][1] + (waypoints[randomIndex + 1][1] - waypoints[randomIndex][1]) * progress;
        
        return supabase
          .from('buses')
          .update({
            current_lat: lat,
            current_lng: lng,
            speed: 15 + Math.random() * 30,
            heading: Math.floor(Math.random() * 360),
            last_updated: new Date().toISOString(),
          })
          .eq('id', bus.id);
      });

      await Promise.all(updatePromises);

      const { data: updatedData } = await supabase
        .from('buses')
        .select(`
          *,
          line:lines(
            id,
            number,
            name_ar,
            name_fr,
            color,
            waypoints
          )
        `)
        .eq('status', 'active');

      if (updatedData) {
        setBuses(updatedData);
        setLastUpdate(new Date());
        
        if (isFollowingBus && selectedBus && isMapReady && !isUserInteracting && mapRef.current) {
          const updatedSelectedBus = updatedData.find(b => b.id === selectedBus.id);
          if (updatedSelectedBus) {
            mapRef.current.panTo([updatedSelectedBus.current_lat, updatedSelectedBus.current_lng]);
          }
        }
      }
    } catch (error) {
      console.error('Error updating bus positions:', error);
    }
  }, [isFollowingBus, selectedBus, isMapReady, isUserInteracting]);

  // ============================================
  // Start tracking with Supabase Realtime
  // ============================================
  const startTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    const subscription = supabase
      .channel('bus-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'buses',
          filter: 'status=eq.active',
        },
        async (payload) => {
          console.log('🔄 Bus updated:', payload);
          const { data: updatedBuses } = await supabase
            .from('buses')
            .select(`
              *,
              line:lines(
                id,
                number,
                name_ar,
                name_fr,
                color,
                waypoints
              )
            `)
            .eq('status', 'active');

          if (updatedBuses) {
            setBuses(updatedBuses);
            setLastUpdate(new Date());
            
            if (isFollowingBus && selectedBus && isMapReady && !isUserInteracting && mapRef.current) {
              const updatedSelectedBus = updatedBuses.find(b => b.id === selectedBus.id);
              if (updatedSelectedBus) {
                mapRef.current.panTo([updatedSelectedBus.current_lat, updatedSelectedBus.current_lng]);
              }
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    if (followIntervalRef.current) {
      clearInterval(followIntervalRef.current);
    }
    
    followIntervalRef.current = setInterval(() => {
      updateBusPositions();
    }, 5000);
  }, [updateBusPositions, isFollowingBus, selectedBus, isMapReady, isUserInteracting]);

  const stopTracking = useCallback(() => {
    if (followIntervalRef.current) {
      clearInterval(followIntervalRef.current);
      followIntervalRef.current = null;
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  }, []);

  // ============================================
  // Fit map bounds
  // ============================================
  const fitMapBounds = useCallback((force: boolean = false) => {
    if (isUserInteracting && !force) {
      console.log('⏸️ User is interacting, skipping bounds fitting');
      return;
    }

    if (!mapRef.current) return;

    try {
      const points: [number, number][] = [];
      
      buses.forEach(bus => {
        if (bus.current_lat && bus.current_lng && !isNaN(bus.current_lat) && !isNaN(bus.current_lng)) {
          points.push([bus.current_lat, bus.current_lng]);
        }
      });
      
      stations.forEach(station => {
        if (station.lat && station.lng && !isNaN(station.lat) && !isNaN(station.lng)) {
          points.push([station.lat, station.lng]);
        }
      });

      console.log(`📍 Fitting bounds: ${points.length} points`);

      if (points.length === 0) {
        mapRef.current.setView(center, 12);
        return;
      }

      const bounds = L.latLngBounds(points);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      
      // Limit zoom level
      const zoom = mapRef.current.getZoom();
      if (zoom > 15) {
        mapRef.current.setZoom(14);
      }

      setInitialBoundsApplied(true);
      console.log('✅ Bounds fitted successfully');
      
    } catch (error) {
      console.warn('Error fitting bounds:', error);
      try {
        mapRef.current?.setView(center, 12);
      } catch (err) {
        console.error('Failed to set default view:', err);
      }
    }
  }, [buses, stations, center, isUserInteracting]);

  // ============================================
  // Focus on bus
  // ============================================
  const focusOnBus = useCallback((bus: BusData) => {
    if (!mapRef.current || !bus.current_lat || !bus.current_lng) return;
    
    setSelectedBus(bus);
    setIsFollowingBus(true);
    
    mapRef.current.setView([bus.current_lat, bus.current_lng], 16);
    
    console.log(`🎯 Focusing on bus: ${bus.plate}`);
  }, []);

  // ============================================
  // Reset view
  // ============================================
  const resetView = useCallback(() => {
    setIsFollowingBus(false);
    setSelectedBus(null);
    setTimeout(() => fitMapBounds(true), 200);
    console.log('🔄 Reset view to show all buses and stations');
  }, [fitMapBounds]);

  // ============================================
  // Initialize
  // ============================================
  useEffect(() => {
    fetchData();
    
    const startTimeout = setTimeout(() => {
      startTracking();
    }, 2000);

    return () => {
      clearTimeout(startTimeout);
      stopTracking();
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, [fetchData, startTracking, stopTracking]);

  // ============================================
  // Fit bounds when data changes
  // ============================================
  useEffect(() => {
    if (isMapReady && mapRef.current && (buses.length > 0 || stations.length > 0)) {
      if (!initialBoundsApplied) {
        const timer = setTimeout(() => {
          fitMapBounds(false);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [buses, stations, isMapReady, fitMapBounds, initialBoundsApplied]);

  // ============================================
  // Handle map movement
  // ============================================
  const handleMapMove = useCallback((mapInstance: L.Map) => {
    setIsUserInteracting(true);
    
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    
    userInteractionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      console.log('🔄 User interaction timeout, re-enabling auto-fit');
    }, 3000);
  }, []);

  // ============================================
  // Tile providers
  // ============================================
  const tileLayers = {
    openstreetmap: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    cartodb: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
    },
    openstreetmap_hot: {
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles style by Humanitarian OpenStreetMap Team'
    },
    esri: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }
  };

  // ============================================
  // Loading state
  // ============================================
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="mt-4 h-[70vh] min-h-[500px] rounded-xl bg-muted animate-pulse flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Main render
  // ============================================
  return (
    <div className="container mx-auto px-4 py-6">
      {/* Debug Info */}
      <div className="mb-4 p-3 bg-muted/30 rounded-lg text-xs font-mono flex flex-wrap items-center justify-between">
        <span>{debugInfo}</span>
        <span className={isFollowingBus ? 'text-primary' : 'text-green-500'}>
          {isFollowingBus ? '🎯 Following bus' : '🟢 Tracking active'}
          {isUserInteracting && ' 👆 User interacting'}
        </span>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            {locale === 'ar' ? '🗺️ تتبع الحافلات' : '🗺️ Bus Tracking'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {buses.length} {locale === 'ar' ? 'حافلة نشطة' : 'active buses'}
            {stations.length} {locale === 'ar' ? 'محطة' : 'stations'}
            {lastUpdate && (
              <span className="ml-2 text-xs">
                • {locale === 'ar' ? 'آخر تحديث:' : 'Last update:'} 
                {lastUpdate.toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={tileProvider}
            onChange={(e) => setTileProvider(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            <option value="openstreetmap">🗺️ OpenStreetMap</option>
            <option value="cartodb">🗺️ CartoDB</option>
            <option value="openstreetmap_hot">🗺️ HOT Style</option>
            <option value="esri">🛰️ Esri Satellite</option>
          </select>

          <Button 
            variant="outline" 
            onClick={resetView} 
            className="gap-2"
            title={locale === 'ar' ? 'عرض جميع الحافلات والمحطات' : 'Show all buses and stations'}
          >
            <Target className="h-4 w-4" />
            {locale === 'ar' ? '🎯 عرض الكل' : '🎯 Show All'}
          </Button>

          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {locale === 'ar' ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Map */}
      <div className="relative h-[70vh] min-h-[500px] rounded-xl overflow-hidden border bg-muted/10">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          ref={mapRef}
          whenReady={() => {
            setIsMapReady(true);
            console.log('✅ Map instance loaded and ready');
          }}
        >
          <TileLayer
            url={tileLayers[tileProvider as keyof typeof tileLayers]?.url || tileLayers.openstreetmap.url}
            attribution={tileLayers[tileProvider as keyof typeof tileLayers]?.attribution || tileLayers.openstreetmap.attribution}
          />

          {/* Line paths */}
          {lines.map((line) => {
            const path = line.waypoints || [];
            if (path.length > 1) {
              return (
                <Polyline
                  key={line.id}
                  positions={path.map((wp: [number, number]) => [wp[0], wp[1]])}
                  color={line.color || '#0ea5e9'}
                  weight={4}
                  opacity={0.7}
                  smoothFactor={1}
                />
              );
            }
            return null;
          })}

          {/* Stations */}
          {stations.map((station) => (
            <StationMarker
              key={station.id}
              station={station}
              onClick={() => {
                setSelectedStation(station);
                setIsFollowingBus(false);
              }}
            />
          ))}

          {/* Buses */}
          {buses.map((bus) => (
            <BusMarker
              key={bus.id}
              bus={bus}
              isSelected={selectedBus?.id === bus.id}
              onClick={() => focusOnBus(bus)}
            />
          ))}

          {/* Map Controller */}
          <MapController
            onMapReady={(mapInstance: L.Map) => {
              mapRef.current = mapInstance;
              setMap(mapInstance);
            }}
            onMapMove={handleMapMove}
            isFollowingBus={isFollowingBus}
            selectedBus={selectedBus}
            buses={buses}
          />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <span>{locale === 'ar' ? '🚌 حافلة متحركة' : '🚌 Moving bus'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-500" />
              <span>{locale === 'ar' ? '📍 محطة' : '📍 Station'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 bg-primary/60" />
              <span>{locale === 'ar' ? '🛣️ مسار الخط' : '🛣️ Line route'}</span>
            </div>
            {isFollowingBus && (
              <div className="flex items-center gap-2 text-primary">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>{locale === 'ar' ? '🎯 متابعة حافلة' : '🎯 Following bus'}</span>
              </div>
            )}
            {isUserInteracting && (
              <div className="flex items-center gap-2 text-orange-500">
                <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                <span>{locale === 'ar' ? '👆 تفاعل المستخدم' : '👆 User interacting'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="absolute top-4 right-24 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <Bus className="h-3 w-3 text-primary" />
              <span>{buses.filter(b => b.current_lat).length} {locale === 'ar' ? 'حافلة' : 'buses'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-orange-500" />
              <span>{stations.length} {locale === 'ar' ? 'محطة' : 'stations'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="h-3 w-3 text-primary/60" />
              <span>{lines.length} {locale === 'ar' ? 'خط' : 'lines'}</span>
            </div>
          </div>
        </div>

        {/* Map Source */}
        <div className="absolute bottom-4 right-4 z-[1000] text-[10px] text-muted-foreground/50 bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          {tileProvider === 'openstreetmap' && '© OpenStreetMap'}
          {tileProvider === 'cartodb' && '© OpenStreetMap, CartoDB'}
          {tileProvider === 'openstreetmap_hot' && '© OpenStreetMap, HOT'}
          {tileProvider === 'esri' && '© Esri'}
        </div>
      </div>

      {/* Bus List */}
      {buses.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Bus className="h-4 w-4 text-primary" />
            {locale === 'ar' ? 'قائمة الحافلات النشطة' : 'Active Buses List'}
            <Badge variant="secondary" className="ml-2">{buses.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
            {buses.map((bus) => (
              <Card 
                key={bus.id} 
                className={`p-2 cursor-pointer hover:shadow-md transition-all ${
                  selectedBus?.id === bus.id ? 'border-primary border-2 bg-primary/5' : ''
                }`}
                onClick={() => focusOnBus(bus)}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${bus.current_lat ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                  <span className="font-medium text-sm">{bus.plate}</span>
                  <Badge variant="outline" className="text-[9px] px-1">
                    {bus.line?.number || '-'}
                  </Badge>
                  {selectedBus?.id === bus.id && (
                    <Badge variant="default" className="text-[9px] px-1">
                      🎯
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>🚀 {bus.speed?.toFixed(0) || 0} km/h</span>
                  <span>📍 {bus.current_lat ? 'Active' : 'Unavailable'}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}