// app/admin/stations/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// مكون المحطة القابلة للسحب - محسن
function SortableStationItem({ station, line, onEdit, onDelete, onToggleStatus, index, isFirst, isLast, onMove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: station.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`p-4 hover:shadow-md transition-all ${isDragging ? 'shadow-lg border-primary' : ''}`}>
        <div className="flex items-center gap-3">
          {/* رقم الترتيب ومقبض السحب */}
          <div className="flex items-center gap-2 min-w-[60px]">
            <div className="flex flex-col items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                onClick={() => onMove(station.id, 'up')}
                disabled={isFirst}
              >
                ▲
              </Button>
              <span className="text-xs font-mono font-bold text-muted-foreground w-6 text-center">
                #{station.station_order || index + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                onClick={() => onMove(station.id, 'down')}
                disabled={isLast}
              >
                ▼
              </Button>
            </div>
            <div className="cursor-grab text-muted-foreground hover:text-primary" {...listeners}>
              <span className="text-xl">⋮⋮</span>
            </div>
          </div>

          {/* معلومات المحطة */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={
                station.type === 'bus' ? 'default' : 
                station.type === 'tram' ? 'secondary' : 'outline'
              } className="text-xs">
                {station.type === 'bus' ? '🚌 حافلة' : station.type === 'tram' ? '🚋 ترام' : '🚆 قطار'}
              </Badge>
              <Badge variant={station.status === 'active' ? 'success' : 'secondary'} className="text-xs">
                {station.status === 'active' ? '🟢 نشط' : '🔴 غير نشط'}
              </Badge>
              {line && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} />
                  {line.number}
                </Badge>
              )}
            </div>
            <div className="mt-1">
              <div className="font-semibold text-base">{station.name_ar}</div>
              <div className="text-sm text-muted-foreground">{station.name_fr}</div>
            </div>
            {station.address_ar && (
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <span>📍</span>
                <span>{station.address_ar}</span>
              </div>
            )}
            {line && (
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <span>🚌</span>
                <span>{line.name_ar}</span>
              </div>
            )}
            {station.lat && (
              <div className="text-xs text-muted-foreground mt-0.5">
                📌 {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
              </div>
            )}
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex gap-1 ml-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-green-50"
              onClick={() => onToggleStatus(station)}
              title={station.status === 'active' ? 'تعطيل' : 'تفعيل'}
            >
              {station.status === 'active' ? '🔴' : '🟢'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-blue-50"
              onClick={() => onEdit(station)}
              title="تعديل"
            >
              ✏️
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-red-50 text-red-500"
              onClick={() => onDelete(station.id, station.name_ar)}
              title="حذف"
            >
              🗑️
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AdminStationsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [stations, setStations] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedLineFilter, setSelectedLineFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    name_ar: '',
    name_fr: '',
    address_ar: '',
    address_fr: '',
    lat: 33.5731,
    lng: -7.5898,
    type: 'bus',
    status: 'active',
    line_id: '',
    station_order: 0,
    description_ar: '',
    description_fr: '',
  });

  // إعدادات DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ✅ التحقق من صلاحيات المدير
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/'); return; }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin') {
          setIsAdmin(true);
        } else {
          toast({ title: 'غير مصرح', description: 'هذه الصفحة مخصصة للمديرين فقط', variant: 'destructive' });
          router.push('/');
        }
      } catch (error) {
        console.error('Error checking admin:', error);
        router.push('/');
      } finally {
        setChecking(false);
      }
    };

    checkAdmin();
  }, [router, toast]);

  // ✅ جلب البيانات
  const fetchData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      let query = supabase
        .from('stations')
        .select('*, line:lines(id, number, name_ar, name_fr, color)')
        .order('station_order', { ascending: true });

      if (selectedLineFilter) {
        query = query.eq('line_id', selectedLineFilter);
      }

      const [stationsRes, linesRes] = await Promise.all([
        query,
        supabase.from('lines').select('id, number, name_ar, name_fr, color, status').order('number'),
      ]);

      if (stationsRes.error) throw stationsRes.error;
      if (linesRes.error) throw linesRes.error;

      setStations(stationsRes.data || []);
      setLines(linesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'خطأ', description: 'تعذر تحميل البيانات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast, selectedLineFilter]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  // ✅ معالج سحب وإسقاط
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = stations.findIndex((item) => item.id === active.id);
      const newIndex = stations.findIndex((item) => item.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newStations = arrayMove(stations, oldIndex, newIndex);
        const updatedStations = newStations.map((station, index) => ({
          ...station,
          station_order: index + 1,
        }));

        setStations(updatedStations);

        try {
          for (const update of updatedStations) {
            const { error } = await supabase
              .from('stations')
              .update({ 
                station_order: update.station_order,
                updated_at: new Date().toISOString() 
              })
              .eq('id', update.id);

            if (error) throw error;
          }

          toast({ 
            title: '✅ تم تحديث الترتيب', 
            description: 'تم حفظ الترتيب الجديد للمحطات بنجاح' 
          });
        } catch (error) {
          console.error('Error updating station order:', error);
          toast({ 
            title: 'خطأ', 
            description: 'تعذر حفظ الترتيب الجديد', 
            variant: 'destructive' 
          });
          fetchData();
        }
      }
    }
  };

  // ✅ معالج تغيير الترتيب
  const moveStation = async (stationId, direction) => {
    const currentIndex = stations.findIndex((item) => item.id === stationId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= stations.length) return;

    const newStations = arrayMove(stations, currentIndex, newIndex);
    const updatedStations = newStations.map((station, index) => ({
      ...station,
      station_order: index + 1,
    }));

    setStations(updatedStations);

    try {
      for (const update of updatedStations) {
        const { error } = await supabase
          .from('stations')
          .update({ 
            station_order: update.station_order,
            updated_at: new Date().toISOString() 
          })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({ 
        title: '✅ تم تحديث الترتيب', 
        description: 'تم حفظ الترتيب الجديد للمحطات بنجاح' 
      });
    } catch (error) {
      console.error('Error updating station order:', error);
      toast({ 
        title: 'خطأ', 
        description: 'تعذر حفظ الترتيب الجديد', 
        variant: 'destructive' 
      });
      fetchData();
    }
  };

  // ✅ إضافة/تحديث محطة
  const handleSubmit = async () => {
    if (!form.name_ar || !form.name_fr) {
      toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }

    try {
      let stationOrder = form.station_order;
      if (!stationOrder || stationOrder === 0) {
        const stationsInLine = stations.filter(s => s.line_id === form.line_id);
        const maxOrder = stationsInLine.length > 0 
          ? Math.max(...stationsInLine.map(s => s.station_order || 0))
          : 0;
        stationOrder = maxOrder + 1;
      }

      const data = {
        name_ar: form.name_ar.trim(),
        name_fr: form.name_fr.trim(),
        address_ar: form.address_ar?.trim() || null,
        address_fr: form.address_fr?.trim() || null,
        lat: form.lat || 33.5731,
        lng: form.lng || -7.5898,
        type: form.type,
        status: form.status,
        line_id: form.line_id || null,
        station_order: stationOrder,
        description_ar: form.description_ar?.trim() || null,
        description_fr: form.description_fr?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await supabase
          .from('stations')
          .update(data)
          .eq('id', editing.id);

        if (error) throw error;
        toast({ title: '✅ تم التحديث', description: `تم تحديث المحطة ${form.name_ar}` });
      } else {
        const { error } = await supabase
          .from('stations')
          .insert({
            ...data,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
        toast({ title: '✅ تمت الإضافة', description: `تم إضافة المحطة ${form.name_ar}` });
      }

      setFormOpen(false);
      setEditing(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving station:', error);
      toast({ title: 'خطأ', description: 'تعذر حفظ المحطة', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setForm({
      name_ar: '',
      name_fr: '',
      address_ar: '',
      address_fr: '',
      lat: 33.5731,
      lng: -7.5898,
      type: 'bus',
      status: 'active',
      line_id: '',
      station_order: 0,
      description_ar: '',
      description_fr: '',
    });
  };

  // ✅ حذف محطة
  const deleteStation = async (id, name) => {
    if (!confirm(`⚠️ هل أنت متأكد من حذف "${name}"؟`)) return;

    try {
      const { error } = await supabase
        .from('stations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: '✅ تم الحذف', description: `تم حذف المحطة ${name}` });
      fetchData();
    } catch (error) {
      console.error('Error deleting station:', error);
      toast({ title: 'خطأ', description: 'تعذر حذف المحطة', variant: 'destructive' });
    }
  };

  // ✅ تغيير حالة المحطة
  const toggleStatus = async (station) => {
    try {
      const newStatus = station.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('stations')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', station.id);

      if (error) throw error;
      toast({ title: '✅ تم التحديث', description: `المحطة ${station.name_ar} أصبحت ${newStatus === 'active' ? 'نشطة' : 'غير نشطة'}` });
      fetchData();
    } catch (error) {
      toast({ title: 'خطأ', description: 'تعذر تحديث الحالة', variant: 'destructive' });
    }
  };

  // ✅ الحصول على اسم الخط
  const getLineInfo = (lineId) => {
    if (!lineId) return null;
    const line = lines.find(l => l.id === lineId);
    return line;
  };

  // ✅ تصفية المحطات حسب البحث
  const filteredStations = stations.filter(station => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      station.name_ar.toLowerCase().includes(search) ||
      station.name_fr.toLowerCase().includes(search) ||
      (station.address_ar && station.address_ar.toLowerCase().includes(search)) ||
      (station.address_fr && station.address_fr.toLowerCase().includes(search))
    );
  });

  if (checking) return <div className="p-8 text-center">جاري التحقق من الصلاحيات...</div>;
  if (!isAdmin) return null;
  if (loading) return <div className="p-8 text-center">جاري تحميل البيانات...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">📍 إدارة المحطات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة محطات النقل - العدد: {stations.length}
            <span className="mx-2">•</span>
            <span className="text-xs">اسحب المحطات لإعادة الترتيب</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button onClick={() => { setEditing(null); resetForm(); setFormOpen(true); }} className="w-full sm:w-auto">
            + إضافة محطة
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <Input
            placeholder="🔍 بحث عن محطة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <select
          value={selectedLineFilter}
          onChange={(e) => setSelectedLineFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background w-full sm:w-auto"
        >
          <option value="">جميع الخطوط</option>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.number} - {line.name_ar}
            </option>
          ))}
        </select>
      </div>

      {/* Stations List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredStations.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {filteredStations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-6xl mb-4">📍</div>
                <p className="text-lg">لا توجد محطات</p>
                <p className="text-sm">انقر على "إضافة محطة" لإنشاء أول محطة</p>
              </div>
            ) : (
              filteredStations.map((station, index) => {
                const line = getLineInfo(station.line_id);
                const globalIndex = stations.findIndex(s => s.id === station.id);
                return (
                  <SortableStationItem
                    key={station.id}
                    station={station}
                    line={line}
                    index={globalIndex}
                    isFirst={globalIndex === 0}
                    isLast={globalIndex === stations.length - 1}
                    onEdit={(station) => {
                      setEditing(station);
                      setForm({
                        name_ar: station.name_ar,
                        name_fr: station.name_fr,
                        address_ar: station.address_ar || '',
                        address_fr: station.address_fr || '',
                        lat: station.lat || 33.5731,
                        lng: station.lng || -7.5898,
                        type: station.type || 'bus',
                        status: station.status || 'active',
                        line_id: station.line_id || '',
                        station_order: station.station_order || 0,
                        description_ar: station.description_ar || '',
                        description_fr: station.description_fr || '',
                      });
                      setFormOpen(true);
                    }}
                    onDelete={deleteStation}
                    onToggleStatus={toggleStatus}
                    onMove={moveStation}
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '✏️ تعديل المحطة' : '➕ إضافة محطة جديدة'}</DialogTitle>
            <DialogDescription>
              {editing ? 'تعديل بيانات المحطة' : 'أدخل بيانات المحطة الجديدة'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الاسم (عربي) *</Label>
                <Input
                  value={form.name_ar}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                  placeholder="اسم المحطة بالعربية"
                  required
                />
              </div>
              <div>
                <Label>الاسم (فرنسي) *</Label>
                <Input
                  value={form.name_fr}
                  onChange={(e) => setForm({ ...form, name_fr: e.target.value })}
                  placeholder="Nom en français"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>العنوان (عربي)</Label>
                <Input
                  value={form.address_ar}
                  onChange={(e) => setForm({ ...form, address_ar: e.target.value })}
                  placeholder="عنوان المحطة بالعربية"
                />
              </div>
              <div>
                <Label>العنوان (فرنسي)</Label>
                <Input
                  value={form.address_fr}
                  onChange={(e) => setForm({ ...form, address_fr: e.target.value })}
                  placeholder="Adresse en français"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>خط العرض</Label>
                <Input
                  type="number"
                  step="0.00001"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })}
                  placeholder="33.5731"
                />
              </div>
              <div>
                <Label>خط الطول</Label>
                <Input
                  type="number"
                  step="0.00001"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })}
                  placeholder="-7.5898"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-background"
                >
                  <option value="bus">🚌 حافلة</option>
                  <option value="tram">🚋 ترام</option>
                  <option value="train">🚆 قطار</option>
                </select>
              </div>
              <div>
                <Label>الحالة</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-background"
                >
                  <option value="active">🟢 نشط</option>
                  <option value="inactive">🔴 غير نشط</option>
                </select>
              </div>
            </div>

            <div>
              <Label>الخط</Label>
              <select
                value={form.line_id}
                onChange={(e) => setForm({ ...form, line_id: e.target.value })}
                className="w-full border rounded-lg p-2 bg-background"
              >
                <option value="">بدون خط</option>
                {lines.filter(l => l.status === 'active').map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.number} - {line.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>ترتيب المحطة</Label>
              <Input
                type="number"
                min="0"
                value={form.station_order}
                onChange={(e) => setForm({ ...form, station_order: parseInt(e.target.value) || 0 })}
                placeholder="0 (تلقائي)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {!form.station_order || form.station_order === 0 ? 'سيتم تحديد الترتيب تلقائياً' : 'الترتيب المحدد'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الوصف (عربي)</Label>
                <Input
                  value={form.description_ar}
                  onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                  placeholder="وصف المحطة بالعربية"
                />
              </div>
              <div>
                <Label>الوصف (فرنسي)</Label>
                <Input
                  value={form.description_fr}
                  onChange={(e) => setForm({ ...form, description_fr: e.target.value })}
                  placeholder="Description en français"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} className="gap-2">
              {editing ? '💾 تحديث' : '➕ إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}