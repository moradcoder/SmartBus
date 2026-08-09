// app/driver/page.tsx
'use client';

import { withAuth } from '@/lib/withAuth';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Bus as BusIcon, Navigation, Send, Bell, AlertCircle, 
  Gauge, Clock, MessageSquare, Wifi, WifiOff, Car,
  Activity, MapPin, Route as RouteIcon, User, Phone,
  Shield, CheckCircle, XCircle, RefreshCw,
  AlertTriangle, Zap
} from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Driver, Bus, BusLine, Report } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

// ============================================
// Interfaces
// ============================================

interface DriverMessage {
  id: string;
  driver_id: string;
  sender_role: 'driver' | 'admin';
  sender_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface DispatchNotification {
  id: string;
  driver_id: string;
  type: string;
  title_ar: string | null;
  title_fr: string | null;
  body_ar: string | null;
  body_fr: string | null;
  is_read: boolean;
  created_at: string;
}

// ============================================
// GPS Tracking Keys
// ============================================

const GPS_STORAGE_KEY = 'smartbus_gps_tracking';
const GPS_LAST_POSITION_KEY = 'smartbus_gps_last_position';

// ============================================
// Main Component
// ============================================

function DriverPage() {
  const { t, locale } = useI18n();
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  // ============================================
  // State
  // ============================================
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [line, setLine] = useState<BusLine | null>(null);
  const [messages, setMessages] = useState<DriverMessage[]>([]);
  const [notifications, setNotifications] = useState<DispatchNotification[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [reportType, setReportType] = useState('breakdown');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [currentLat, setCurrentLat] = useState(0);
  const [currentLng, setCurrentLng] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsRetryCount, setGpsRetryCount] = useState(0);
  const [isUsingRealGps, setIsUsingRealGps] = useState(false);
  
  // ============================================
  // Refs
  // ============================================
  
  const watchIdRef = useRef<number | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const lastPositionSentRef = useRef<{lat: number; lng: number; time: number} | null>(null);
  const gpsRestartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGpsStartingRef = useRef(false);
  const isRestoringRef = useRef(false);
  const isStoppingRef = useRef(false);
  const restoreAttemptsRef = useRef(0);
  const MAX_RESTORE_ATTEMPTS = 3;
  const isInitialRestoreDone = useRef(false);

  // ============================================
  // Environment Check
  // ============================================
  
  const isClient = typeof window !== 'undefined';
  const hasGeolocation = isClient && typeof navigator !== 'undefined' && 'geolocation' in navigator;

  // ============================================
  // GPS Storage Functions
  // ============================================
  
  const saveGpsState = useCallback((active: boolean) => {
    if (!isClient) return;
    try {
      if (active) {
        localStorage.setItem(GPS_STORAGE_KEY, JSON.stringify({
          trackingActive: true,
          driverId: driver?.id,
          busId: bus?.id,
          timestamp: Date.now()
        }));
        console.log('💾 GPS state saved (active)');
      } else {
        localStorage.removeItem(GPS_STORAGE_KEY);
        localStorage.removeItem(GPS_LAST_POSITION_KEY);
        console.log('🗑️ GPS state removed from localStorage');
      }
    } catch (error) {
      console.warn('Failed to save GPS state:', error);
    }
  }, [driver, bus]);

  const loadGpsState = useCallback(() => {
    if (!isClient) return null;
    try {
      const data = localStorage.getItem(GPS_STORAGE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(GPS_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn('Failed to load GPS state:', error);
      return null;
    }
  }, []);

  const clearGpsState = useCallback(() => {
    if (!isClient) return;
    try {
      localStorage.removeItem(GPS_STORAGE_KEY);
      localStorage.removeItem(GPS_LAST_POSITION_KEY);
      console.log('🗑️ All GPS data cleared');
    } catch (error) {
      console.warn('Failed to clear GPS state:', error);
    }
  }, []);

  const saveLastPosition = useCallback((lat: number, lng: number) => {
    if (!isClient) return;
    try {
      localStorage.setItem(GPS_LAST_POSITION_KEY, JSON.stringify({
        lat,
        lng,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save last position:', error);
    }
  }, []);

  // ============================================
  // دالة تسجيل الخروج
  // ============================================
  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // ============================================
  // Core GPS Update Function
  // ============================================
  const updateBusLocation = useCallback(async (lat: number, lng: number, speed: number, heading: number) => {
    if (!bus?.id) {
      console.warn('No bus ID available for location update');
      return false;
    }

    const now = Date.now();
    if (lastPositionSentRef.current) {
      const timeDiff = now - lastPositionSentRef.current.time;
      if (timeDiff < 1000) {
        return false;
      }
    }

    try {
      const nowISO = new Date().toISOString();
      const realSpeed = speed || 0;
      const realHeading = heading || 0;
      
      console.log(`📡 تحديث موقع: سرعة ${realSpeed.toFixed(1)} كم/س, اتجاه ${realHeading}°`);
      
      const { error } = await supabase
        .from('buses')
        .update({
          current_lat: lat,
          current_lng: lng,
          speed: Math.round(realSpeed),
          heading: Math.round(realHeading),
          gps_active: true,
          status: 'active',
          last_updated: nowISO,
        })
        .eq('id', bus.id);

      if (error) {
        console.error('❌ Supabase update error:', error);
        return false;
      }

      setCurrentLat(lat);
      setCurrentLng(lng);
      setCurrentSpeed(realSpeed);
      setCurrentHeading(realHeading);
      setLastUpdated(nowISO);
      
      saveLastPosition(lat, lng);
      lastPositionSentRef.current = { lat, lng, time: now };
      
      return true;
    } catch (error) {
      console.error('❌ Error updating bus location:', error);
      return false;
    }
  }, [bus, saveLastPosition]);

  // ============================================
  // Clean GPS Watch
  // ============================================
  const cleanGpsWatch = useCallback(() => {
    console.log('🧹 Cleaning GPS watch...');
    
    if (watchIdRef.current !== null && hasGeolocation) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log('✅ GPS watch cleared:', watchIdRef.current);
      } catch (error) {
        console.warn('Error clearing GPS watch:', error);
      }
      watchIdRef.current = null;
    }
    
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
      console.log('✅ Periodic interval cleared');
    }
    
    if (gpsRestartTimeoutRef.current) {
      clearTimeout(gpsRestartTimeoutRef.current);
      gpsRestartTimeoutRef.current = null;
    }
    
    isGpsStartingRef.current = false;
    setIsUsingRealGps(false);
  }, [hasGeolocation]);

  // ============================================
  // Start Real GPS
  // ============================================
  const startRealGps = useCallback(async () => {
    if (isGpsStartingRef.current) {
      console.log('⏳ GPS already starting, waiting...');
      return;
    }

    if (watchIdRef.current !== null) {
      console.log('⚠️ GPS already active');
      return;
    }

    if (!hasGeolocation) {
      toast({
        title: locale === 'ar' ? '⚠️ تنبيه' : '⚠️ Attention',
        description: locale === 'ar' 
          ? 'متصفحك لا يدعم نظام تحديد المواقع GPS'
          : 'Votre navigateur ne supporte pas le GPS',
        variant: 'destructive',
      });
      return;
    }

    if (!bus?.id) {
      toast({
        title: locale === 'ar' ? '⚠️ تنبيه' : '⚠️ Attention',
        description: locale === 'ar' 
          ? 'لا توجد حافلة مخصصة للتتبع'
          : 'Aucun bus assigné pour le suivi',
        variant: 'destructive',
      });
      return;
    }

    console.log('📍 Starting real GPS tracking for bus:', bus.id);
    isGpsStartingRef.current = true;

    cleanGpsWatch();

    try {
      const { error } = await supabase
        .from('buses')
        .update({
          gps_active: true,
          status: 'active',
          last_updated: new Date().toISOString(),
        })
        .eq('id', bus.id);

      if (error) {
        console.error('❌ Failed to update GPS status:', error);
        toast({
          title: locale === 'ar' ? '❌ خطأ' : '❌ Erreur',
          description: locale === 'ar' 
            ? 'تعذر تحديث حالة GPS في قاعدة البيانات'
            : 'Impossible de mettre à jour le statut GPS',
          variant: 'destructive',
        });
        isGpsStartingRef.current = false;
        return;
      }
      console.log('✅ GPS status updated to active in database');
    } catch (error) {
      console.error('❌ Error updating GPS status:', error);
      isGpsStartingRef.current = false;
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          if (!isMountedRef.current) return;

          const { latitude, longitude, speed, heading } = position.coords;
          const realSpeed = speed || 0;
          const realHeading = heading || 0;
          
          console.log(`📍 GPS position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}, speed: ${realSpeed.toFixed(1)}km/h`);
          
          setIsOnline(true);
          setGpsError(null);
          setGpsRetryCount(0);
          setIsUsingRealGps(true);

          await updateBusLocation(latitude, longitude, realSpeed, realHeading);
        },
        (error) => {
          console.warn('⚠️ GPS watch error:', error.message);
          setIsOnline(false);
          setGpsError(error.message);
          setIsUsingRealGps(false);
          
          setGpsRetryCount(prev => prev + 1);
          
          if (gpsRetryCount >= 3) {
            console.log('🔄 Too many GPS errors, attempting to restart...');
            setGpsRetryCount(0);
            cleanGpsWatch();
            if (gpsRestartTimeoutRef.current) {
              clearTimeout(gpsRestartTimeoutRef.current);
            }
            gpsRestartTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current && gpsActive) {
                console.log('🔄 Restarting GPS after error...');
                startRealGps();
              }
            }, 5000);
          }
        },
        options
      );

      console.log('✅ GPS watch started with ID:', watchIdRef.current);
      isGpsStartingRef.current = false;
      
      saveGpsState(true);
      
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
      }
      
      gpsIntervalRef.current = setInterval(async () => {
        if (!isMountedRef.current || !gpsActive) {
          console.log('⏹️ Interval stopped');
          return;
        }
        
        console.log('🔄 Periodic update...');
        
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              if (!isMountedRef.current) return;
              
              const { latitude, longitude, speed, heading } = position.coords;
              const realSpeed = speed || 0;
              const realHeading = heading || 0;
              
              console.log(`📍 Periodic: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}, speed: ${realSpeed.toFixed(1)}km/h`);
              
              setIsOnline(true);
              setGpsError(null);
              setIsUsingRealGps(true);
              
              await updateBusLocation(latitude, longitude, realSpeed, realHeading);
            },
            (error) => {
              console.warn('⚠️ Periodic GPS error:', error.message);
              setIsOnline(false);
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
          );
        }
      }, 5000);

      toast({
        title: locale === 'ar' ? '✅ بدء التتبع' : '✅ Suivi démarré',
        description: locale === 'ar' 
          ? `تم بدء تتبع الحافلة ${bus.plate} عبر GPS (تحديث كل 5 ثواني)`
          : `Le suivi GPS du bus ${bus.plate} a commencé (mise à jour toutes les 5 secondes)`,
      });

    } catch (error) {
      console.error('❌ Error starting GPS watch:', error);
      isGpsStartingRef.current = false;
      setGpsError('Failed to start GPS');
      
      toast({
        title: locale === 'ar' ? '❌ خطأ' : '❌ Erreur',
        description: locale === 'ar' 
          ? 'تعذر بدء تتبع GPS، يرجى المحاولة مرة أخرى'
          : 'Impossible de démarrer le suivi GPS, veuillez réessayer',
        variant: 'destructive',
      });
    }
  }, [bus, hasGeolocation, updateBusLocation, cleanGpsWatch, saveGpsState, toast, locale, gpsRetryCount, gpsActive]);

  // ============================================
  // Stop GPS - الإصلاح النهائي
  // ============================================
  const stopGps = useCallback(async () => {
    if (isStoppingRef.current) {
      console.log('⏳ GPS already stopping...');
      return;
    }

    if (!gpsActive && watchIdRef.current === null) {
      console.log('ℹ️ GPS already stopped');
      return;
    }

    isStoppingRef.current = true;

    try {
      console.log('🛑 Stopping GPS...');
      
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
        console.log('✅ Periodic interval stopped');
      }
      
      if (watchIdRef.current !== null && hasGeolocation) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
          console.log('✅ GPS watch cleared:', watchIdRef.current);
        } catch (error) {
          console.warn('Error clearing GPS watch:', error);
        }
        watchIdRef.current = null;
      }
      
      setGpsActive(false);
      setIsOnline(false);
      setGpsError(null);
      setGpsRetryCount(0);
      isGpsStartingRef.current = false;
      isRestoringRef.current = false;
      setIsUsingRealGps(false);
      
      clearGpsState();
      
      if (bus?.id) {
        try {
          const { data: currentBus } = await supabase
            .from('buses')
            .select('gps_active')
            .eq('id', bus.id)
            .single();

          if (currentBus?.gps_active === true) {
            const { error } = await supabase
              .from('buses')
              .update({
                gps_active: false,
                status: 'inactive',
                speed: 0,
                heading: 0,
                last_updated: new Date().toISOString(),
              })
              .eq('id', bus.id);

            if (error) {
              console.error('❌ Failed to update GPS status to inactive:', error);
            } else {
              console.log('✅ GPS status updated to inactive in database');
            }
          }
        } catch (error) {
          console.error('❌ Error updating GPS status:', error);
        }
      }
      
      if (driver) {
        await supabase
          .from('drivers')
          .update({ 
            status: 'off_duty',
            updated_at: new Date().toISOString()
          })
          .eq('id', driver.id);
        
        setDriver({ ...driver, status: 'off_duty' });
      }
      
      console.log('✅ GPS stopped definitively');
      
      toast({
        title: locale === 'ar' ? '⏹️ إيقاف التتبع' : '⏹️ Suivi arrêté',
        description: locale === 'ar' 
          ? 'تم إيقاف تتبع موقع الحافلة'
          : 'Le suivi GPS a été arrêté',
      });
    } catch (error) {
      console.error('❌ Error stopping GPS:', error);
    } finally {
      isStoppingRef.current = false;
    }
  }, [hasGeolocation, clearGpsState, toast, locale, driver, bus, gpsActive]);

  // ============================================
  // Toggle GPS
  // ============================================
  const handleToggleGps = useCallback(async () => {
    if (isGpsStartingRef.current || isStoppingRef.current) {
      console.log('⏳ GPS operation in progress, please wait...');
      toast({
        title: locale === 'ar' ? '⏳ جاري المعالجة' : '⏳ En cours...',
        description: locale === 'ar' ? 'يرجى الانتظار حتى اكتمال العملية' : 'Veuillez patienter...',
      });
      return;
    }

    try {
      const isActuallyActive = gpsActive || watchIdRef.current !== null;

      if (isActuallyActive) {
        await stopGps();
      } else {
        setGpsActive(true);
        await startRealGps();
        
        if (driver) {
          await supabase
            .from('drivers')
            .update({ 
              status: 'on_duty',
              updated_at: new Date().toISOString()
            })
            .eq('id', driver.id);
          setDriver({ ...driver, status: 'on_duty' });
        }
      }
    } catch (error) {
      console.error('❌ Error toggling GPS:', error);
      toast({
        title: locale === 'ar' ? '❌ خطأ' : '❌ Erreur',
        description: locale === 'ar' ? 'حدث خطأ أثناء تشغيل GPS' : 'Erreur lors du démarrage du GPS',
        variant: 'destructive',
      });
    }
  }, [gpsActive, startRealGps, stopGps, driver, toast, locale]);

  // ============================================
  // Update Driver Status
  // ============================================
  const updateDriverStatus = useCallback(async (status: string) => {
    if (!driver) return;
    
    try {
      if (status === 'off_duty' && gpsActive) {
        await stopGps();
      }
      
      await supabase
        .from('drivers')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', driver.id);
      
      setDriver({ ...driver, status: status as Driver['status'] });
      
      toast({
        title: locale === 'ar' ? '✅ تم التحديث' : '✅ Mis à jour',
        description: locale === 'ar' 
          ? `تم تغيير الحالة إلى ${t.common[status as keyof typeof t.common] || status}`
          : `Statut changé à ${t.common[status as keyof typeof t.common] || status}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر تحديث الحالة' : 'Impossible de mettre à jour le statut',
        variant: 'destructive',
      });
    }
  }, [driver, toast, locale, t, gpsActive, stopGps]);

  // ============================================
  // Restore GPS Session
  // ============================================
  const restoreGpsSession = useCallback(async () => {
    if (isRestoringRef.current || isGpsStartingRef.current) {
      console.log('⏳ Restoration already in progress');
      return false;
    }

    if (gpsActive || watchIdRef.current !== null) {
      console.log('ℹ️ GPS already active');
      return true;
    }

    const savedState = loadGpsState();
    if (!savedState || !savedState.trackingActive) {
      console.log('ℹ️ No saved GPS session found');
      return false;
    }

    if (savedState.driverId !== driver?.id || savedState.busId !== bus?.id) {
      console.warn('⚠️ Driver or bus mismatch, clearing state');
      clearGpsState();
      return false;
    }

    if (driver?.status !== 'on_duty' && driver?.status !== 'in_service') {
      console.log('ℹ️ Driver is not on duty');
      clearGpsState();
      return false;
    }

    console.log('🔄 Restoring GPS session...');
    isRestoringRef.current = true;

    try {
      setGpsActive(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (isMountedRef.current && !isGpsStartingRef.current && watchIdRef.current === null) {
        await startRealGps();
      }
      
      isRestoringRef.current = false;
      return true;
    } catch (error) {
      console.error('❌ Error restoring GPS:', error);
      isRestoringRef.current = false;
      return false;
    }
  }, [driver, bus, loadGpsState, startRealGps, clearGpsState, gpsActive]);

  // ============================================
  // Load Driver Data
  // ============================================
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        let driverData = null;
        
        if (profile?.driver_id) {
          const { data } = await supabase
            .from('drivers')
            .select('*')
            .eq('id', profile.driver_id)
            .maybeSingle();
          driverData = data;
        } else if (profile?.id) {
          const { data } = await supabase
            .from('drivers')
            .select('*')
            .eq('user_id', profile.id)
            .maybeSingle();
          driverData = data;
        }

        if (driverData) {
          setDriver(driverData as Driver);
          setDataLoaded(true);
          
          if (driverData.bus_id) {
            const { data: busData } = await supabase
              .from('buses')
              .select('*, line:lines(*)')
              .eq('id', driverData.bus_id)
              .maybeSingle();
            
            if (busData) {
              setBus(busData as Bus);
              setGpsActive(busData.gps_active || false);
              
              if (busData.line) {
                setLine(busData.line as BusLine);
              }
              if (busData.current_lat && busData.current_lng) {
                setCurrentLat(busData.current_lat);
                setCurrentLng(busData.current_lng);
                setCurrentSpeed(busData.speed || 0);
                setCurrentHeading(busData.heading || 0);
                setLastUpdated(busData.last_updated || null);
              }
            }
          }

          const { data: msgs } = await supabase
            .from('driver_messages')
            .select('*')
            .eq('driver_id', driverData.id)
            .order('created_at', { ascending: true });
          setMessages((msgs as DriverMessage[]) || []);

          const { data: notifs } = await supabase
            .from('dispatch_notifications')
            .select('*')
            .eq('driver_id', driverData.id)
            .order('created_at', { ascending: false })
            .limit(10);
          setNotifications((notifs as DispatchNotification[]) || []);
        }
        
      } catch (error) {
        console.error('Error loading driver data:', error);
        toast({
          title: locale === 'ar' ? 'خطأ في التحميل' : 'Erreur de chargement',
          description: locale === 'ar' ? 'تعذر تحميل بيانات السائق' : 'Impossible de charger les données du chauffeur',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [profile, locale, toast]);

  // ============================================
  // Restore GPS Session After Data Load - الإصلاح النهائي
  // ============================================
  useEffect(() => {
    let isProcessing = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const handleGpsRestore = async () => {
      if (isProcessing || !driver || !bus || loading || !dataLoaded) {
        return;
      }

      // ✅ منع المحاولات المتكررة بعد النجاح
      if (isInitialRestoreDone.current) {
        console.log('ℹ️ Initial restore already done, skipping...');
        return;
      }

      if (restoreAttemptsRef.current >= MAX_RESTORE_ATTEMPTS) {
        console.log('⚠️ Max restore attempts reached, stopping...');
        return;
      }

      isProcessing = true;

      try {
        const { data: freshBusData, error: freshError } = await supabase
          .from('buses')
          .select('gps_active, status')
          .eq('id', bus.id)
          .single();

        if (freshError) {
          console.error('❌ Error fetching fresh bus data:', freshError);
          return;
        }

        if (freshBusData?.gps_active === true) {
          console.log('🔍 GPS is active in database');
          
          if (gpsActive || watchIdRef.current !== null) {
            console.log('ℹ️ GPS already running, skipping restore');
            isInitialRestoreDone.current = true;
            return;
          }
          
          console.log('🔄 Restoring GPS session...');
          await restoreGpsSession();
          isInitialRestoreDone.current = true;
          restoreAttemptsRef.current = 0;
        } else {
          console.log('ℹ️ GPS is inactive in database');
          
          if (gpsActive || watchIdRef.current !== null) {
            await stopGps();
          }
          
          clearGpsState();
          setGpsActive(false);
          setIsUsingRealGps(false);
          isInitialRestoreDone.current = true;
          restoreAttemptsRef.current = 0;
        }
      } catch (error) {
        console.error('❌ Error in GPS restore:', error);
        restoreAttemptsRef.current++;
      } finally {
        isProcessing = false;
      }
    };

    // ✅ تأخير التنفيذ
    timeoutId = setTimeout(handleGpsRestore, 1500);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      isProcessing = false;
    };
  }, [driver, bus, loading, dataLoaded, gpsActive, restoreGpsSession, stopGps, clearGpsState]);

  // ============================================
  // Cleanup
  // ============================================
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      console.log('🧹 Component unmounting, cleaning GPS resources...');
      
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      
      if (watchIdRef.current !== null) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (error) {
          console.warn('Error clearing GPS watch on unmount:', error);
        }
        watchIdRef.current = null;
      }
    };
  }, []);

  // ============================================
  // Cleanup on logout
  // ============================================
  useEffect(() => {
    const handleLogout = () => {
      console.log('🚪 User logging out...');
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      stopGps();
    };

    window.addEventListener('logout', handleLogout);
    
    return () => {
      window.removeEventListener('logout', handleLogout);
    };
  }, [stopGps]);

  // ============================================
  // Send Message
  // ============================================
  const sendMessage = async () => {
    if (!newMessage.trim() || !driver) return;
    
    try {
      await supabase
        .from('driver_messages')
        .insert({
          driver_id: driver.id,
          sender_role: 'driver',
          sender_id: profile?.id,
          content: newMessage.trim(),
          created_at: new Date().toISOString(),
        });
      
      setMessages([...messages, {
        id: Date.now().toString(),
        driver_id: driver.id,
        sender_role: 'driver',
        content: newMessage.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
      }]);
      setNewMessage('');
      
      toast({
        title: locale === 'ar' ? 'تم الإرسال' : 'Envoyé',
        description: locale === 'ar' ? 'تم إرسال الرسالة' : 'Message envoyé',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر إرسال الرسالة' : 'Impossible d\'envoyer le message',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // Send Report
  // ============================================
  const sendReport = async () => {
    if (!reportDesc.trim() || !driver) return;
    
    try {
      await supabase
        .from('reports')
        .insert({
          type: reportType,
          message: reportDesc.trim(),
          bus_id: bus?.id || null,
          line_id: bus?.line_id || null,
          status: 'open',
          reporter_name: driver.name,
          user_id: profile?.id,
          created_at: new Date().toISOString(),
        });
      
      setReportDesc('');
      setReportSent(true);
      setTimeout(() => setReportSent(false), 4000);
      
      toast({
        title: locale === 'ar' ? '✅ تم الإرسال' : '✅ Envoyé',
        description: locale === 'ar' ? 'تم إرسال البلاغ بنجاح' : 'Signalement envoyé avec succès',
      });
    } catch (error) {
      console.error('Error sending report:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر إرسال البلاغ' : 'Impossible d\'envoyer le signalement',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // Mark Notification Read
  // ============================================
  const markNotificationRead = async (id: string) => {
    try {
      await supabase
        .from('dispatch_notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Error marking notification:', error);
    }
  };

  // ============================================
  // Loading State
  // ============================================
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="h-64 rounded-xl bg-muted" />
            <div className="h-64 rounded-xl bg-muted" />
            <div className="h-64 rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // No Driver
  // ============================================
  if (!driver) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Car className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">
          {locale === 'ar' ? 'لم يتم ربط حسابك بملف سائق' : 'Compte non lié à un chauffeur'}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {locale === 'ar' 
            ? 'يرجى التواصل مع الإدارة لربط حسابك بسائق'
            : 'Veuillez contacter l\'administration pour lier votre compte à un chauffeur'}
        </p>
        <Button 
          className="mt-4"
          onClick={() => window.location.href = '/'}
        >
          {locale === 'ar' ? 'العودة للرئيسية' : 'Retour à l\'accueil'}
        </Button>
      </div>
    );
  }

  // ============================================
  // Status Options
  // ============================================
  const statusOptions = [
    { value: 'on_duty', label: t.driver.online, color: 'bg-success', icon: CheckCircle },
    { value: 'in_service', label: t.driver.inService, color: 'bg-primary', icon: Activity },
    { value: 'break', label: t.driver.break, color: 'bg-warning', icon: Clock },
    { value: 'off_duty', label: t.driver.offline, color: 'bg-muted-foreground', icon: XCircle },
  ];

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t.driver.title}</h1>
            <p className="mt-1 text-muted-foreground">{t.driver.subtitle}</p>
          </div>
          <div className="mt-2 md:mt-0 flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <span>{locale === 'ar' ? 'تسجيل الخروج' : 'Déconnexion'}</span>
            </Button>
            
            {bus && (
              <Badge variant="outline" className="gap-1">
                <BusIcon className="h-3 w-3" />
                {bus.plate}
              </Badge>
            )}
            {line && (
              <Badge variant="outline" className="gap-1" style={{ borderColor: line.color }}>
                <RouteIcon className="h-3 w-3" style={{ color: line.color }} />
                {line.number}
              </Badge>
            )}
            <Badge variant="default" className="gap-1">
              <User className="h-3 w-3" />
              {driver.name}
            </Badge>
            <Badge variant={driver.status === 'on_duty' ? 'default' : 'secondary'} className="gap-1">
              <Shield className="h-3 w-3" />
              {t.common[driver.status as keyof typeof t.common] || driver.status}
            </Badge>
            <Badge variant={isOnline ? 'default' : 'destructive'} className="gap-1">
              {isOnline ? (
                <>
                  <Zap className="h-3 w-3" />
                  {locale === 'ar' ? 'متصل' : 'Connecté'}
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  {locale === 'ar' ? 'غير متصل' : 'Déconnecté'}
                </>
              )}
            </Badge>
            <Badge variant={bus?.gps_active ? 'default' : 'secondary'} className="gap-1">
              {bus?.gps_active ? (
                <>
                  <Activity className="h-3 w-3 animate-pulse" />
                  {locale === 'ar' ? '📡 GPS نشط' : '📡 GPS actif'}
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  {locale === 'ar' ? '📡 GPS غير نشط' : '📡 GPS inactif'}
                </>
              )}
            </Badge>
            {isUsingRealGps && (
              <Badge variant="default" className="bg-green-500">
                📡 حقيقي
              </Badge>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: Status + GPS + Bus */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold">{t.driver.status}</h3>
            <div className="space-y-2">
              {statusOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateDriverStatus(opt.value)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-sm transition-all ${
                      driver.status === opt.value
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${opt.color}`} />
                      {opt.label}
                    </span>
                    {driver.status === opt.value ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* GPS Tracking */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {gpsActive ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Activity className="h-5 w-5 text-success animate-pulse" />
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-success animate-ping" />
                    </div>
                    <span className="text-sm font-medium text-success">
                      {isOnline ? '🟢 GPS حقيقي' : '🟡 GPS غير متصل'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {locale === 'ar' ? '🔴 غير متصل' : '🔴 Déconnecté'}
                    </span>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant={gpsActive ? 'destructive' : 'default'}
                onClick={handleToggleGps}
                className="gap-2"
                disabled={!bus}
              >
                {gpsActive ? (
                  <>
                    <WifiOff className="h-4 w-4" />
                    {locale === 'ar' ? 'إيقاف التتبع' : 'Arrêter le suivi'}
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    {locale === 'ar' ? 'بدء التتبع' : 'Démarrer le suivi'}
                  </>
                )}
              </Button>
            </div>
            {gpsError && (
              <div className="mt-2 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {locale === 'ar' ? 'خطأ في GPS:' : 'Erreur GPS:'} {gpsError}
              </div>
            )}
            {gpsActive && (
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded">
                    <Gauge className="h-3 w-3" /> 
                    {currentSpeed.toFixed(0)} {t.map.kmh}
                    {isUsingRealGps && (
                      <span className="text-[8px] text-green-500 ml-1">📡 حقيقي</span>
                    )}
                    {!isUsingRealGps && gpsActive && (
                      <span className="text-[8px] text-orange-500 ml-1">⚠️ محاكاة</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded">
                    <Navigation className="h-3 w-3" /> 
                    {currentHeading}°
                  </span>
                  <span className="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded">
                    <MapPin className="h-3 w-3" />
                    {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
                  </span>
                </div>
                {lastUpdated && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <Clock className="h-3 w-3" />
                    {locale === 'ar' ? 'آخر تحديث:' : 'Dernière mise à jour:'}
                    {new Date(lastUpdated).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                  </div>
                )}
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-success' : 'bg-destructive'}`} />
                  {isOnline 
                    ? (locale === 'ar' ? '✅ الاتصال مستقر' : '✅ Connexion stable')
                    : (locale === 'ar' ? '⚠️ ضعف في الاتصال' : '⚠️ Connexion faible')
                  }
                </div>
                {isUsingRealGps && (
                  <div className="flex items-center gap-1 text-[10px] text-green-500">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {locale === 'ar' ? '📡 GPS حقيقي (تحديث كل 5 ثواني)' : '📡 GPS réel (mise à jour toutes les 5 secondes)'}
                  </div>
                )}
              </div>
            )}
          </Card>

          {!bus && (
            <Card className="p-5 border-destructive/50 bg-destructive/5">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />
                <div>
                  <h4 className="font-semibold text-destructive">
                    {locale === 'ar' ? '⚠️ لا توجد حافلة مخصصة' : '⚠️ Aucun bus assigné'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {locale === 'ar' 
                      ? 'يرجى التواصل مع الإدارة لربطك بحافلة.'
                      : 'Veuillez contacter l\'administration pour vous assigner un bus.'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {bus && (
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BusIcon className="h-4 w-4 text-primary" />
                {t.driver.assignedBus}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.map.plate}:</span>
                  <span className="font-medium">{bus.plate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'الموديل' : 'Modèle'}:</span>
                  <span>{bus.model || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'السعة' : 'Capacité'}:</span>
                  <span>{bus.capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'الحالة' : 'Statut'}:</span>
                  <Badge variant={bus.status === 'active' ? 'default' : 'secondary'}>
                    {t.common[bus.status as keyof typeof t.common] || bus.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'حالة GPS' : 'Statut GPS'}:</span>
                  <Badge variant={bus.gps_active ? 'default' : 'secondary'}>
                    {bus.gps_active ? '✅ نشط' : '❌ غير نشط'}
                  </Badge>
                </div>
                {line && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: line.color }} />
                    <span className="font-medium">{locale === 'ar' ? line.name_ar : line.name_fr}</span>
                    <span className="text-muted-foreground text-xs">({line.number})</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* MIDDLE COLUMN: Notifications + Report */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4 text-primary" />
                {t.driver.notifications}
              </h3>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  {notifications.filter(n => !n.is_read).length} {locale === 'ar' ? 'جديد' : 'nouveau'}
                </Badge>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                {t.driver.noNotifications}
              </div>
            ) : (
              <div className="max-h-[300px] space-y-2 overflow-y-auto scrollbar-thin">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-lg border p-3 text-sm transition-all ${
                      n.is_read 
                        ? 'border-border/50 opacity-60' 
                        : 'border-primary/30 bg-primary/5 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium">
                          {locale === 'ar' ? n.title_ar : n.title_fr}
                          {!n.is_read && (
                            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {locale === 'ar' ? n.body_ar : n.body_fr}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground/70">
                          {new Date(n.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                          {' '}
                          {new Date(n.created_at).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {!n.is_read && (
                        <button 
                          onClick={() => markNotificationRead(n.id)} 
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          {t.driver.markRead}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {t.driver.reportIssue}
            </h3>
            {reportSent && (
              <div className="mb-3 rounded-lg bg-success/10 p-2 text-sm text-success flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {t.driver.reportSent}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t.driver.issueType}</Label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="breakdown">🔧 {t.common.breakdown}</option>
                  <option value="delay">⏰ {t.common.delay}</option>
                  <option value="service_note">📝 {t.common.serviceNote}</option>
                  <option value="other">📌 {t.common.other}</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">{t.driver.issueDesc}</Label>
                <Textarea
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  rows={3}
                  className="mt-1 text-sm"
                  placeholder={t.driver.issueDesc}
                />
              </div>
              <Button onClick={sendReport} size="sm" className="w-full gap-2">
                <AlertCircle className="h-4 w-4" />
                {t.driver.sendReport}
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Messages */}
        <div>
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-primary" />
                {t.driver.messages}
              </h3>
              {messages.filter(m => !m.is_read).length > 0 && (
                <Badge variant="secondary">
                  {messages.filter(m => !m.is_read).length} {locale === 'ar' ? 'غير مقروء' : 'non lu'}
                </Badge>
              )}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px] scrollbar-thin">
              {messages.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                  {t.driver.noMessages}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-2.5 text-sm ${
                      msg.sender_role === 'driver'
                        ? 'ml-4 rounded-br-sm bg-primary text-primary-foreground'
                        : 'mr-4 rounded-bl-sm bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs opacity-70">
                        {msg.sender_role === 'driver' 
                          ? (locale === 'ar' ? '👤 أنت' : '👤 Vous') 
                          : (locale === 'ar' ? '🛡️ الإدارة' : '🛡️ Admin')
                        }
                      </p>
                      <span className="text-[10px] opacity-50">
                        {new Date(msg.created_at).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="break-words">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={2}
                className="text-sm resize-none"
                placeholder={t.driver.typeMessage}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button onClick={sendMessage} size="icon" className="h-9 w-9 shrink-0 self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground/50 text-center">
              {locale === 'ar' 
                ? 'اضغط Enter للإرسال، Shift+Enter للسطر الجديد'
                : 'Appuyez sur Enter pour envoyer, Shift+Enter pour nouvelle ligne'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default withAuth(DriverPage, ['driver', 'admin', 'super_admin']);