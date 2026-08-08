// components/map/map-content.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, LatLngExpression, LatLngTuple } from 'leaflet';
import { Bus, MapPin, Navigation, RefreshCw, Play, Pause } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';

// إصلاح أيقونات Leaflet
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// أيقونات مخصصة
const busIcon = new Icon({
  iconUrl: '/bus-icon.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const stationIcon = new Icon({
  iconUrl: '/station-icon.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

interface BusData {
  id: string;
  plate: string;
  current_lat: number;
  current_lng: number;
  speed: number;
  heading: number;
  last_updated: string;
  line_id: string;
  line?: {
    number: string;
    name_ar: string;
    name_fr: string;
    color: string;
    waypoints: [number, number][];
  };
}

interface Station {
  id: string;
  code: string;
  name_ar: string;
  name_fr: string;
  lat: number;
  lng: number;
  has_shelter: boolean;
}

// مكون تحديث الخريطة
function MapUpdater({ buses, isTracking }: { buses: BusData[]; isTracking: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    if (buses.length > 0 && isTracking) {
      const activeBuses = buses.filter(b => b.current_lat && b.current_lng);
      if (activeBuses.length > 0) {
        const bounds = activeBuses.map(b => [b.current_lat, b.current_lng] as LatLngTuple);
        map.fitBounds(bounds);
      }
    }
  }, [buses, map, isTracking]);
  
  return null;
}

export default function MapContent() {
  const { t, locale } = useI18n();
  const [buses, setBuses] = useState<BusData[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState<BusData | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // تحميل البيانات
  const fetchData = useCallback(async () => {
    try {
      const [busesRes, stationsRes, linesRes] = await Promise.all([
        supabase.from('buses').select('*, line:lines(*)').eq('status', 'active'),
        supabase.from('stations').select('*').eq('is_active', true).order('code'),
        supabase.from('lines').select('*').eq('is_active', true),
      ]);

      setBuses(busesRes.data || []);
      setStations(stationsRes.data || []);
      setLines(linesRes.data || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // تحديث مواقع الحافلات - محاكاة الحركة
  const updateBusPositions = useCallback(async () => {
    try {
      // جلب الحافلات الحالية
      const { data } = await supabase
        .from('buses')
        .select('*, line:lines(*)')
        .eq('status', 'active');

      if (!data) return;

      // تحديث كل حافلة بموقع جديد
      for (const bus of data) {
        if (!bus.line?.waypoints || bus.line.waypoints.length < 2) continue;
        
        const waypoints = bus.line.waypoints;
        // اختيار نقطة عشوائية على الخط
        const randomIndex = Math.floor(Math.random() * (waypoints.length - 1));
        const nextIndex = (randomIndex + 1) % waypoints.length;
        
        // حساب موقع بين نقطتين
        const progress = Math.random();
        const lat = waypoints[randomIndex][0] + (waypoints[nextIndex][0] - waypoints[randomIndex][0]) * progress;
        const lng = waypoints[randomIndex][1] + (waypoints[nextIndex][1] - waypoints[randomIndex][1]) * progress;
        
        // تحديث موقع الحافلة
        await supabase
          .from('buses')
          .update({
            current_lat: lat,
            current_lng: lng,
            speed: 15 + Math.random() * 30,
            heading: Math.floor(Math.random() * 360),
            last_updated: new Date().toISOString(),
          })
          .eq('id', bus.id);
      }

      // جلب البيانات المحدثة
      const { data: updatedData } = await supabase
        .from('buses')
        .select('*, line:lines(*)')
        .eq('status', 'active');

      setBuses(updatedData || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error updating bus positions:', error);
    }
  }, []);

  // بدء التتبع
  const startTracking = useCallback(() => {
    setIsTracking(true);
    fetchData();

    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    
    // تحديث كل 3 ثواني
    trackingIntervalRef.current = setInterval(() => {
      updateBusPositions();
    }, 3000);
  }, [fetchData, updateBusPositions]);

  // إيقاف التتبع
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  }, []);

  // تحميل البيانات عند بدء المكون
  useEffect(() => {
    fetchData();
    
    // تحديث أولي بعد ثانيتين
    const initialUpdate = setTimeout(() => {
      updateBusPositions();
    }, 2000);

    return () => {
      clearTimeout(initialUpdate);
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  // الحصول على مسار الخط
  const getLinePath = (lineId: string) => {
    const line = lines.find(l => l.id === lineId);
    if (line?.waypoints) {
      return line.waypoints.map((wp: [number, number]) => [wp[0], wp[1]] as LatLngTuple);
    }
    return [];
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="mt-4 h-[70vh] min-h-[500px] rounded-xl bg-muted animate-pulse flex items-center justify-center">
          <div className="text-muted-foreground">جاري تحميل الخريطة...</div>
        </div>
      </div>
    );
  }

  const center: LatLngExpression = [30.9335, -6.9373];

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{locale === 'ar' ? 'تتبع الحافلات' : 'Suivi des bus'}</h1>
          <p className="text-sm text-muted-foreground">
            {buses.length} {locale === 'ar' ? 'حافلة نشطة' : 'bus actifs'}
            {lastUpdate && (
              <span className="ml-2 text-xs">
                • {locale === 'ar' ? 'آخر تحديث:' : 'Dernière mise à jour:'} 
                {lastUpdate.toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isTracking ? 'destructive' : 'default'}
            onClick={() => {
              if (isTracking) {
                stopTracking();
              } else {
                startTracking();
              }
            }}
            className="gap-2"
          >
            {isTracking ? (
              <>
                <Pause className="h-4 w-4" />
                {locale === 'ar' ? 'إيقاف التتبع' : 'Arrêter'}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {locale === 'ar' ? 'بدء التتبع' : 'Démarrer'}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {locale === 'ar' ? 'تحديث' : 'Rafraîchir'}
          </Button>
        </div>
      </div>

      <div className="relative h-[70vh] min-h-[500px] rounded-xl overflow-hidden border">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* خطوط المسار */}
          {lines.map((line) => {
            const path = getLinePath(line.id);
            if (path.length > 1) {
              return (
                <Polyline
                  key={line.id}
                  positions={path}
                  color={line.color || '#0ea5e9'}
                  weight={3}
                  opacity={0.6}
                  dashArray="5, 5"
                />
              );
            }
            return null;
          })}

          {/* محطات */}
          {stations.map((station) => (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={stationIcon}
            >
              <Popup>
                <div className="text-center">
                  <p className="font-semibold">{locale === 'ar' ? station.name_ar : station.name_fr}</p>
                  <p className="text-xs text-muted-foreground">{station.code}</p>
                  {station.has_shelter && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {locale === 'ar' ? 'مظلة' : 'Abri'}
                    </Badge>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* حافلات */}
          {buses.map((bus) => (
            bus.current_lat && bus.current_lng && (
              <Marker
                key={bus.id}
                position={[bus.current_lat, bus.current_lng]}
                icon={busIcon}
              >
                <Popup>
                  <div className="min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <Bus className="h-4 w-4 text-primary" />
                      <p className="font-semibold">{bus.plate}</p>
                    </div>
                    {bus.line && (
                      <p className="text-sm">
                        {locale === 'ar' ? bus.line.name_ar : bus.line.name_fr}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{bus.speed?.toFixed(0) || 0} km/h</span>
                      <span>•</span>
                      <span>{bus.heading || 0}°</span>
                    </div>
                    {bus.last_updated && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(bus.last_updated).toLocaleTimeString()}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs"
                      onClick={() => setSelectedBus(bus)}
                    >
                      {locale === 'ar' ? 'عرض التفاصيل' : 'Voir détails'}
                    </Button>
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          <MapUpdater buses={buses} isTracking={isTracking} />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <span>{locale === 'ar' ? '🚌 حافلة متحركة' : '🚌 Bus en mouvement'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-warning" />
              <span>{locale === 'ar' ? '📍 محطة' : '📍 Station'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 bg-primary/60 border-t border-dashed border-primary" />
              <span>{locale === 'ar' ? '🛣️ مسار الخط' : '🛣️ Trajet de ligne'}</span>
            </div>
            {isTracking && (
              <div className="flex items-center gap-2 text-green-500">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
                <span>{locale === 'ar' ? '🟢 تتبع نشط' : '🟢 Suivi actif'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* تفاصيل الحافلة المحددة */}
      {selectedBus && (
        <Card className="mt-4 p-4 glass">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Bus className="h-4 w-4 text-primary" />
                {selectedBus.plate}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedBus.line ? 
                  (locale === 'ar' ? selectedBus.line.name_ar : selectedBus.line.name_fr) :
                  (locale === 'ar' ? 'بدون خط' : 'Sans ligne')
                }
              </p>
              <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                <span>📍 {selectedBus.current_lat?.toFixed(5)}, {selectedBus.current_lng?.toFixed(5)}</span>
                <span>🚀 {selectedBus.speed?.toFixed(0) || 0} km/h</span>
                <span>🧭 {selectedBus.heading || 0}°</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedBus(null)}
            >
              ✕
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}