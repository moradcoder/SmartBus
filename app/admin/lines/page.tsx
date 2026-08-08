// app/admin/lines/page.tsx
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

export default function AdminLinesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    number: '',
    name_ar: '',
    name_fr: '',
    color: '#3B82F6',
    status: 'active',
    description_ar: '',
    description_fr: '',
  });

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

  // ✅ جلب الخطوط
  const fetchLines = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lines')
        .select('*')
        .order('number', { ascending: true });
      
      if (error) throw error;
      setLines(data || []);
    } catch (error) {
      toast({ title: 'خطأ', description: 'تعذر تحميل الخطوط', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    if (isAdmin) fetchLines();
  }, [isAdmin, fetchLines]);

  // ✅ إنشاء رقم تلقائي للخط الجديد
  const generateLineNumber = () => {
    if (lines.length === 0) return '1';
    const numbers = lines.map(l => parseInt(l.number) || 0);
    const maxNumber = Math.max(...numbers);
    return String(maxNumber + 1);
  };

  // ✅ إضافة/تحديث خط
  const handleSubmit = async () => {
    if (!form.name_ar || !form.name_fr) {
      toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }

    try {
      const data = {
        name_ar: form.name_ar.trim(),
        name_fr: form.name_fr.trim(),
        color: form.color,
        status: form.status,
        description_ar: form.description_ar?.trim() || null,
        description_fr: form.description_fr?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        // تحديث خط موجود
        const { error } = await supabase
          .from('lines')
          .update(data)
          .eq('id', editing.id);

        if (error) throw error;
        toast({ title: '✅ تم التحديث', description: `تم تحديث الخط ${form.number}` });
      } else {
        // إضافة خط جديد مع رقم تلقائي
        const newNumber = generateLineNumber();
        const { error } = await supabase
          .from('lines')
          .insert({
            ...data,
            number: newNumber,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
        toast({ title: '✅ تمت الإضافة', description: `تم إضافة الخط رقم ${newNumber}` });
      }

      setFormOpen(false);
      setEditing(null);
      setForm({ number: '', name_ar: '', name_fr: '', color: '#3B82F6', status: 'active', description_ar: '', description_fr: '' });
      fetchLines();
    } catch (error) {
      console.error('Error saving line:', error);
      toast({ title: 'خطأ', description: 'تعذر حفظ الخط', variant: 'destructive' });
    }
  };

  // ✅ حذف خط
  const deleteLine = async (id, name) => {
    if (!confirm(`⚠️ هل أنت متأكد من حذف "${name}"؟\nسيتم حذف جميع المحطات المرتبطة بهذا الخط.`)) return;

    try {
      // حذف المحطات المرتبطة أولاً
      const { error: stationsError } = await supabase
        .from('stations')
        .delete()
        .eq('line_id', id);

      if (stationsError) throw stationsError;

      // ثم حذف الخط
      const { error } = await supabase
        .from('lines')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: '✅ تم الحذف', description: `تم حذف الخط ${name}` });
      fetchLines();
    } catch (error) {
      console.error('Error deleting line:', error);
      toast({ title: 'خطأ', description: 'تعذر حذف الخط', variant: 'destructive' });
    }
  };

  // ✅ تغيير حالة الخط
  const toggleStatus = async (line) => {
    try {
      const newStatus = line.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('lines')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', line.id);

      if (error) throw error;
      toast({ title: '✅ تم التحديث', description: `الخط ${line.number} أصبح ${newStatus === 'active' ? 'نشطاً' : 'غير نشط'}` });
      fetchLines();
    } catch (error) {
      toast({ title: 'خطأ', description: 'تعذر تحديث الحالة', variant: 'destructive' });
    }
  };

  if (checking) return <div className="p-8 text-center">جاري التحقق من الصلاحيات...</div>;
  if (!isAdmin) return null;
  if (loading) return <div className="p-8 text-center">جاري تحميل الخطوط...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">🚌 إدارة الخطوط</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة خطوط النقل - العدد: {lines.length}</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ number: '', name_ar: '', name_fr: '', color: '#3B82F6', status: 'active', description_ar: '', description_fr: '' }); setFormOpen(true); }}>
          + إضافة خط
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lines.map((line) => (
          <Card key={line.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: line.color || '#3B82F6' }} />
                  <span className="font-bold text-lg">#{line.number}</span>
                  <Badge variant={line.status === 'active' ? 'default' : 'secondary'}>
                    {line.status === 'active' ? '🟢 نشط' : '🔴 غير نشط'}
                  </Badge>
                </div>
                <div className="mt-2">
                  <div className="font-semibold text-base">{line.name_ar}</div>
                  <div className="text-sm text-muted-foreground">{line.name_fr}</div>
                </div>
                {(line.description_ar || line.description_fr) && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {line.description_ar || line.description_fr}
                  </p>
                )}
              </div>
              <div className="flex gap-1 ml-2">
                <Button variant="ghost" size="sm" onClick={() => toggleStatus(line)}>
                  {line.status === 'active' ? '🔴' : '🟢'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(line); setForm({ number: line.number, name_ar: line.name_ar, name_fr: line.name_fr, color: line.color || '#3B82F6', status: line.status, description_ar: line.description_ar || '', description_fr: line.description_fr || '' }); setFormOpen(true); }}>
                  ✏️
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteLine(line.id, line.name_ar)}>
                  🗑️
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {lines.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-6xl mb-4">🚌</div>
          <p className="text-lg">لا توجد خطوط</p>
          <p className="text-sm">انقر على "إضافة خط" لإنشاء أول خط</p>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '✏️ تعديل الخط' : '➕ إضافة خط جديد'}</DialogTitle>
            <DialogDescription>
              {editing ? 'تعديل بيانات الخط' : 'أدخل بيانات الخط الجديد'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editing && (
              <div>
                <Label>رقم الخط</Label>
                <Input value={form.number} disabled className="bg-muted" />
              </div>
            )}
            <div>
              <Label>الاسم (عربي) *</Label>
              <Input
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                placeholder="اسم الخط بالعربية"
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
            <div>
              <Label>اللون</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <div>
              <Label>الحالة</Label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border rounded-lg p-2"
              >
                <option value="active">🟢 نشط</option>
                <option value="inactive">🔴 غير نشط</option>
              </select>
            </div>
            <div>
              <Label>الوصف (عربي)</Label>
              <Input
                value={form.description_ar}
                onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                placeholder="وصف الخط بالعربية"
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