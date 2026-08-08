// app/admin/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Bus, Route, MapPin, AlertCircle, Activity, Users, 
  Send, Bell, Shield, Plus, Edit, Trash2, 
  Search, RefreshCw, UserPlus, QrCode,
  Calendar, Clock, Newspaper, Eye, EyeOff,
  MessageSquare, CheckCircle, X, User, Phone, Mail,
  BarChart3
} from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { QRCodeManager } from '@/components/admin/qr-code-manager';
import StatisticsDashboard from '../../components/StatisticsDashboard';
import type { Bus as BusType, Driver, Report, ActivityLog, BusLine, Station } from '@/lib/types';

// ============================================
// INTERFACES
// ============================================
interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'customer' | 'driver' | 'admin';
  created_at: string;
}

interface Announcement {
  id: string;
  title_ar: string;
  title_fr: string;
  body_ar: string;
  body_fr: string;
  type: 'info' | 'alert' | 'news';
  is_published: boolean;
  published_at: string;
  created_at: string;
}

interface DriverMessage {
  id: string;
  driver_id: string;
  sender_role: 'driver' | 'admin';
  sender_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  driver?: {
    name: string;
    phone: string;
  };
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================
export default function AdminPage() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  
  // ===== STATE =====
  const [buses, setBuses] = useState<BusType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [lines, setLines] = useState<BusLine[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [driverMessages, setDriverMessages] = useState<DriverMessage[]>([]);
  const [stats, setStats] = useState({ 
    activeBuses: 0, totalBuses: 0, totalLines: 0, 
    totalStations: 0, openReports: 0, totalDrivers: 0, 
    onDutyDrivers: 0, totalUsers: 0 
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Message reply state
  const [messageReply, setMessageReply] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Bus form state
  const [busFormOpen, setBusFormOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<BusType | null>(null);
  const [busForm, setBusForm] = useState({
    plate: '',
    model: '',
    capacity: 50,
    status: 'active',
    line_id: '',
  });

  // Driver form state
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverForm, setDriverForm] = useState({
    name: '',
    email: '',
    password: '',
    license_number: '',
    phone: '',
    status: 'off_duty',
  });

  // User form state
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'customer' as const,
    password: '',
  });

  // Announcement form state
  const [announcementFormOpen, setAnnouncementFormOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title_ar: '',
    title_fr: '',
    body_ar: '',
    body_fr: '',
    type: 'info' as 'info' | 'alert' | 'news',
    is_published: true,
  });

  // Assign Driver Dialog
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState(false);
  const [selectedBusForDriver, setSelectedBusForDriver] = useState<BusType | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'bus' | 'driver' | 'user' | 'announcement' | 'message'; name: string } | null>(null);

  // Notification state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');

  // ============================================
  // FONCTION POUR ENREGISTRER LES LOGS D'ACTIVITÉ
  // ============================================
  const logActivity = useCallback(async (
    action: string,
    actor: string,
    target?: string,
    detail?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('activity_logs')
        .insert({
          action,
          actor: actor || user?.email || 'admin',
          target: target || null,
          detail: detail || null,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }, []);

  // ============================================
  // RÉCUPÉRATION DES DONNÉES
  // ============================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        busesRes,
        driversRes,
        reportsRes,
        logsRes,
        linesRes,
        usersRes,
        stationsRes,
        announcementsRes,
      ] = await Promise.all([
        supabase.from('buses').select('*, line:lines(*)').order('plate'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('lines').select('*').order('number'),
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('stations').select('*', { count: 'exact' }).eq('status', 'active'),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      ]);

      const busesData = (busesRes.data as unknown as BusType[]) || [];
      const driversData = (driversRes.data as unknown as Driver[]) || [];
      const reportsData = (reportsRes.data as unknown as Report[]) || [];
      const usersData = (usersRes.data as unknown as UserProfile[]) || [];
      const stationsData = (stationsRes.data as unknown as Station[]) || [];
      const announcementsData = (announcementsRes.data as unknown as Announcement[]) || [];

      setBuses(busesData);
      setDrivers(driversData);
      setReports(reportsData);
      setActivityLogs((logsRes.data as unknown as ActivityLog[]) || []);
      setLines((linesRes.data as unknown as BusLine[]) || []);
      setAnnouncements(announcementsData);

      // Récupérer les messages
      const { data: msgs } = await supabase
        .from('driver_messages')
        .select('*, driver:drivers(name, phone)')
        .order('created_at', { ascending: false })
        .limit(100);
      setDriverMessages((msgs as unknown as DriverMessage[]) || []);

      // Statistiques
      setStats({
        activeBuses: busesData.filter((b) => b.status === 'active').length,
        totalBuses: busesData.length,
        totalLines: linesRes.data?.length || 0,
        totalStations: stationsData.length,
        openReports: reportsData.filter((r) => r.status === 'open').length,
        totalDrivers: driversData.length,
        onDutyDrivers: driversData.filter((d) => d.status === 'on_duty' || d.status === 'in_service').length,
        totalUsers: usersData.length,
      });

      setUsers(usersData);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: locale === 'ar' ? 'خطأ في التحميل' : 'Erreur de chargement',
        description: locale === 'ar' ? 'تعذر تحميل البيانات' : 'Impossible de charger les données',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [locale, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // VÉRIFICATION D'AUTHENTIFICATION
  // ============================================
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: locale === 'ar' ? 'جلسة منتهية' : 'Session expirée',
        description: locale === 'ar' ? 'يرجى تسجيل الدخول مرة أخرى' : 'Veuillez vous reconnecter',
        variant: 'destructive',
      });
      router.push('/login');
      return false;
    }
    return true;
  };

  // ============================================
  // GESTION DES BUS (CRUD)
  // ============================================
  const handleBusSubmit = async () => {
    if (!busForm.plate) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء إدخال رقم اللوحة' : 'Veuillez entrer le numéro de plaque',
        variant: 'destructive',
      });
      return;
    }

    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const data = {
        plate: busForm.plate,
        model: busForm.model || null,
        capacity: Number(busForm.capacity),
        status: busForm.status,
        line_id: busForm.line_id || null,
      };

      const { data: { user } } = await supabase.auth.getUser();

      if (editingBus) {
        const { error } = await supabase
          .from('buses')
          .update(data)
          .eq('id', editingBus.id);
        if (error) throw error;
        
        await logActivity(
          'تعديل حافلة',
          user?.email || 'admin',
          busForm.plate,
          `تعديل بيانات الحافلة ${busForm.plate}`
        );

        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Mis à jour',
          description: `${busForm.plate} ${locale === 'ar' ? 'تم تحديثه بنجاح' : 'a été mis à jour'}`,
        });
      } else {
        const { error } = await supabase
          .from('buses')
          .insert(data);
        if (error) throw error;
        
        await logActivity(
          'إضافة حافلة',
          user?.email || 'admin',
          busForm.plate,
          `إضافة حافلة جديدة ${busForm.plate}`
        );

        toast({
          title: locale === 'ar' ? 'تمت الإضافة' : 'Ajouté',
          description: `${busForm.plate} ${locale === 'ar' ? 'تمت إضافته بنجاح' : 'a été ajouté'}`,
        });
      }

      setBusFormOpen(false);
      resetBusForm();
      fetchData();
    } catch (error) {
      console.error('Error saving bus:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حفظ الحافلة' : 'Impossible de sauvegarder le bus',
        variant: 'destructive',
      });
    }
  };

  const resetBusForm = () => {
    setEditingBus(null);
    setBusForm({ plate: '', model: '', capacity: 50, status: 'active', line_id: '' });
  };

  const editBus = (bus: BusType) => {
    setEditingBus(bus);
    setBusForm({
      plate: bus.plate,
      model: bus.model || '',
      capacity: bus.capacity,
      status: bus.status,
      line_id: bus.line_id || '',
    });
    setBusFormOpen(true);
  };

  const deleteBus = async () => {
    if (!deleteTarget) return;
    
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('buses')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      
      await logActivity(
        'حذف حافلة',
        user?.email || 'admin',
        deleteTarget.name,
        `حذف الحافلة ${deleteTarget.name}`
      );

      toast({
        title: locale === 'ar' ? 'تم الحذف' : 'Supprimé',
        description: `${deleteTarget.name} ${locale === 'ar' ? 'تم حذفه بنجاح' : 'a été supprimé'}`,
      });
      
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting bus:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حذف الحافلة' : 'Impossible de supprimer le bus',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // GESTION DES DRIVERS (CRUD)
  // ============================================
  const handleDriverSubmit = async () => {
    const isAuth = await checkAuth();
    if (!isAuth) return;

    const isValidEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    if (!driverForm.name || driverForm.name.trim().length < 2) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الاسم يجب أن يحتوي على حرفين على الأقل' : 'Le nom doit contenir au moins 2 caractères',
        variant: 'destructive',
      });
      return;
    }

    if (!editingDriver && !driverForm.email) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء إدخال البريد الإلكتروني' : 'Veuillez entrer l\'email',
        variant: 'destructive',
      });
      return;
    }

    if (!editingDriver && driverForm.email && !isValidEmail(driverForm.email)) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'البريد الإلكتروني غير صحيح' : 'Email invalide',
        variant: 'destructive',
      });
      return;
    }

    if (!editingDriver && (!driverForm.password || driverForm.password.length < 6)) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Le mot de passe doit contenir au moins 6 caractères',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingDriver) {
        const { error } = await supabase
          .from('drivers')
          .update({
            name: driverForm.name.trim(),
            license_number: driverForm.license_number?.trim() || null,
            phone: driverForm.phone?.trim() || null,
            status: driverForm.status || 'off_duty',
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDriver.id);
        
        if (error) throw error;

        await supabase
          .from('user_profiles')
          .update({
            full_name: driverForm.name.trim(),
            phone: driverForm.phone?.trim() || null,
            role: 'driver',
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDriver.user_id);

        await logActivity(
          'تعديل سائق',
          user?.email || 'admin',
          driverForm.name,
          `تعديل بيانات السائق ${driverForm.name}`
        );

        toast({
          title: locale === 'ar' ? '✅ تم التحديث' : '✅ Mis à jour',
          description: `${driverForm.name} ${locale === 'ar' ? 'تم تحديثه بنجاح' : 'a été mis à jour'}`,
        });
        
      } else {
        const response = await fetch('/api/admin/drivers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: driverForm.name.trim(),
            email: driverForm.email.trim(),
            password: driverForm.password,
            license_number: driverForm.license_number?.trim() || null,
            phone: driverForm.phone?.trim() || null,
            status: driverForm.status || 'off_duty',
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'حدث خطأ أثناء إضافة السائق');
        }

        await logActivity(
          'إضافة سائق',
          user?.email || 'admin',
          driverForm.name,
          `إضافة سائق جديد ${driverForm.name}`
        );

        toast({
          title: locale === 'ar' ? '✅ تمت الإضافة' : '✅ Ajouté',
          description: `${driverForm.name} ${locale === 'ar' ? 'تمت إضافته بنجاح كسائق' : 'a été ajouté comme chauffeur'}`,
        });
      }

      setDriverFormOpen(false);
      resetDriverForm();
      await fetchData();

    } catch (error: any) {
      console.error('Error in handleDriverSubmit:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: error?.message || (locale === 'ar' ? 'تعذر حفظ السائق' : 'Impossible de sauvegarder le chauffeur'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDriverForm = () => {
    setEditingDriver(null);
    setDriverForm({
      name: '',
      email: '',
      password: '',
      license_number: '',
      phone: '',
      status: 'off_duty',
    });
  };

  const editDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverForm({
      name: driver.name,
      email: '',
      password: '',
      license_number: driver.license_number || '',
      phone: driver.phone || '',
      status: driver.status,
    });
    setDriverFormOpen(true);
  };

  const deleteDriver = async () => {
    if (!deleteTarget) return;
    
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      
      await logActivity(
        'حذف سائق',
        user?.email || 'admin',
        deleteTarget.name,
        `حذف السائق ${deleteTarget.name}`
      );

      toast({
        title: locale === 'ar' ? 'تم الحذف' : 'Supprimé',
        description: `${deleteTarget.name} ${locale === 'ar' ? 'تم حذفه بنجاح' : 'a été supprimé'}`,
      });
      
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting driver:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حذف السائق' : 'Impossible de supprimer le chauffeur',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // ASSIGNER UN DRIVER À UN BUS
  // ============================================
  const availableDrivers = drivers.filter(d => !d.bus_id);

  const openAssignDriverDialog = (bus: BusType) => {
    setSelectedBusForDriver(bus);
    setSelectedDriverId('');
    setAssignDriverDialogOpen(true);
  };

  const assignDriverToBus = async () => {
    if (!selectedBusForDriver || !selectedDriverId) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء اختيار سائق' : 'Veuillez sélectionner un chauffeur',
        variant: 'destructive',
      });
      return;
    }

    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const driver = drivers.find(d => d.id === selectedDriverId);
      
      const { error: busError } = await supabase
        .from('buses')
        .update({ driver_id: selectedDriverId })
        .eq('id', selectedBusForDriver.id);

      if (busError) throw busError;

      const { error: driverError } = await supabase
        .from('drivers')
        .update({ bus_id: selectedBusForDriver.id })
        .eq('id', selectedDriverId);

      if (driverError) throw driverError;

      await logActivity(
        'تعيين سائق لحافلة',
        user?.email || 'admin',
        `${driver?.name || 'سائق'} → ${selectedBusForDriver.plate}`,
        `تعيين السائق ${driver?.name || ''} للحافلة ${selectedBusForDriver.plate}`
      );

      toast({
        title: locale === 'ar' ? '✅ تم الربط' : '✅ Assigné',
        description: `${locale === 'ar' ? 'تم ربط السائق بالحافلة' : 'Chauffeur assigné au bus'}`,
      });

      setAssignDriverDialogOpen(false);
      setSelectedBusForDriver(null);
      setSelectedDriverId('');
      fetchData();
    } catch (error) {
      console.error('Error assigning driver:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر ربط السائق' : 'Impossible d\'assigner le chauffeur',
        variant: 'destructive',
      });
    }
  };

  const unassignDriverFromBus = async (busId: string) => {
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const bus = buses.find(b => b.id === busId);
      if (!bus?.driver_id) return;

      const { data: { user } } = await supabase.auth.getUser();
      const driver = drivers.find(d => d.id === bus.driver_id);

      const { error: busError } = await supabase
        .from('buses')
        .update({ driver_id: null })
        .eq('id', busId);

      if (busError) throw busError;

      const { error: driverError } = await supabase
        .from('drivers')
        .update({ bus_id: null })
        .eq('id', bus.driver_id);

      if (driverError) throw driverError;

      await logActivity(
        'فصل سائق عن حافلة',
        user?.email || 'admin',
        `${driver?.name || 'سائق'} → ${bus.plate}`,
        `فصل السائق ${driver?.name || ''} عن الحافلة ${bus.plate}`
      );

      toast({
        title: locale === 'ar' ? '✅ تم الفصل' : '✅ Détaché',
        description: `${locale === 'ar' ? 'تم فصل السائق عن الحافلة' : 'Chauffeur détaché du bus'}`,
      });

      fetchData();
    } catch (error) {
      console.error('Error unassigning driver:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر فصل السائق' : 'Impossible de détacher le chauffeur',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // GESTION DES MESSAGES
  // ============================================
  const sendReplyToDriver = async (driverId: string, messageId: string) => {
    if (!messageReply.trim()) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء كتابة رد' : 'Veuillez écrire une réponse',
        variant: 'destructive',
      });
      return;
    }

    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: locale === 'ar' ? 'خطأ' : 'Erreur',
          description: locale === 'ar' ? 'يرجى تسجيل الدخول' : 'Veuillez vous connecter',
          variant: 'destructive',
        });
        return;
      }

      const { error: insertError } = await supabase
        .from('driver_messages')
        .insert({
          driver_id: driverId,
          sender_role: 'admin',
          sender_id: user.id,
          content: messageReply.trim(),
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      await supabase
        .from('driver_messages')
        .update({ is_read: true })
        .eq('id', messageId);

      await logActivity(
        'رد على رسالة سائق',
        user.email || 'admin',
        `Message #${messageId.slice(0, 8)}`,
        `رد على رسالة السائق: ${messageReply.trim().slice(0, 50)}...`
      );

      toast({
        title: locale === 'ar' ? '✅ تم الإرسال' : '✅ Envoyé',
        description: locale === 'ar' ? 'تم إرسال الرد للسائق' : 'Réponse envoyée au chauffeur',
      });

      setMessageReply('');
      setReplyingTo(null);
      fetchData();
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: error?.message || (locale === 'ar' ? 'تعذر إرسال الرد' : 'Impossible d\'envoyer la réponse'),
        variant: 'destructive',
      });
    }
  };

  const markMessageRead = async (messageId: string) => {
    try {
      await supabase
        .from('driver_messages')
        .update({ is_read: true })
        .eq('id', messageId);

      setDriverMessages(driverMessages.map(msg => 
        msg.id === messageId ? { ...msg, is_read: true } : msg
      ));
    } catch (error) {
      console.error('Error marking message read:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('driver_messages')
        .delete()
        .eq('id', messageId);

      await logActivity(
        'حذف رسالة سائق',
        user?.email || 'admin',
        `Message #${messageId.slice(0, 8)}`,
        'حذف رسالة من نظام المراسلة'
      );

      setDriverMessages(driverMessages.filter(msg => msg.id !== messageId));
      
      toast({
        title: locale === 'ar' ? 'تم الحذف' : 'Supprimé',
        description: locale === 'ar' ? 'تم حذف الرسالة' : 'Message supprimé',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حذف الرسالة' : 'Impossible de supprimer le message',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // GESTION DES UTILISATEURS (CRUD)
  // ============================================
  const handleUserSubmit = async () => {
    if (!userForm.email || !userForm.full_name) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء ملء جميع الحقول المطلوبة' : 'Veuillez remplir tous les champs requis',
        variant: 'destructive',
      });
      return;
    }

    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingUser) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: userForm.full_name,
            phone: userForm.phone || null,
            role: userForm.role,
          })
          .eq('id', editingUser.id);
        if (error) throw error;
        
        await logActivity(
          'تعديل مستخدم',
          user?.email || 'admin',
          userForm.full_name,
          `تعديل بيانات المستخدم ${userForm.full_name}`
        );

        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Mis à jour',
          description: `${userForm.full_name} ${locale === 'ar' ? 'تم تحديثه بنجاح' : 'a été mis à jour'}`,
        });
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userForm.email,
          password: userForm.password || 'default123',
          options: {
            data: {
              full_name: userForm.full_name,
              phone: userForm.phone,
              role: userForm.role,
            },
          },
        });
        if (authError) throw authError;
        
        if (authData.user) {
          await supabase
            .from('user_profiles')
            .insert({
              id: authData.user.id,
              email: userForm.email,
              full_name: userForm.full_name,
              phone: userForm.phone || null,
              role: userForm.role,
            });
        }

        await logActivity(
          'إضافة مستخدم',
          user?.email || 'admin',
          userForm.full_name,
          `إضافة مستخدم جديد ${userForm.full_name} (${userForm.role})`
        );
        
        toast({
          title: locale === 'ar' ? 'تمت الإضافة' : 'Ajouté',
          description: `${userForm.full_name} ${locale === 'ar' ? 'تمت إضافته بنجاح' : 'a été ajouté'}`,
        });
      }

      setUserFormOpen(false);
      resetUserForm();
      fetchData();
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حفظ المستخدم' : 'Impossible de sauvegarder l\'utilisateur',
        variant: 'destructive',
      });
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({ email: '', full_name: '', phone: '', role: 'customer', password: '' });
  };

  const editUser = (user: UserProfile) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
      password: '',
    });
    setUserFormOpen(true);
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      
      await logActivity(
        'حذف مستخدم',
        user?.email || 'admin',
        deleteTarget.name,
        `حذف المستخدم ${deleteTarget.name}`
      );

      toast({
        title: locale === 'ar' ? 'تم الحذف' : 'Supprimé',
        description: `${deleteTarget.name} ${locale === 'ar' ? 'تم حذفه بنجاح' : 'a été supprimé'}`,
      });
      
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حذف المستخدم' : 'Impossible de supprimer l\'utilisateur',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // GESTION DES ANNONCES (CRUD)
  // ============================================
  const handleAnnouncementSubmit = async () => {
    if (!announcementForm.title_ar || !announcementForm.title_fr || 
        !announcementForm.body_ar || !announcementForm.body_fr) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء ملء جميع الحقول' : 'Veuillez remplir tous les champs',
        variant: 'destructive',
      });
      return;
    }

    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const data = {
        title_ar: announcementForm.title_ar,
        title_fr: announcementForm.title_fr,
        body_ar: announcementForm.body_ar,
        body_fr: announcementForm.body_fr,
        type: announcementForm.type,
        is_published: announcementForm.is_published,
        published_at: announcementForm.is_published ? new Date().toISOString() : null,
      };

      if (editingAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(data)
          .eq('id', editingAnnouncement.id);
        if (error) throw error;
        
        await logActivity(
          'تعديل إعلان',
          user?.email || 'admin',
          announcementForm.title_ar,
          `تعديل الإعلان: ${announcementForm.title_ar}`
        );

        toast({
          title: locale === 'ar' ? 'تم التحديث' : 'Mis à jour',
          description: locale === 'ar' ? 'تم تحديث الإعلان بنجاح' : 'Annonce mise à jour',
        });
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert(data);
        if (error) throw error;
        
        await logActivity(
          'إضافة إعلان',
          user?.email || 'admin',
          announcementForm.title_ar,
          `إضافة إعلان جديد: ${announcementForm.title_ar}`
        );

        toast({
          title: locale === 'ar' ? 'تمت الإضافة' : 'Ajouté',
          description: locale === 'ar' ? 'تم إضافة الإعلان بنجاح' : 'Annonce ajoutée',
        });
      }

      setAnnouncementFormOpen(false);
      resetAnnouncementForm();
      fetchData();
    } catch (error) {
      console.error('Error saving announcement:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حفظ الإعلان' : 'Impossible de sauvegarder l\'annonce',
        variant: 'destructive',
      });
    }
  };

  const resetAnnouncementForm = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({
      title_ar: '',
      title_fr: '',
      body_ar: '',
      body_fr: '',
      type: 'info',
      is_published: true,
    });
  };

  const editAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      title_ar: announcement.title_ar,
      title_fr: announcement.title_fr,
      body_ar: announcement.body_ar,
      body_fr: announcement.body_fr,
      type: announcement.type,
      is_published: announcement.is_published,
    });
    setAnnouncementFormOpen(true);
  };

  const deleteAnnouncement = async () => {
    if (!deleteTarget) return;
    
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      
      await logActivity(
        'حذف إعلان',
        user?.email || 'admin',
        deleteTarget.name,
        `حذف الإعلان: ${deleteTarget.name}`
      );

      toast({
        title: locale === 'ar' ? 'تم الحذف' : 'Supprimé',
        description: `${deleteTarget.name} ${locale === 'ar' ? 'تم حذفه بنجاح' : 'a été supprimé'}`,
      });
      
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حذف الإعلان' : 'Impossible de supprimer l\'annonce',
        variant: 'destructive',
      });
    }
  };

  const toggleAnnouncementStatus = async (announcement: Announcement) => {
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newStatus = !announcement.is_published;
      
      const { error } = await supabase
        .from('announcements')
        .update({ 
          is_published: newStatus,
          published_at: newStatus ? new Date().toISOString() : null
        })
        .eq('id', announcement.id);
      if (error) throw error;
      
      await logActivity(
        newStatus ? 'نشر إعلان' : 'إلغاء نشر إعلان',
        user?.email || 'admin',
        announcement.title_ar,
        newStatus ? `نشر الإعلان: ${announcement.title_ar}` : `إلغاء نشر الإعلان: ${announcement.title_ar}`
      );

      toast({
        title: locale === 'ar' ? 'تم التحديث' : 'Mis à jour',
        description: newStatus 
          ? (locale === 'ar' ? 'تم نشر الإعلان' : 'Annonce publiée')
          : (locale === 'ar' ? 'تم إلغاء نشر الإعلان' : 'Annonce dépubliée'),
      });
      
      fetchData();
    } catch (error) {
      console.error('Error toggling announcement:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر تحديث حالة الإعلان' : 'Impossible de mettre à jour le statut',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // ENVOI DE NOTIFICATIONS
  // ============================================
  const sendNotification = async () => {
    if (!notifTitle.trim()) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء إدخال عنوان الإشعار' : 'Veuillez entrer un titre',
        variant: 'destructive',
      });
      return;
    }

    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const driversList = drivers.filter((d) => d.status === 'on_duty' || d.status === 'in_service');
      
      if (driversList.length === 0) {
        toast({
          title: locale === 'ar' ? 'تنبيه' : 'Avertissement',
          description: locale === 'ar' ? 'لا يوجد سائقين نشطين للإرسال' : 'Aucun chauffeur actif disponible',
          variant: 'default',
        });
        return;
      }

      const notifications = driversList.map((d) => ({
        driver_id: d.id,
        type: 'info',
        title_ar: notifTitle,
        title_fr: notifTitle,
        body_ar: notifBody || '',
        body_fr: notifBody || '',
      }));

      await supabase
        .from('dispatch_notifications')
        .insert(notifications);

      await logActivity(
        'إرسال إشعار للسائقين',
        user?.email || 'admin',
        `${driversList.length} سائق`,
        `إرسال إشعار "${notifTitle}" إلى ${driversList.length} سائق نشط`
      );

      toast({
        title: locale === 'ar' ? 'تم الإرسال' : 'Envoyé',
        description: `${driversList.length} ${locale === 'ar' ? 'سائق تم إعلامهم' : 'chauffeurs ont été notifiés'}`,
      });

      setNotifTitle('');
      setNotifBody('');
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر إرسال الإشعارات' : 'Impossible d\'envoyer les notifications',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // GESTION DES RAPPORTS
  // ============================================
  const updateReportStatus = async (id: string, status: string) => {
    const isAuth = await checkAuth();
    if (!isAuth) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const report = reports.find(r => r.id === id);
      
      await supabase
        .from('reports')
        .update({ status })
        .eq('id', id);
      
      setReports(reports.map((r) => r.id === id ? { ...r, status: status as Report['status'] } : r));

      await logActivity(
        'تحديث حالة بلاغ',
        user?.email || 'admin',
        `Report #${id.slice(0, 8)}`,
        `تغيير حالة البلاغ من ${report?.status} إلى ${status}`
      );

      toast({
        title: locale === 'ar' ? 'تم التحديث' : 'Mis à jour',
        description: locale === 'ar' ? 'تم تحديث حالة البلاغ' : 'Statut du signalement mis à jour',
      });
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر تحديث البلاغ' : 'Impossible de mettre à jour le signalement',
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // RENDU
  // ============================================
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-96 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'default', maintenance: 'secondary', offline: 'destructive',
    on_duty: 'default', in_service: 'default', break: 'secondary', off_duty: 'destructive',
    open: 'destructive', in_progress: 'secondary', resolved: 'default',
  };

  const filteredBuses = buses.filter((b) => {
    const matchSearch = b.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.model || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredDrivers = drivers.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.license_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterStatus === 'all' || u.role === filterStatus;
    return matchSearch && matchRole;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t.nav.admin}</h1>
            <p className="mt-1 text-muted-foreground">{t.admin.overview}</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {locale === 'ar' ? 'تحديث' : 'Rafraîchir'}
          </Button>
        </div>
      </motion.div>

      {/* ===== STATS ===== */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {[
          { icon: Bus, label: t.admin.activeBuses, value: `${stats.activeBuses}/${stats.totalBuses}`, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Route, label: t.admin.totalLines, value: stats.totalLines, color: 'text-success', bg: 'bg-success/10' },
          { icon: MapPin, label: t.admin.totalStations, value: stats.totalStations, color: 'text-warning', bg: 'bg-warning/10' },
          { icon: AlertCircle, label: t.admin.openReports, value: stats.openReports, color: 'text-destructive', bg: 'bg-destructive/10' },
          { icon: Users, label: t.admin.drivers, value: `${stats.onDutyDrivers}/${stats.totalDrivers}`, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Users, label: t.admin.totalUsers, value: stats.totalUsers, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { icon: Activity, label: locale === 'ar' ? 'معدل النشاط' : "Taux d'activité", value: `${stats.totalBuses > 0 ? Math.round((stats.activeBuses / stats.totalBuses) * 100) : 0}%`, color: 'text-success', bg: 'bg-success/10' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="glass p-3">
                <div className={`mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div className="text-lg font-bold">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* ===== TABS ===== */}
      <Tabs defaultValue="buses" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="buses" className="gap-1.5">
            <Bus className="h-4 w-4" />
            {t.admin.buses}
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1.5">
            <Users className="h-4 w-4" />
            {t.admin.drivers}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Shield className="h-4 w-4" />
            {locale === 'ar' ? 'المستخدمين' : 'Utilisateurs'}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <AlertCircle className="h-4 w-4" />
            {t.admin.reports}
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5">
            <Newspaper className="h-4 w-4" />
            {locale === 'ar' ? 'الإعلانات' : 'Annonces'}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {locale === 'ar' ? 'الرسائل' : 'Messages'}
          </TabsTrigger>
          <TabsTrigger value="lines" className="gap-1.5" asChild>
            <a href="/admin/lines">
              <Route className="h-4 w-4" />
              {locale === 'ar' ? 'الخطوط' : 'Lignes'}
            </a>
          </TabsTrigger>
          <TabsTrigger value="stations" className="gap-1.5" asChild>
            <a href="/admin/stations">
              <MapPin className="h-4 w-4" />
              {locale === 'ar' ? 'المحطات' : 'Stations'}
            </a>
          </TabsTrigger>
          <TabsTrigger value="qr" className="gap-1.5">
            <QrCode className="h-4 w-4" />
            {locale === 'ar' ? 'رموز QR' : 'Codes QR'}
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1.5">
            <Send className="h-4 w-4" />
            {locale === 'ar' ? 'الإرسال' : 'Dispatch'}
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            {locale === 'ar' ? 'الإحصائيات' : 'Statistiques'}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-4 w-4" />
            {t.admin.activityLog}
          </TabsTrigger>
        </TabsList>

        {/* ===== BUS TAB ===== */}
        <TabsContent value="buses">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={locale === 'ar' ? 'بحث عن حافلة...' : 'Rechercher un bus...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder={locale === 'ar' ? 'الحالة' : 'Statut'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{locale === 'ar' ? 'الكل' : 'Tous'}</SelectItem>
                    <SelectItem value="active">{locale === 'ar' ? 'نشط' : 'Actif'}</SelectItem>
                    <SelectItem value="maintenance">{locale === 'ar' ? 'صيانة' : 'Maintenance'}</SelectItem>
                    <SelectItem value="offline">{locale === 'ar' ? 'غير متصل' : 'Hors ligne'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { resetBusForm(); setBusFormOpen(true); }} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                {locale === 'ar' ? 'إضافة حافلة' : 'Ajouter un bus'}
              </Button>
            </div>

            <Card className="glass overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="p-3 text-start font-medium">{t.map.plate}</th>
                      <th className="p-3 text-start font-medium">{locale === 'ar' ? 'الموديل' : 'Modèle'}</th>
                      <th className="p-3 text-start font-medium">{t.map.line}</th>
                      <th className="p-3 text-start font-medium">{locale === 'ar' ? 'السائق' : 'Chauffeur'}</th>
                      <th className="p-3 text-start font-medium">{t.admin.status}</th>
                      <th className="p-3 text-end font-medium">{t.admin.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBuses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          {locale === 'ar' ? 'لا توجد حافلات' : 'Aucun bus trouvé'}
                        </td>
                      </tr>
                    ) : (
                      filteredBuses.map((bus) => {
                        const assignedDriver = drivers.find(d => d.id === bus.driver_id);
                        return (
                          <tr key={bus.id} className="border-b border-border/40 hover:bg-muted/30">
                            <td className="p-3 font-medium">{bus.plate}</td>
                            <td className="p-3 text-muted-foreground">{bus.model || '—'}</td>
                            <td className="p-3">
                              {bus.line && (
                                <div className="flex items-center gap-1.5">
                                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: bus.line.color }} />
                                  <span>{bus.line.number}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {bus.driver_id ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="gap-1">
                                    <Users className="h-3 w-3" />
                                    {assignedDriver?.name || 'غير معروف'}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    onClick={() => unassignDriverFromBus(bus.id)}
                                    title={locale === 'ar' ? 'فصل السائق' : 'Détacher le chauffeur'}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {locale === 'ar' ? 'غير مخصص' : 'Non assigné'}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-primary hover:text-primary"
                                    onClick={() => openAssignDriverDialog(bus)}
                                    title={locale === 'ar' ? 'تعيين سائق' : 'Assigner un chauffeur'}
                                  >
                                    <UserPlus className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge variant={statusColors[bus.status] as any || 'secondary'}>
                                {t.common[bus.status as keyof typeof t.common] || bus.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-end">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => editBus(bus)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => {
                                    setDeleteTarget({ id: bus.id, type: 'bus', name: bus.plate });
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ===== DRIVERS TAB ===== */}
        <TabsContent value="drivers">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={locale === 'ar' ? 'بحث عن سائق...' : 'Rechercher un chauffeur...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder={locale === 'ar' ? 'الحالة' : 'Statut'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{locale === 'ar' ? 'الكل' : 'Tous'}</SelectItem>
                    <SelectItem value="on_duty">{locale === 'ar' ? 'نشط' : 'En service'}</SelectItem>
                    <SelectItem value="in_service">{locale === 'ar' ? 'في الخدمة' : 'En service'}</SelectItem>
                    <SelectItem value="break">{locale === 'ar' ? 'استراحة' : 'Pause'}</SelectItem>
                    <SelectItem value="off_duty">{locale === 'ar' ? 'غير متصل' : 'Hors service'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { resetDriverForm(); setDriverFormOpen(true); }} className="gap-2 shrink-0">
                <UserPlus className="h-4 w-4" />
                {locale === 'ar' ? 'إضافة سائق' : 'Ajouter un chauffeur'}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDrivers.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  {locale === 'ar' ? 'لا يوجد سائقين' : 'Aucun chauffeur'}
                </div>
              ) : (
                filteredDrivers.map((driver) => (
                  <Card key={driver.id} className="glass p-4 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          {driver.name}
                          <Badge variant="outline" className="text-xs">
                            🚌 {locale === 'ar' ? 'سائق' : 'Chauffeur'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {driver.license_number || '—'}
                        </div>
                        {driver.phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />
                            {driver.phone}
                          </div>
                        )}
                        {driver.bus_id && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Bus className="h-3 w-3" />
                            {buses.find(b => b.id === driver.bus_id)?.plate || (locale === 'ar' ? 'حافلة مخصصة' : 'Bus assigné')}
                          </div>
                        )}
                        {driver.user_id && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" />
                            {users.find(u => u.id === driver.user_id)?.email || '—'}
                          </div>
                        )}
                      </div>
                      <Badge variant={statusColors[driver.status] as any || 'secondary'}>
                        {t.common[driver.status as keyof typeof t.common] || driver.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => editDriver(driver)}
                      >
                        <Edit className="h-3 w-3" />
                        {locale === 'ar' ? 'تعديل' : 'Modifier'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteTarget({ id: driver.id, type: 'driver', name: driver.name });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== USERS TAB ===== */}
        <TabsContent value="users">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={locale === 'ar' ? 'بحث عن مستخدم...' : 'Rechercher un utilisateur...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder={locale === 'ar' ? 'الدور' : 'Rôle'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{locale === 'ar' ? 'الكل' : 'Tous'}</SelectItem>
                    <SelectItem value="customer">{locale === 'ar' ? 'عميل' : 'Client'}</SelectItem>
                    <SelectItem value="driver">{locale === 'ar' ? 'سائق' : 'Chauffeur'}</SelectItem>
                    <SelectItem value="admin">{locale === 'ar' ? 'مدير' : 'Admin'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { resetUserForm(); setUserFormOpen(true); }} className="gap-2 shrink-0">
                <UserPlus className="h-4 w-4" />
                {locale === 'ar' ? 'إضافة مستخدم' : 'Ajouter un utilisateur'}
              </Button>
            </div>

            <Card className="glass overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="p-3 text-start font-medium">{locale === 'ar' ? 'الاسم' : 'Nom'}</th>
                      <th className="p-3 text-start font-medium">{t.auth.email}</th>
                      <th className="p-3 text-start font-medium">{locale === 'ar' ? 'الدور' : 'Rôle'}</th>
                      <th className="p-3 text-start font-medium">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="p-3 text-end font-medium">{t.admin.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          {locale === 'ar' ? 'لا يوجد مستخدمين' : 'Aucun utilisateur trouvé'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="p-3 font-medium">{user.full_name}</td>
                          <td className="p-3 text-muted-foreground">{user.email}</td>
                          <td className="p-3">
                            <Badge variant={user.role === 'admin' ? 'default' : user.role === 'driver' ? 'secondary' : 'outline'}>
                              {locale === 'ar' 
                                ? (user.role === 'customer' ? 'عميل' : user.role === 'driver' ? 'سائق' : 'مدير')
                                : (user.role === 'customer' ? 'Client' : user.role === 'driver' ? 'Chauffeur' : 'Admin')}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                          </td>
                          <td className="p-3 text-end">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => editUser(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => {
                                  setDeleteTarget({ id: user.id, type: 'user', name: user.full_name });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ===== REPORTS TAB ===== */}
        <TabsContent value="reports">
          <Card className="glass overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="p-3 text-start font-medium">{locale === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="p-3 text-start font-medium">{locale === 'ar' ? 'الرسالة' : 'Message'}</th>
                    <th className="p-3 text-start font-medium">{t.admin.status}</th>
                    <th className="p-3 text-start font-medium">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 text-start font-medium">{t.admin.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">—</td></tr>
                  ) : (
                    reports.map((report) => (
                      <tr key={report.id} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="p-3"><Badge variant="outline">{t.common[report.type as keyof typeof t.common] || report.type}</Badge></td>
                        <td className="p-3 text-muted-foreground max-w-xs truncate">{report.message || '—'}</td>
                        <td className="p-3">
                          <Badge variant={statusColors[report.status] as any || 'secondary'}>
                            {t.common[report.status as keyof typeof t.common] || report.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                        </td>
                        <td className="p-3">
                          <select
                            value={report.status}
                            onChange={(e) => updateReportStatus(report.id, e.target.value)}
                            className="rounded border border-border bg-card px-2 py-1 text-xs outline-none"
                          >
                            <option value="open">{t.common.open}</option>
                            <option value="in_progress">{t.common.inProgress}</option>
                            <option value="resolved">{t.common.resolved}</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ===== ANNOUNCEMENTS TAB ===== */}
        <TabsContent value="announcements">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {locale === 'ar' ? 'إدارة الإعلانات' : 'Gestion des annonces'}
              </h3>
              <Button 
                onClick={() => { resetAnnouncementForm(); setAnnouncementFormOpen(true); }} 
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {locale === 'ar' ? 'إضافة إعلان' : 'Ajouter une annonce'}
              </Button>
            </div>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <Card className="glass p-8 text-center text-muted-foreground">
                  <Newspaper className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2">
                    {locale === 'ar' ? 'لا توجد إعلانات' : 'Aucune annonce'}
                  </p>
                </Card>
              ) : (
                announcements.map((ann) => (
                  <Card key={ann.id} className="glass p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={
                            ann.type === 'alert' ? 'destructive' : 
                            ann.type === 'news' ? 'default' : 'secondary'
                          }>
                            {ann.type === 'alert' ? '⚠️ ' : ann.type === 'news' ? '📰 ' : 'ℹ️ '}
                            {locale === 'ar' 
                              ? (ann.type === 'alert' ? 'تنبيه' : ann.type === 'news' ? 'خبر' : 'معلومة')
                              : (ann.type === 'alert' ? 'Alerte' : ann.type === 'news' ? 'Actualité' : 'Info')}
                          </Badge>
                          <Badge variant={ann.is_published ? 'default' : 'secondary'}>
                            {ann.is_published 
                              ? (locale === 'ar' ? 'منشور' : 'Publié')
                              : (locale === 'ar' ? 'غير منشور' : 'Non publié')}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(ann.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                          </span>
                        </div>
                        <h4 className="font-semibold">
                          {locale === 'ar' ? ann.title_ar : ann.title_fr}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {locale === 'ar' ? ann.body_ar : ann.body_fr}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAnnouncementStatus(ann)}
                          title={ann.is_published ? (locale === 'ar' ? 'إلغاء النشر' : 'Dépublier') : (locale === 'ar' ? 'نشر' : 'Publier')}
                        >
                          {ann.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editAnnouncement(ann)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget({ id: ann.id, type: 'announcement', name: ann.title_ar });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== MESSAGES TAB ===== */}
        <TabsContent value="messages">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {locale === 'ar' ? 'رسائل السائقين' : 'Messages des chauffeurs'}
              </h3>
              <Badge variant="outline">
                {driverMessages.length} {locale === 'ar' ? 'رسالة' : 'messages'}
              </Badge>
            </div>

            <div className="space-y-3">
              {driverMessages.length === 0 ? (
                <Card className="glass p-8 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2">
                    {locale === 'ar' ? 'لا توجد رسائل' : 'Aucun message'}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {driverMessages.map((msg) => (
                    <Card key={msg.id} className={`p-4 ${!msg.is_read ? 'border-primary/30 bg-primary/5' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={msg.sender_role === 'driver' ? 'default' : 'secondary'}>
                              {msg.sender_role === 'driver' 
                                ? (locale === 'ar' ? '🚌 سائق' : '🚌 Chauffeur')
                                : (locale === 'ar' ? '🛡️ إدارة' : '🛡️ Admin')}
                            </Badge>
                            {!msg.is_read && (
                              <Badge variant="destructive" className="animate-pulse">
                                {locale === 'ar' ? 'جديد' : 'Nouveau'}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {msg.driver?.name || (locale === 'ar' ? 'سائق غير معروف' : 'Chauffeur inconnu')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.created_at).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.driver?.phone && (
                            <p className="text-xs text-muted-foreground mt-1">📞 {msg.driver.phone}</p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {!msg.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markMessageRead(msg.id)}
                              title={locale === 'ar' ? 'تحديد كمقروء' : 'Marquer comme lu'}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {msg.sender_role === 'driver' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(msg.id);
                                setMessageReply('');
                              }}
                              title={locale === 'ar' ? 'رد' : 'Répondre'}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteTarget({ id: msg.id, type: 'message', name: msg.content.slice(0, 30) + '...' });
                              setDeleteDialogOpen(true);
                            }}
                            title={locale === 'ar' ? 'حذف' : 'Supprimer'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {replyingTo === msg.id && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex gap-2">
                            <Textarea
                              value={messageReply}
                              onChange={(e) => setMessageReply(e.target.value)}
                              rows={2}
                              className="text-sm flex-1"
                              placeholder={locale === 'ar' ? 'اكتب ردك...' : 'Écrivez votre réponse...'}
                            />
                            <Button
                              size="sm"
                              onClick={() => sendReplyToDriver(msg.driver_id, msg.id)}
                              className="shrink-0 gap-2"
                            >
                              <Send className="h-4 w-4" />
                              {locale === 'ar' ? 'إرسال' : 'Envoyer'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== QR TAB ===== */}
        <TabsContent value="qr">
          <Card className="glass p-5">
            <QRCodeManager />
          </Card>
        </TabsContent>

        {/* ===== DISPATCH TAB ===== */}
        <TabsContent value="dispatch">
          <Card className="glass p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 text-primary" />
              {locale === 'ar' ? 'إرسال إشعار للسائقين' : 'Envoyer une notification aux chauffeurs'}
            </h3>
            <div className="space-y-3 max-w-md">
              <div>
                <Label className="text-xs">{locale === 'ar' ? 'العنوان' : 'Titre'}</Label>
                <Input 
                  value={notifTitle} 
                  onChange={(e) => setNotifTitle(e.target.value)} 
                  className="mt-1" 
                  placeholder={locale === 'ar' ? 'عنوان الإشعار' : 'Titre de la notification'} 
                />
              </div>
              <div>
                <Label className="text-xs">{locale === 'ar' ? 'المحتوى' : 'Contenu'}</Label>
                <Textarea 
                  value={notifBody} 
                  onChange={(e) => setNotifBody(e.target.value)} 
                  rows={3} 
                  className="mt-1" 
                  placeholder={locale === 'ar' ? 'محتوى الإشعار' : 'Contenu de la notification'} 
                />
              </div>
              <Button onClick={sendNotification} className="gap-2">
                <Send className="h-4 w-4" />
                {locale === 'ar' ? 'إرسال للسائقين النشطين' : 'Envoyer aux chauffeurs actifs'}
              </Button>
              <p className="text-xs text-muted-foreground">
                {locale === 'ar' 
                  ? `سيتم الإرسال إلى ${drivers.filter((d) => d.status === 'on_duty' || d.status === 'in_service').length} سائق نشط` 
                  : `Sera envoyé à ${drivers.filter((d) => d.status === 'on_duty' || d.status === 'in_service').length} chauffeur(s) actif(s)`}
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* ===== STATISTICS TAB ===== */}
        <TabsContent value="statistics">
          <StatisticsDashboard />
        </TabsContent>

        {/* ===== ACTIVITY LOG TAB ===== */}
        <TabsContent value="activity">
          <Card className="glass p-4">
            <div className="space-y-3">
              {activityLogs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {locale === 'ar' ? 'لا توجد سجلات نشاط' : 'Aucun journal d\'activité'}
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 border-b border-border/40 pb-3 last:border-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      log.action.includes('حذف') || log.action.includes('delete') ? 'bg-destructive/10 text-destructive' :
                      log.action.includes('إضافة') || log.action.includes('add') ? 'bg-success/10 text-success' :
                      log.action.includes('تعديل') || log.action.includes('update') ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{log.action}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.actor}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.target && <span className="font-medium">{log.target}</span>}
                        {log.detail && <span className="ml-1 text-muted-foreground/70">· {log.detail}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================ */}
      {/* ===== DIALOGS ===== */}
      {/* ============================================ */}

      {/* ===== BUS FORM DIALOG ===== */}
      <Dialog open={busFormOpen} onOpenChange={setBusFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBus 
                ? (locale === 'ar' ? 'تعديل الحافلة' : 'Modifier le bus')
                : (locale === 'ar' ? 'إضافة حافلة جديدة' : 'Ajouter un nouveau bus')}
            </DialogTitle>
            <DialogDescription>
              {editingBus 
                ? (locale === 'ar' ? 'تعديل بيانات الحافلة' : 'Modifier les informations du bus')
                : (locale === 'ar' ? 'أدخل بيانات الحافلة الجديدة' : 'Entrez les informations du nouveau bus')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{locale === 'ar' ? 'رقم اللوحة' : 'Plaque'}</Label>
              <Input
                value={busForm.plate}
                onChange={(e) => setBusForm({ ...busForm, plate: e.target.value })}
                placeholder={locale === 'ar' ? 'مثال: 1234 A' : 'Ex: 1234 A'}
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'الموديل' : 'Modèle'}</Label>
              <Input
                value={busForm.model}
                onChange={(e) => setBusForm({ ...busForm, model: e.target.value })}
                placeholder="Mercedes, MAN..."
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'السعة' : 'Capacité'}</Label>
              <Input
                type="number"
                value={busForm.capacity}
                onChange={(e) => setBusForm({ ...busForm, capacity: Number(e.target.value) })}
                min={10}
                max={100}
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'الحالة' : 'Statut'}</Label>
              <Select
                value={busForm.status}
                onValueChange={(value) => setBusForm({ ...busForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t.common.active}</SelectItem>
                  <SelectItem value="maintenance">{t.common.maintenance}</SelectItem>
                  <SelectItem value="offline">{t.common.offline}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{locale === 'ar' ? 'الخط' : 'Ligne'}</Label>
              <Select
                value={busForm.line_id}
                onValueChange={(value) => setBusForm({ ...busForm, line_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={locale === 'ar' ? 'اختر خط' : 'Choisir une ligne'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{locale === 'ar' ? 'بدون خط' : 'Sans ligne'}</SelectItem>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.number} - {locale === 'ar' ? line.name_ar : line.name_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBusFormOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button onClick={handleBusSubmit}>
              {editingBus 
                ? (locale === 'ar' ? 'تحديث' : 'Mettre à jour')
                : (locale === 'ar' ? 'إضافة' : 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DRIVER FORM DIALOG ===== */}
      <Dialog open={driverFormOpen} onOpenChange={setDriverFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDriver 
                ? (locale === 'ar' ? 'تعديل السائق' : 'Modifier le chauffeur')
                : (locale === 'ar' ? 'إضافة سائق جديد' : 'Ajouter un nouveau chauffeur')}
            </DialogTitle>
            <DialogDescription>
              {editingDriver 
                ? (locale === 'ar' ? 'تعديل بيانات السائق' : 'Modifier les informations du chauffeur')
                : (locale === 'ar' ? 'أدخل بيانات السائق الجديد' : 'Entrez les informations du nouveau chauffeur')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-red-500">
                {locale === 'ar' ? 'الاسم الكامل *' : 'Nom complet *'}
              </Label>
              <Input
                value={driverForm.name}
                onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                placeholder={locale === 'ar' ? 'اسم السائق' : 'Nom du chauffeur'}
                required
              />
            </div>

            {!editingDriver && (
              <>
                <div>
                  <Label className="text-red-500">
                    {locale === 'ar' ? '📧 البريد الإلكتروني *' : '📧 Email *'}
                  </Label>
                  <Input
                    type="email"
                    value={driverForm.email}
                    onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                    placeholder={locale === 'ar' ? 'بريد السائق الإلكتروني' : 'Email du chauffeur'}
                    required
                    className="border-2 border-primary/30 focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {locale === 'ar' 
                      ? '📌 سيتم استخدام هذا البريد لتسجيل الدخول'
                      : '📌 Cet email sera utilisé pour la connexion'}
                  </p>
                </div>

                <div>
                  <Label className="text-red-500">
                    {locale === 'ar' ? '🔑 كلمة المرور *' : '🔑 Mot de passe *'}
                  </Label>
                  <Input
                    type="password"
                    value={driverForm.password}
                    onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                    placeholder={locale === 'ar' ? 'كلمة مرور مؤقتة (6 أحرف على الأقل)' : 'Mot de passe temporaire (6 caractères minimum)'}
                    required
                    minLength={6}
                    className="border-2 border-primary/30 focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {locale === 'ar' 
                      ? '📌 سيتمكن السائق من تغييرها لاحقاً'
                      : '📌 Le chauffeur pourra la changer plus tard'}
                  </p>
                </div>
              </>
            )}

            <div>
              <Label>{locale === 'ar' ? 'رقم الرخصة' : 'Numéro de permis'}</Label>
              <Input
                value={driverForm.license_number}
                onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                placeholder={locale === 'ar' ? 'رقم الرخصة' : 'Numéro de permis'}
              />
            </div>

            <div>
              <Label>{locale === 'ar' ? 'رقم الهاتف' : 'Téléphone'}</Label>
              <Input
                value={driverForm.phone}
                onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                placeholder="+212 ..."
              />
            </div>

            <div>
              <Label>{locale === 'ar' ? 'الحالة' : 'Statut'}</Label>
              <Select
                value={driverForm.status}
                onValueChange={(value) => setDriverForm({ ...driverForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_duty">{t.driver.online}</SelectItem>
                  <SelectItem value="in_service">{t.driver.inService}</SelectItem>
                  <SelectItem value="break">{t.driver.break}</SelectItem>
                  <SelectItem value="off_duty">{t.driver.offline}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingDriver && (
              <div className="p-3 rounded-lg bg-muted/30">
                <Label className="text-xs text-muted-foreground">
                  {locale === 'ar' ? '🚌 الحافلة المخصصة' : '🚌 Bus assigné'}
                </Label>
                <div className="mt-1 font-medium">
                  {editingDriver.bus_id ? (
                    <span className="flex items-center gap-2">
                      <Bus className="h-4 w-4 text-primary" />
                      {buses.find(b => b.id === editingDriver.bus_id)?.plate || editingDriver.bus_id}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {locale === 'ar' ? 'لا توجد حافلة مخصصة' : 'Aucun bus assigné'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === 'ar' 
                    ? 'يمكن تغيير الحافلة من قائمة الحافلات'
                    : 'Le bus peut être modifié depuis la liste des bus'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDriverFormOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button onClick={handleDriverSubmit} className="gap-2">
              {editingDriver 
                ? (locale === 'ar' ? 'تحديث' : 'Mettre à jour')
                : (locale === 'ar' ? '✅ إضافة' : '✅ Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== USER FORM DIALOG ===== */}
      <Dialog open={userFormOpen} onOpenChange={setUserFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser 
                ? (locale === 'ar' ? 'تعديل المستخدم' : 'Modifier l\'utilisateur')
                : (locale === 'ar' ? 'إضافة مستخدم جديد' : 'Ajouter un nouvel utilisateur')}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? (locale === 'ar' ? 'تعديل بيانات المستخدم' : 'Modifier les informations de l\'utilisateur')
                : (locale === 'ar' ? 'أدخل بيانات المستخدم الجديد' : 'Entrez les informations du nouvel utilisateur')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="email@example.com"
                disabled={!!editingUser}
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'الاسم الكامل' : 'Nom complet'}</Label>
              <Input
                value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                placeholder={locale === 'ar' ? 'اسم المستخدم' : 'Nom de l\'utilisateur'}
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'رقم الهاتف' : 'Téléphone'}</Label>
              <Input
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="+212 ..."
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'الدور' : 'Rôle'}</Label>
              <Select
                value={userForm.role}
                onValueChange={(value: 'customer' | 'driver' | 'admin') => 
                  setUserForm({ ...userForm, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{locale === 'ar' ? 'عميل' : 'Client'}</SelectItem>
                  <SelectItem value="driver">{locale === 'ar' ? 'سائق' : 'Chauffeur'}</SelectItem>
                  <SelectItem value="admin">{locale === 'ar' ? 'مدير' : 'Admin'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingUser && (
              <div>
                <Label>{locale === 'ar' ? 'كلمة المرور' : 'Mot de passe'}</Label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="••••••••"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {locale === 'ar' ? 'يجب أن تكون 6 أحرف على الأقل' : 'Doit contenir au moins 6 caractères'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserFormOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button onClick={handleUserSubmit}>
              {editingUser 
                ? (locale === 'ar' ? 'تحديث' : 'Mettre à jour')
                : (locale === 'ar' ? 'إضافة' : 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ANNOUNCEMENT FORM DIALOG ===== */}
      <Dialog open={announcementFormOpen} onOpenChange={setAnnouncementFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement 
                ? (locale === 'ar' ? 'تعديل الإعلان' : 'Modifier l\'annonce')
                : (locale === 'ar' ? 'إضافة إعلان جديد' : 'Ajouter une nouvelle annonce')}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement 
                ? (locale === 'ar' ? 'تعديل بيانات الإعلان' : 'Modifier les informations de l\'annonce')
                : (locale === 'ar' ? 'أدخل بيانات الإعلان الجديد' : 'Entrez les informations de la nouvelle annonce')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{locale === 'ar' ? 'العنوان (عربي)' : 'Titre (Arabe)'}</Label>
              <Input
                value={announcementForm.title_ar}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title_ar: e.target.value })}
                placeholder={locale === 'ar' ? 'عنوان الإعلان' : 'Titre de l\'annonce'}
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'العنوان (فرنسي)' : 'Titre (Français)'}</Label>
              <Input
                value={announcementForm.title_fr}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title_fr: e.target.value })}
                placeholder="Titre de l'annonce"
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'المحتوى (عربي)' : 'Contenu (Arabe)'}</Label>
              <Textarea
                value={announcementForm.body_ar}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, body_ar: e.target.value })}
                rows={3}
                placeholder={locale === 'ar' ? 'محتوى الإعلان' : 'Contenu de l\'annonce'}
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'المحتوى (فرنسي)' : 'Contenu (Français)'}</Label>
              <Textarea
                value={announcementForm.body_fr}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, body_fr: e.target.value })}
                rows={3}
                placeholder="Contenu de l'annonce"
              />
            </div>
            <div>
              <Label>{locale === 'ar' ? 'النوع' : 'Type'}</Label>
              <Select
                value={announcementForm.type}
                onValueChange={(value: 'info' | 'alert' | 'news') => 
                  setAnnouncementForm({ ...announcementForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ {locale === 'ar' ? 'معلومة' : 'Info'}</SelectItem>
                  <SelectItem value="alert">⚠️ {locale === 'ar' ? 'تنبيه' : 'Alerte'}</SelectItem>
                  <SelectItem value="news">📰 {locale === 'ar' ? 'خبر' : 'Actualité'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_published"
                checked={announcementForm.is_published}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, is_published: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="is_published" className="text-sm cursor-pointer">
                {locale === 'ar' ? 'نشر الإعلان فوراً' : 'Publier immédiatement'}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnouncementFormOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button onClick={handleAnnouncementSubmit}>
              {editingAnnouncement 
                ? (locale === 'ar' ? 'تحديث' : 'Mettre à jour')
                : (locale === 'ar' ? 'إضافة' : 'Ajouter')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ASSIGN DRIVER DIALOG ===== */}
      <Dialog open={assignDriverDialogOpen} onOpenChange={setAssignDriverDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locale === 'ar' ? 'تعيين سائق للحافلة' : 'Assigner un chauffeur au bus'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'ar' 
                ? `اختر سائق لربطه بالحافلة ${selectedBusForDriver?.plate || ''}`
                : `Choisissez un chauffeur pour le bus ${selectedBusForDriver?.plate || ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{locale === 'ar' ? 'اختر سائق' : 'Choisir un chauffeur'}</Label>
              <Select
                value={selectedDriverId}
                onValueChange={setSelectedDriverId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={locale === 'ar' ? 'اختر سائق...' : 'Choisir un chauffeur...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.length === 0 ? (
                    <SelectItem value="" disabled>
                      {locale === 'ar' ? 'لا يوجد سائقين متاحين' : 'Aucun chauffeur disponible'}
                    </SelectItem>
                  ) : (
                    availableDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} {driver.license_number ? `(${driver.license_number})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                {locale === 'ar' 
                  ? `السائقين المتاحين: ${availableDrivers.length}`
                  : `Chauffeurs disponibles: ${availableDrivers.length}`}
              </p>
            </div>

            {availableDrivers.length === 0 && (
              <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning">
                {locale === 'ar' 
                  ? '⚠️ لا يوجد سائقين غير مرتبطين بحافلات. قم بإضافة سائق جديد أولاً.'
                  : '⚠️ Aucun chauffeur non assigné. Ajoutez un nouveau chauffeur d\'abord.'}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDriverDialogOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button onClick={assignDriverToBus} disabled={!selectedDriverId}>
              {locale === 'ar' ? '✅ تعيين' : '✅ Assigner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{locale === 'ar' ? 'تأكيد الحذف' : 'Confirmation de suppression'}</DialogTitle>
            <DialogDescription>
              {locale === 'ar' 
                ? `هل أنت متأكد من حذف "${deleteTarget?.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`
                : `Êtes-vous sûr de vouloir supprimer "${deleteTarget?.name}" ? Cette action est irréversible.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button variant="destructive" onClick={() => {
              if (deleteTarget?.type === 'bus') deleteBus();
              else if (deleteTarget?.type === 'driver') deleteDriver();
              else if (deleteTarget?.type === 'user') deleteUser();
              else if (deleteTarget?.type === 'announcement') deleteAnnouncement();
              else if (deleteTarget?.type === 'message') deleteMessage(deleteTarget.id);
            }}>
              {locale === 'ar' ? 'حذف' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}