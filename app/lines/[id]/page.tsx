// app/lines/[id]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin, Route, Bus as BusIcon, ArrowLeft, ArrowRight, Clock, Maximize2, Minimize2, Play, Pause, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { BusLine, Station, Bus, LineStation } from '@/lib/types';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';

// ============================================
// ✅ FIX: Leaflet marker icons - Version corrigée
// ============================================

// ✅ Supprimer _getIconUrl de manière sécurisée
if (typeof window !== 'undefined') {
  try {
    // Essayer la méthode moderne (v1.7+)
    const iconPrototype = L.Icon.Default.prototype as any;
    if (iconPrototype._getIconUrl) {
      delete iconPrototype._getIconUrl;
    }
    
    // Configurer les nouvelles icônes
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  } catch (error) {
    console.warn('Leaflet icon fix warning:', error);
  }
}

// ✅ Créer une icône personnalisée pour les marqueurs
const createCustomIcon = (color: string = '#3b82f6') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: white;
      font-weight: bold;
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// ✅ Icône pour les bus
const createBusIcon = (color: string = '#3b82f6') => {
  return L.divIcon({
    className: 'bus-marker',
    html: `<div style="
      background: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 20px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      animation: pulse 2s infinite;
    ">
      🚌
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

// ============================================
// ✅ Dynamic imports pour React-Leaflet
// ============================================

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

// ============================================
// ✅ Composant LineMap - Version corrigée
// ============================================

function LineMap({ stations, line, onMapReady }: { 
  stations: Station[]; 
  line: BusLine | null; 
  onMapReady: (ready: boolean) => void;
}) {
  const [map, setMap] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [routePoints, setRoutePoints] = useState<{lat: number; lng: number}[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [busPosition, setBusPosition] = useState<{lat: number; lng: number} | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [routeDistance, setRouteDistance] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const mapRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  const busMarkerRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // ✅ Nettoyage des refs
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // ✅ Fonction pour récupérer le route OSRM
  const fetchRoute = async () => {
    if (stations.length < 2 || !isMountedRef.current) return;

    setIsLoadingRoute(true);
    try {
      const validStations = stations.filter(s => s.lat && s.lng);
      if (validStations.length < 2) {
        // Si moins de 2 stations valides, utiliser les points disponibles
        const points = validStations.map(s => ({ lat: s.lat!, lng: s.lng! }));
        setRoutePoints(points);
        if (points.length > 0) {
          setBusPosition(points[0]);
        }
        setIsLoadingRoute(false);
        return;
      }

      const coordinates = validStations
        .map(s => `${s.lng},${s.lat}`)
        .join(';');

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch route');

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = route.geometry.coordinates.map((coord: number[]) => ({
          lat: coord[1],
          lng: coord[0]
        }));
        
        setRoutePoints(points);
        setRouteDistance(route.distance / 1000);
        setEstimatedTime(Math.round(route.duration / 60));
        
        if (points.length > 0) {
          setBusPosition(points[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback: utiliser les stations directement
      const fallbackPoints = stations
        .filter(s => s.lat && s.lng)
        .map(s => ({ lat: s.lat!, lng: s.lng! }));
      setRoutePoints(fallbackPoints);
      if (fallbackPoints.length > 0) {
        setBusPosition(fallbackPoints[0]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingRoute(false);
      }
    }
  };

  // ✅ Démarrer l'animation
  const startAnimation = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (progress >= 100) {
      setProgress(0);
      if (routePoints.length > 0) {
        setBusPosition(routePoints[0]);
        updateBusMarker(routePoints[0]);
      }
    }

    setIsPlaying(true);
    const startTime = Date.now();
    const startProgress = progress;

    const animate = () => {
      if (!isMountedRef.current) return;
      
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = 0.3;
      const newProgress = Math.min(startProgress + elapsed * speed, 100);
      
      setProgress(newProgress);
      
      if (routePoints.length > 1) {
        const index = Math.floor((newProgress / 100) * (routePoints.length - 1));
        const nextIndex = Math.min(index + 1, routePoints.length - 1);
        const fraction = ((newProgress / 100) * (routePoints.length - 1)) - index;
        
        if (index < routePoints.length - 1) {
          const current = routePoints[index];
          const next = routePoints[nextIndex];
          const lat = current.lat + (next.lat - current.lat) * fraction;
          const lng = current.lng + (next.lng - current.lng) * fraction;
          const newPos = { lat, lng };
          setBusPosition(newPos);
          updateBusMarker(newPos);
        }
      }
      
      if (newProgress < 100) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setProgress(100);
        if (routePoints.length > 0) {
          setBusPosition(routePoints[routePoints.length - 1]);
          updateBusMarker(routePoints[routePoints.length - 1]);
        }
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  // ✅ Mettre à jour le marqueur du bus
  const updateBusMarker = (position: {lat: number; lng: number}) => {
    if (busMarkerRef.current && map) {
      busMarkerRef.current.setLatLng([position.lat, position.lng]);
    }
  };

  // ✅ Réinitialiser l'animation
  const resetAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
    if (routePoints.length > 0) {
      setBusPosition(routePoints[0]);
      updateBusMarker(routePoints[0]);
    }
  };

  // ✅ Initialisation de la carte et du route
  useEffect(() => {
    if (map && stations.length > 0) {
      fetchRoute();
      
      const validStations = stations.filter(s => s.lat && s.lng);
      if (validStations.length > 0) {
        const bounds = L.latLngBounds(validStations.map(s => [s.lat!, s.lng!]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
      onMapReady(true);
    }
  }, [map, stations]);

  // ✅ Ajout du marqueur de bus
  useEffect(() => {
    if (map && routePoints.length > 0 && !busMarkerRef.current) {
      const firstPoint = routePoints[0];
      const busIcon = createBusIcon(line?.color || '#3b82f6');
      
      busMarkerRef.current = L.marker([firstPoint.lat, firstPoint.lng], { 
        icon: busIcon,
        zIndexOffset: 1000
      }).addTo(map);
    }
  }, [map, routePoints, line]);

  if (stations.length === 0) {
    return (
      <div className="h-[500px] bg-muted flex items-center justify-center rounded-lg">
        <p className="text-muted-foreground">لا توجد محطات لعرضها على الخريطة</p>
      </div>
    );
  }

  const lineColor = line?.color || '#3b82f6';
  const pathPositions = routePoints.length > 0 
    ? routePoints.map(p => [p.lat, p.lng] as [number, number])
    : stations.filter(s => s.lat && s.lng).map(s => [s.lat!, s.lng!] as [number, number]);

  return (
    <div className={`relative rounded-lg overflow-hidden border transition-all ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      <div className={`${isFullscreen ? 'h-screen' : 'h-[500px]'}`}>
        <MapContainer
          center={stations[0]?.lat ? [stations[0].lat, stations[0].lng] : [33.5731, -7.5898]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={!isFullscreen}
          attributionControl={true}
          ref={(instance) => {
            if (instance) {
              mapRef.current = instance;
              setMap(instance);
            }
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {pathPositions.length > 1 && (
            <Polyline
              positions={pathPositions}
              color={lineColor}
              weight={5}
              opacity={0.8}
              smoothFactor={1}
              className="line-path"
            />
          )}

          {stations.map((station, index) => {
            if (!station.lat || !station.lng) return null;
            
            return (
              <CircleMarker
                key={station.id}
                center={[station.lat, station.lng]}
                radius={8}
                fillColor={lineColor}
                color="white"
                weight={3}
                opacity={1}
                fillOpacity={0.9}
              >
                <Popup>
                  <div className="text-center min-w-[150px]">
                    <div className="font-semibold text-sm">{station.name_ar}</div>
                    <div className="text-xs text-muted-foreground">{station.name_fr}</div>
                    <div className="text-xs text-muted-foreground mt-1">#{index + 1}</div>
                    {station.address_ar && (
                      <div className="text-xs text-muted-foreground">{station.address_ar}</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Contrôles de la carte */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm shadow-md"
          onClick={() => {
            if (map) {
              const validStations = stations.filter(s => s.lat && s.lng);
              if (validStations.length > 0) {
                const bounds = L.latLngBounds(validStations.map(s => [s.lat!, s.lng!]));
                map.fitBounds(bounds, { padding: [50, 50] });
              }
            }
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm shadow-md"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Informations et contrôles du bus */}
      <div className="absolute bottom-3 left-3 right-3 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground">{stations.length}</span> محطة
            </div>
            {routeDistance > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">{routeDistance.toFixed(1)}</span> كم
              </div>
            )}
            {estimatedTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-foreground">{estimatedTime}</span> دقيقة
              </div>
            )}
            {isLoadingRoute && (
              <div className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                جاري تحميل المسار...
              </div>
            )}
          </div>

          {routePoints.length > 1 && (
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={startAnimation}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={resetAnimation}
                  disabled={progress === 0}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1">
                <Slider
                  value={[progress]}
                  onValueChange={(value) => {
                    const newProgress = value[0];
                    setProgress(newProgress);
                    if (routePoints.length > 1) {
                      const index = Math.floor((newProgress / 100) * (routePoints.length - 1));
                      const nextIndex = Math.min(index + 1, routePoints.length - 1);
                      const fraction = ((newProgress / 100) * (routePoints.length - 1)) - index;
                      
                      if (index < routePoints.length - 1) {
                        const current = routePoints[index];
                        const next = routePoints[nextIndex];
                        const lat = current.lat + (next.lat - current.lat) * fraction;
                        const lng = current.lng + (next.lng - current.lng) * fraction;
                        const newPos = { lat, lng };
                        setBusPosition(newPos);
                        updateBusMarker(newPos);
                      }
                    }
                  }}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="text-xs font-mono text-muted-foreground min-w-[40px]">
                {Math.round(progress)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ✅ Composant principal
// ============================================

export default function LineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale, dir } = useI18n();
  const [line, setLine] = useState<BusLine | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [lineRes, lsRes, busesRes] = await Promise.all([
          supabase.from('lines').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('line_stations')
            .select('*, station:stations(*)')
            .eq('line_id', id)
            .order('sequence'),
          supabase
            .from('buses')
            .select('*, line:lines(*)')
            .eq('line_id', id),
        ]);

        setLine(lineRes.data as unknown as BusLine);
        const lsData = (lsRes.data as unknown as LineStation[]) || [];
        const sortedStations = lsData.map((ls) => ls.station as unknown as Station);
        setStations(sortedStations);
        setBuses((busesRes.data as unknown as Bus[]) || []);
      } catch (error) {
        console.error('Error fetching line data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="h-[500px] rounded-xl bg-muted" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 h-96 rounded-xl bg-muted" />
            <div className="h-96 rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!line) return <div className="container mx-auto py-20 text-center text-muted-foreground">404 - الخط غير موجود</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/lines" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <Arrow className="h-4 w-4" />
        {t.lines?.title || 'الخطوط'}
      </Link>

      <div className="mb-8 flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-white font-bold text-2xl"
          style={{ backgroundColor: line.color }}
        >
          {line.number.replace('L', '')}
        </div>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{locale === 'ar' ? line.name_ar : line.name_fr}</h1>
          <Badge variant={line.is_active ? 'default' : 'secondary'} className="mt-1">
            {line.is_active ? (t.lines?.active || 'نشط') : (t.lines?.inactive || 'غير نشط')}
          </Badge>
        </div>
      </div>

      {/* Carte avec route */}
      <div className="mb-6">
        <LineMap 
          stations={stations} 
          line={line} 
          onMapReady={setMapReady}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stations */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-primary" />
            {t.lines?.stations || 'المحطات'}
          </h2>
          <div className="max-h-[400px] overflow-y-auto pr-2">
            <div className="space-y-1">
              {stations.map((station, i) => (
                <motion.div
                  key={station.id}
                  initial={{ opacity: 0, x: dir === 'rtl' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: line.color }}
                    >
                      {i + 1}
                    </div>
                    {i < stations.length - 1 && (
                      <div className="h-12 w-0.5" style={{ backgroundColor: line.color, opacity: 0.4 }} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="font-medium">{locale === 'ar' ? station.name_ar : station.name_fr}</div>
                    <div className="text-xs text-muted-foreground">
                      {station.code || station.address_ar || ''}
                    </div>
                    {station.lat && station.lng && (
                      <div className="text-xs text-muted-foreground">
                        📌 {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>

        {/* Buses */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <BusIcon className="h-5 w-5 text-primary" />
            {t.map?.buses || 'الحافلات'}
          </h2>
          {buses.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد حافلات على هذا الخط</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {buses.map((bus) => (
                <div key={bus.id} className="rounded-lg border border-border/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{bus.plate}</span>
                    <Badge variant={bus.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {t.common?.[bus.status as keyof typeof t.common] || bus.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{bus.model}</div>
                  {bus.last_updated && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(bus.last_updated).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link href="/map">
            <Button variant="outline" className="mt-4 w-full gap-2">
              <Route className="h-4 w-4" />
              {t.stations?.viewOnMap || 'عرض على الخريطة'}
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}