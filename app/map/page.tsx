// app/map/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bus, RefreshCw, Loader2, AlertCircle, MapPin, Navigation, Target, 
  Maximize2, Minimize2, X 
} from 'lucide-react';
import dynamic from 'next/dynamic';

// ============================================
// ✅ IMPORT DU CSS DE LEAFLET
// ============================================
if (typeof window !== 'undefined') {
  try {
    require('leaflet/dist/leaflet.css');
    console.log('✅ Leaflet CSS loaded');
  } catch (error) {
    console.warn('⚠️ Leaflet CSS not found, using fallback');
    const style = document.createElement('style');
    style.textContent = `
      .leaflet-container { height: 100%; width: 100%; }
      .leaflet-pane { z-index: 400; }
      .leaflet-tile { filter: none; }
      .leaflet-marker-icon { background: transparent; }
      .leaflet-popup-content { min-width: 200px; }
    `;
    document.head.appendChild(style);
  }
}

// ============================================
// ✅ IMPORT DE LEAFLET
// ============================================
let L: any = null;
let leafletLoaded = false;

const loadLeaflet = async () => {
  if (typeof window === 'undefined') return null;
  if (leafletLoaded) return L;
  
  try {
    const leafletModule = await import('leaflet');
    L = leafletModule.default;
    
    if (L && L.Icon && L.Icon.Default) {
      try {
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
        
        const prototype = L.Icon.Default.prototype as any;
        if (prototype._getIconUrl) {
          delete prototype._getIconUrl;
        }
      } catch (iconError) {
        console.warn('⚠️ Could not configure Leaflet icons:', iconError);
      }
    }
    
    leafletLoaded = true;
    console.log('✅ Leaflet loaded successfully');
    return L;
  } catch (error) {
    console.error('❌ Failed to load Leaflet:', error);
    return null;
  }
};

// ============================================
// COMPOSANT DE CHARGEMENT
// ============================================
function MapLoading() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-muted/20">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">جاري تحميل الخريطة...</p>
      </div>
    </div>
  );
}

// ============================================
// ✅ IMPORT DYNAMIQUE DES COMPOSANTS REACT-LEAFLET
// ============================================
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <MapLoading /> }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false, loading: () => null }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false, loading: () => null }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false, loading: () => null }
);

// ============================================
// TYPES
// ============================================
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
  gps_active?: boolean;
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
  address_ar?: string;
  address_fr?: string;
  lat: number;
  lng: number;
  type: string;
  status: string;
  line_id: string;
  station_order: number;
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

// ============================================
// TILE PROVIDERS
// ============================================
const tileLayers = {
  openstreetmap: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  cartodb: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
  }
};

// ============================================
// ✅ دالة للحصول على لون المحطة من الخط
// ============================================
const getStationColor = (station: Station, lines: Line[]) => {
  const line = lines.find(l => l.id === station.line_id);
  if (line?.color) return line.color;
  if (station.type === 'bus') return '#3b82f6';
  if (station.type === 'tram') return '#10b981';
  if (station.type === 'train') return '#8b5cf6';
  return '#6b7280';
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
export default function MapPage() {
  const { locale } = useI18n();
  const [buses, setBuses] = useState<BusData[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBus, setSelectedBus] = useState<BusData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [center] = useState<[number, number]>([30.9190, -6.8930]);
  const [isFollowingBus, setIsFollowingBus] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [initialBoundsApplied, setInitialBoundsApplied] = useState(false);
  const [tileProvider, setTileProvider] = useState('openstreetmap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  
  const subscriptionRef = useRef<any>(null);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<any>(null);
  const initRef = useRef(false);

  // ============================================
  // ✅ تحميل Leaflet عند تشغيل العميل
  // ============================================
  useEffect(() => {
    setIsClient(true);
    loadLeaflet().then(() => {
      setLeafletReady(true);
    });
  }, []);

  // ============================================
  // ✅ جلب البيانات من قاعدة البيانات
  // ============================================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo('جاري تحميل البيانات...');

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
          .eq('gps_active', true)
          .order('plate'),
        supabase
          .from('stations')
          .select('*')
          .eq('status', 'active')
          .order('station_order', { ascending: true }),
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

      // ✅ التأكد من أن كل خط له لون
      const linesWithColors = linesData.map((line: any) => ({
        ...line,
        color: line.color || '#3b82f6'
      }));

      console.log(`✅ الحافلات النشطة (GPS): ${busesData.length}`);
      console.log(`✅ المحطات: ${stationsData.length}`);
      console.log(`✅ الخطوط: ${linesData.length}`);

      setDebugInfo(
        `🟢 الحافلات: ${busesData.length} | ` +
        `المحطات: ${stationsData.length} | ` +
        `الخطوط: ${linesData.length} | ` +
        `📍 GPS`
      );

      setBuses(busesData);
      setStations(stationsData);
      setLines(linesWithColors);
      setLastUpdate(new Date());

      if (busesData.length === 0) {
        setError('لا توجد حافلات نشطة حالياً.');
      }

    } catch (err: any) {
      console.error('Error fetching map data:', err);
      setError(err.message);
      setDebugInfo('❌ خطأ: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // ✅ الاشتراك في التحديثات اللحظية
  // ============================================
  const startRealtimeSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    console.log('🔄 بدء الاشتراك في تحديثات GPS ...');

    const subscription = supabase
      .channel('bus-location-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'buses',
        },
        async (payload) => {
          console.log('📍 تحديث موقع:', payload);
          
          const { data: updatedBus, error } = await supabase
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
            .eq('id', payload.new.id)
            .single();

          if (error) {
            console.error('❌ خطأ في جلب تحديث الحافلة:', error);
            return;
          }

          if (updatedBus) {
            setBuses(prevBuses => {
              if (updatedBus.gps_active !== true || updatedBus.status !== 'active') {
                return prevBuses.filter(b => b.id !== updatedBus.id);
              }
              
              const index = prevBuses.findIndex(b => b.id === updatedBus.id);
              if (index === -1) {
                return [...prevBuses, updatedBus];
              }
              const newBuses = [...prevBuses];
              newBuses[index] = updatedBus;
              return newBuses;
            });
            
            setLastUpdate(new Date());

            if (isFollowingBus && selectedBus && isMapReady && !isUserInteracting && mapRef.current) {
              if (selectedBus.id === updatedBus.id && updatedBus.current_lat && updatedBus.current_lng) {
                mapRef.current.setView([updatedBus.current_lat, updatedBus.current_lng], 18);
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 حالة الاشتراك:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ تم الاشتراك في تحديثات GPS');
        }
      });

    subscriptionRef.current = subscription;
  }, [isFollowingBus, selectedBus, isMapReady, isUserInteracting]);

  // ============================================
  // ✅ إلغاء الاشتراك
  // ============================================
  const stopRealtimeSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      console.log('⏹️ تم إلغاء الاشتراك في تحديثات GPS');
    }
  }, []);

  // ============================================
  // ✅ تحديد حدود الخريطة
  // ============================================
  const fitMapBounds = useCallback((force: boolean = false) => {
    if (typeof window === 'undefined' || !L) return;
    if (isUserInteracting && !force) return;

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

      if (points.length === 0) {
        mapRef.current.setView(center, 12);
        return;
      }

      const bounds = L.latLngBounds(points);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      
      const zoom = mapRef.current.getZoom();
      if (zoom > 15) {
        mapRef.current.setZoom(14);
      }

      setInitialBoundsApplied(true);
      console.log('✅ تم تحديد الحدود بنجاح');
      
    } catch (error) {
      console.warn('خطأ في تحديد الحدود:', error);
      try {
        mapRef.current?.setView(center, 12);
      } catch (err) {
        console.error('فشل في تعيين العرض الافتراضي:', err);
      }
    }
  }, [buses, stations, center, isUserInteracting]);

  // ============================================
  // ✅ التركيز على الحافلة
  // ============================================
  const focusOnBus = useCallback((bus: BusData) => {
    if (typeof window === 'undefined' || !L) return;
    if (!mapRef.current || !bus.current_lat || !bus.current_lng) return;
    
    setSelectedBus(bus);
    setIsFollowingBus(true);
    
    mapRef.current.setView([bus.current_lat, bus.current_lng], 18, {
      animate: true,
      duration: 1
    });
  }, []);

  // ============================================
  // ✅ إلغاء التحديد
  // ============================================
  const clearSelection = useCallback(() => {
    setIsFollowingBus(false);
    setSelectedBus(null);
    setTimeout(() => fitMapBounds(true), 200);
  }, [fitMapBounds]);

  // ============================================
  // ✅ عرض الكل
  // ============================================
  const resetView = useCallback(() => {
    setIsFollowingBus(false);
    setSelectedBus(null);
    setTimeout(() => fitMapBounds(true), 200);
  }, [fitMapBounds]);

  // ============================================
  // ✅ التكبير والتصغير
  // ============================================
  const zoomIn = useCallback(() => {
    if (!mapRef.current) {
      console.warn('⚠️ Map not ready for zoom in');
      return;
    }
    try {
      const currentZoom = mapRef.current.getZoom();
      const newZoom = Math.min(currentZoom + 1, 20);
      mapRef.current.setZoom(newZoom);
      console.log(`🔍 Zoom in: ${currentZoom} → ${newZoom}`);
    } catch (error) {
      console.error('❌ Error zooming in:', error);
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (!mapRef.current) {
      console.warn('⚠️ Map not ready for zoom out');
      return;
    }
    try {
      const currentZoom = mapRef.current.getZoom();
      const newZoom = Math.max(currentZoom - 1, 1);
      mapRef.current.setZoom(newZoom);
      console.log(`🔍 Zoom out: ${currentZoom} → ${newZoom}`);
    } catch (error) {
      console.error('❌ Error zooming out:', error);
    }
  }, []);

  // ============================================
  // ✅ تبديل وضع الشاشة الكاملة
  // ============================================
  const toggleFullscreen = useCallback(() => {
    if (typeof window === 'undefined') return;
    const container = document.querySelector('.map-container');
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    }
  }, []);

  // ============================================
  // ✅ التعامل مع تفاعل المستخدم
  // ============================================
  const handleMapMove = useCallback(() => {
    setIsUserInteracting(true);
    
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    
    userInteractionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      console.log('🔄 انتهاء تفاعل المستخدم، إعادة تفعيل التتبع التلقائي');
    }, 3000);
  }, []);

  // ============================================
  // ✅ التهيئة
  // ============================================
  useEffect(() => {
    if (!leafletReady || initRef.current) return;
    initRef.current = true;
    
    console.log('🚀 تهيئة الخريطة مع GPS');
    
    fetchData();
    
    const subscriptionTimeout = setTimeout(() => {
      startRealtimeSubscription();
    }, 1000);

    return () => {
      clearTimeout(subscriptionTimeout);
      stopRealtimeSubscription();
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, [leafletReady, fetchData, startRealtimeSubscription, stopRealtimeSubscription]);

  // ============================================
  // ✅ تحديث الحدود عند تغير البيانات
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
  // ✅ حالة التحميل
  // ============================================
  if (!isClient || !leafletReady || loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="mt-4 h-[70vh] min-h-[500px] rounded-xl bg-muted animate-pulse flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">جاري تحميل الخريطة...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // ✅ العرض الرئيسي
  // ============================================
  return (
    <div className="container mx-auto px-4 py-6">
      {/* معلومات التصحيح */}
      <div className="mb-4 p-3 bg-muted/30 rounded-lg text-xs font-mono flex flex-wrap items-center justify-between">
        <span>{debugInfo}</span>
        <span className={isFollowingBus && selectedBus ? 'text-primary font-semibold' : 'text-green-500'}>
          {isFollowingBus && selectedBus ? `🎯 متابعة: ${selectedBus.plate}` : '🟢 GPS نشط'}
          {isUserInteracting && ' 👆 المستخدم يتفاعل'}
        </span>
      </div>

      {/* شريط التحكم */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            {locale === 'ar' ? '🗺️ تتبع الحافلات (GPS)' : '🗺️ Bus Tracking (Real GPS)'}
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
            <option value="openstreetmap">🗺️ خريطة مفتوحة</option>
            <option value="cartodb">🗺️ كارتودي بي</option>
          </select>

          <Button variant="outline" onClick={resetView} className="gap-2">
            <Target className="h-4 w-4" />
            {locale === 'ar' ? '🎯 عرض الكل' : '🎯 Show All'}
          </Button>

          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {locale === 'ar' ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* رسالة الخطأ */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* الخريطة */}
      <div className="relative h-[70vh] min-h-[500px] rounded-xl overflow-hidden border bg-muted/10 map-container">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          ref={mapRef}
          whenReady={() => {
            setIsMapReady(true);
            console.log('✅ تم تحميل الخريطة وجاهزية');
            
            if (mapRef.current) {
              mapRef.current.on('move', handleMapMove);
              mapRef.current.on('zoom', handleMapMove);
              mapRef.current.on('drag', handleMapMove);
            }
          }}
        >
          <TileLayer
            url={tileLayers[tileProvider as keyof typeof tileLayers]?.url || tileLayers.openstreetmap.url}
            attribution={tileLayers[tileProvider as keyof typeof tileLayers]?.attribution || tileLayers.openstreetmap.attribution}
          />

          {/* ✅ المحطات - مع تطابق الألوان مع الخطوط */}
          {stations.map((station) => {
            if (!station.lat || !station.lng) return null;
            if (!L) return null;
            
            const color = getStationColor(station, lines);
            const order = station.station_order || 0;
            const line = lines.find(l => l.id === station.line_id);
            const lineName = line ? `${line.number} - ${line.name_ar}` : 'بدون خط';
            
            try {
              const stationIcon = L.divIcon({
                html: `
                  <div style="
                    background: ${color};
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: bold;
                    color: white;
                    cursor: pointer;
                    transition: transform 0.2s;
                    position: relative;
                  ">
                    ${station.type === 'bus' ? '🚌' : station.type === 'tram' ? '🚋' : '🚆'}
                    <span style="
                      position: absolute;
                      top: -8px;
                      right: -8px;
                      background: ${color};
                      color: white;
                      border-radius: 50%;
                      width: 18px;
                      height: 18px;
                      font-size: 9px;
                      font-weight: bold;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      border: 2px solid white;
                    ">
                      ${order}
                    </span>
                  </div>
                `,
                className: 'station-marker',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
                popupAnchor: [0, -18],
              });
              
              return (
                <Marker
                  key={station.id}
                  position={[station.lat, station.lng]}
                  icon={stationIcon}
                  eventHandlers={{
                    click: () => {
                      setIsFollowingBus(false);
                      if (mapRef.current && station.lat && station.lng) {
                        mapRef.current.setView([station.lat, station.lng], 17);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: color }}
                        />
                        <p className="font-semibold text-base">{station.name_ar}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{station.name_fr}</p>
                      <div className="mt-2 flex items-center gap-2 p-1.5 bg-muted/50 rounded-md">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-medium">{lineName}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground/70">
                        📌 {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            } catch (error) {
              console.warn('Erreur lors de la création du marqueur station:', error);
              return null;
            }
          })}

          {/* ✅ الحافلات */}
          {buses
            .filter(bus => bus.status === 'active' && bus.gps_active === true)
            .map((bus) => {
              if (!bus.current_lat || !bus.current_lng) return null;
              if (!L) return null;
              
              const color = bus.line?.color || '#3b82f6';
              const isSelected = selectedBus?.id === bus.id;
              const size = isSelected ? 44 : 36;
              const hasRealGps = bus.gps_active === true;
              
              try {
                const busIcon = L.divIcon({
                  html: `
                    <div style="
                      background: ${color};
                      width: ${size}px;
                      height: ${size}px;
                      border-radius: 50%;
                      border: 3px solid white;
                      box-shadow: ${isSelected ? '0 0 25px ' + color + '80, 0 2px 10px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.3)'};
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: ${isSelected ? 20 : 16}px;
                      transition: all 0.3s;
                      ${isSelected ? 'animation: pulse 1.5s ease-in-out infinite;' : ''}
                      cursor: pointer;
                    ">
                      🚌
                      ${hasRealGps ? '<span style="position:absolute;top:-4px;right:-4px;font-size:10px;">📡</span>' : ''}
                    </div>
                    <style>
                      @keyframes pulse {
                        0%, 100% { transform: scale(1.1); }
                        50% { transform: scale(1.2); }
                      }
                    </style>
                  `,
                  className: 'bus-marker',
                  iconSize: [size, size],
                  iconAnchor: [size/2, size/2],
                  popupAnchor: [0, -size/2],
                });
                
                return (
                  <Marker
                    key={bus.id}
                    position={[bus.current_lat, bus.current_lng]}
                    icon={busIcon}
                    eventHandlers={{
                      click: () => focusOnBus(bus),
                    }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: color }}
                            />
                            <p className="font-semibold">{bus.plate}</p>
                          </div>
                          <Badge variant="default" className="text-[10px]">
                            🟢 نشط
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          🚌 {bus.line?.name_ar || 'بدون خط'} ({bus.line?.number || '-'})
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>🚀 {bus.speed?.toFixed(0) || 0} كم/س</span>
                          <span>🧭 {bus.heading || 0}°</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/70">
                            📍 {bus.current_lat?.toFixed(5)}, {bus.current_lng?.toFixed(5)}
                          </span>
                          {hasRealGps && (
                            <Badge variant="default" className="text-[8px] bg-green-500">
                              📡 GPS حقيقي
                            </Badge>
                          )}
                        </div>
                        {isSelected && (
                          <div className="mt-1 text-[10px] text-primary font-semibold">
                            🎯 {locale === 'ar' ? 'متابعة' : 'Following'}
                          </div>
                        )}
                        <Button 
                          size="sm" 
                          className="w-full mt-2 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            focusOnBus(bus);
                          }}
                        >
                          <Target className="h-3 w-3" />
                          {locale === 'ar' ? 'تحديد الموقع' : 'Locate'}
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                );
              } catch (error) {
                console.warn('Erreur lors de la création du marqueur bus:', error);
                return null;
              }
            })}
        </MapContainer>

        {/* أزرار التحكم */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/90 backdrop-blur-sm shadow-md w-9 h-9 p-0 hover:bg-background/80 transition-all"
            onClick={() => fitMapBounds(true)}
            title={locale === 'ar' ? 'عرض الكل' : 'Show All'}
          >
            <Target className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/90 backdrop-blur-sm shadow-md w-9 h-9 p-0 hover:bg-background/80 transition-all"
            onClick={toggleFullscreen}
            title={locale === 'ar' ? 'شاشة كاملة' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/90 backdrop-blur-sm shadow-md w-9 h-9 p-0 text-lg font-bold hover:bg-background/80 transition-all hover:scale-105 active:scale-95"
            onClick={zoomIn}
            title={locale === 'ar' ? 'تكبير' : 'Zoom In'}
            disabled={!isMapReady}
          >
            ＋
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/90 backdrop-blur-sm shadow-md w-9 h-9 p-0 text-lg font-bold hover:bg-background/80 transition-all hover:scale-105 active:scale-95"
            onClick={zoomOut}
            title={locale === 'ar' ? 'تصغير' : 'Zoom Out'}
            disabled={!isMapReady}
          >
            −
          </Button>
          <div className="text-center text-[10px] font-mono bg-background/90 backdrop-blur-sm shadow-md rounded-lg px-2 py-1 border">
            {isMapReady && mapRef.current ? `${Math.round(mapRef.current.getZoom())}×` : '...'}
          </div>
        </div>

        {/* إلغاء التحديد */}
        <Button
          variant="outline"
          size="sm"
          className="absolute top-4 left-4 z-[1000] bg-background/90 backdrop-blur-sm shadow-md gap-2"
          onClick={clearSelection}
        >
          <X className="h-4 w-4" />
          {locale === 'ar' ? 'إلغاء التحديد' : 'Clear selection'}
        </Button>

        {/* وسيلة الإيضاح مع ألوان الخطوط */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border max-w-[220px]">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <span>{locale === 'ar' ? '🚌 حافلة (GPS)' : '🚌 Bus (Real GPS)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-500" />
              <span>{locale === 'ar' ? '📍 محطة' : '📍 Station'}</span>
            </div>
            <div className="flex items-center gap-2 text-green-500">
              <span className="text-xs">📡</span>
              <span>{locale === 'ar' ? 'GPS نشط' : 'Real GPS Active'}</span>
            </div>
            
            {/* ✅ ألوان الخطوط في وسيلة الإيضاح */}
            {lines.length > 0 && (
              <div className="border-t pt-1.5 mt-1.5">
                <p className="text-[10px] text-muted-foreground mb-1">
                  {locale === 'ar' ? '🎨 ألوان الخطوط:' : '🎨 Couleurs des lignes:'}
                </p>
                {lines.slice(0, 4).map((line) => (
                  <div key={line.id} className="flex items-center gap-2 py-0.5">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: line.color }}
                    />
                    <span className="text-[10px]">{line.number}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {locale === 'ar' ? line.name_ar : line.name_fr}
                    </span>
                  </div>
                ))}
                {lines.length > 4 && (
                  <p className="text-[8px] text-muted-foreground mt-0.5">
                    +{lines.length - 4} {locale === 'ar' ? 'خطوط أخرى' : 'autres lignes'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* إحصائيات سريعة */}
        <div className="absolute top-4 right-24 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <Bus className="h-3 w-3 text-primary" />
              <span>{buses.filter(b => b.current_lat && b.gps_active).length} {locale === 'ar' ? 'حافلة' : 'buses'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-orange-500" />
              <span>{stations.length} {locale === 'ar' ? 'محطة' : 'stations'}</span>
            </div>
            <div className="flex items-center gap-2 text-green-500">
              <span className="text-[10px]">📡</span>
              <span className="text-[10px]">{buses.filter(b => b.gps_active).length} GPS</span>
            </div>
          </div>
        </div>
      </div>

      {/* قائمة الحافلات */}
      {buses.filter(b => b.gps_active).length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Bus className="h-4 w-4 text-primary" />
            {locale === 'ar' ? 'قائمة الحافلات النشطة (GPS)' : 'Active Buses List (Real GPS)'}
            <Badge variant="secondary" className="ml-2">{buses.filter(b => b.gps_active).length}</Badge>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
            {buses
              .filter(bus => bus.gps_active === true && bus.status === 'active')
              .map((bus) => {
                const color = bus.line?.color || '#3b82f6';
                return (
                  <Card 
                    key={bus.id} 
                    className={`p-2 cursor-pointer hover:shadow-md transition-all ${
                      selectedBus?.id === bus.id ? 'border-primary border-2 bg-primary/5 shadow-lg' : ''
                    }`}
                    onClick={() => focusOnBus(bus)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-sm">{bus.plate}</span>
                      <Badge variant="outline" className="text-[9px] px-1">
                        {bus.line?.number || '-'}
                      </Badge>
                      {selectedBus?.id === bus.id && (
                        <Badge variant="default" className="text-[9px] px-1 animate-pulse">
                          🎯
                        </Badge>
                      )}
                      <Badge variant="default" className="text-[8px] px-1 bg-green-500">
                        📡
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>🚀 {bus.speed?.toFixed(0) || 0} كم/س</span>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}