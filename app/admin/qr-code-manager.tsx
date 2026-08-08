// components/admin/qr-code-manager.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  QrCode, Download, Copy, RefreshCw, Eye, EyeOff, 
  Trash2, Plus, Calendar, Users, Bus, MapPin, User
} from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QRCode {
  id: string;
  code: string;
  type: string;
  target_id: string;
  target_type: string;
  data: any;
  version: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  scanned_count: number;
  last_scanned_at: string | null;
  target_name?: string;
}

export function QRCodeManager() {
  const { locale } = useI18n();
  const { toast } = useToast();
  
  const [qrCodes, setQRCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QRCode | null>(null);
  
  const [generateForm, setGenerateForm] = useState({
    type: 'bus',
    target_id: '',
    expires_days: 30,
  });
  
  const [availableBuses, setAvailableBuses] = useState<any[]>([]);
  const [availableStations, setAvailableStations] = useState<any[]>([]);
  const [availableLines, setAvailableLines] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);

  useEffect(() => {
    fetchQRCodes();
    fetchAvailableTargets();
  }, []);

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('qr_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const qrs = data as QRCode[];
      for (const qr of qrs) {
        const targetName = await fetchTargetName(qr.target_type, qr.target_id);
        qr.target_name = targetName;
      }

      setQRCodes(qrs);
    } catch (error) {
      console.error('Error fetching QR codes:', error);
      toast({
        title: locale === 'ar' ? 'خطأ في التحميل' : 'Erreur de chargement',
        description: locale === 'ar' ? 'تعذر تحميل رموز QR' : 'Impossible de charger les codes QR',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTargetName = async (type: string, id: string): Promise<string> => {
    try {
      let table = '';
      let nameField = '';
      
      switch (type) {
        case 'bus':
          table = 'buses';
          nameField = 'plate';
          break;
        case 'station':
          table = 'stations';
          nameField = locale === 'ar' ? 'name_ar' : 'name_fr';
          break;
        case 'line':
          table = 'lines';
          nameField = 'number';
          break;
        case 'driver':
          table = 'drivers';
          nameField = 'name';
          break;
        default:
          return 'Unknown';
      }

      const { data, error } = await supabase
        .from(table)
        .select(nameField)
        .eq('id', id)
        .single();

      if (error || !data) return 'Unknown';
      return data[nameField] || 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  const fetchAvailableTargets = async () => {
    try {
      const [busesRes, stationsRes, linesRes, driversRes] = await Promise.all([
        supabase.from('buses').select('id, plate, model').order('plate'),
        supabase.from('stations').select('id, name_ar, name_fr').order('name_fr'),
        supabase.from('lines').select('id, number, name_ar, name_fr').order('number'),
        supabase.from('drivers').select('id, name').order('name'),
      ]);

      setAvailableBuses(busesRes.data || []);
      setAvailableStations(stationsRes.data || []);
      setAvailableLines(linesRes.data || []);
      setAvailableDrivers(driversRes.data || []);
    } catch (error) {
      console.error('Error fetching targets:', error);
    }
  };

  const generateQR = async () => {
    if (!generateForm.target_id) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'الرجاء اختيار الهدف' : 'Veuillez sélectionner une cible',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const code = `QR-${generateForm.type.toUpperCase()}-${generateForm.target_id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
      const expiresAt = generateForm.expires_days > 0 
        ? new Date(Date.now() + generateForm.expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Deactivate old QR codes for this target
      await supabase
        .from('qr_codes')
        .update({ is_active: false })
        .eq('target_id', generateForm.target_id)
        .eq('target_type', generateForm.type);

      const { data, error } = await supabase
        .from('qr_codes')
        .insert({
          code,
          type: generateForm.type,
          target_id: generateForm.target_id,
          target_type: generateForm.type,
          data: { generated_by: 'admin', version: 1 },
          version: 1,
          is_active: true,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) throw error;

      const newQR = data as QRCode;
      newQR.target_name = await fetchTargetName(newQR.target_type, newQR.target_id);

      setQRCodes([newQR, ...qrCodes]);
      
      toast({
        title: locale === 'ar' ? 'تم إنشاء QR' : 'QR créé',
        description: locale === 'ar' ? 'تم إنشاء رمز QR بنجاح' : 'Code QR créé avec succès',
      });

      setGenerateDialogOpen(false);
      setGenerateForm({ type: 'bus', target_id: '', expires_days: 30 });
      
      // Generate QR image using simple method
      try {
        const qrCodeModule = await import('qrcode');
        const qrString = JSON.stringify({
          id: newQR.id,
          code: newQR.code,
          type: newQR.type,
          targetId: newQR.target_id,
        });
        
        const imageUrl = await qrCodeModule.default.toDataURL(qrString, {
          width: 400,
          margin: 2,
          color: { dark: '#0ea5e9', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        });
        
        setQrImageUrl(imageUrl);
        setSelectedQR(newQR);
        setShowQRDialog(true);
      } catch (qrError) {
        console.error('Error generating QR image:', qrError);
        setSelectedQR(newQR);
        setShowQRDialog(true);
      }
    } catch (error) {
      console.error('Error generating QR:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر إنشاء رمز QR' : 'Impossible de créer le code QR',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const showQRCode = async (qr: QRCode) => {
    try {
      const qrString = JSON.stringify({
        id: qr.id,
        code: qr.code,
        type: qr.type,
        targetId: qr.target_id,
        targetType: qr.target_type,
        version: qr.version,
        expiresAt: qr.expires_at,
      });
      
      const qrCodeModule = await import('qrcode');
      const imageUrl = await qrCodeModule.default.toDataURL(qrString, {
        width: 400,
        margin: 2,
        color: { dark: '#0ea5e9', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });

      setQrImageUrl(imageUrl);
      setSelectedQR(qr);
      setShowQRDialog(true);
    } catch (error) {
      console.error('Error generating QR image:', error);
      setSelectedQR(qr);
      setShowQRDialog(true);
    }
  };

  const deleteQR = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('qr_codes')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      setQRCodes(qrCodes.filter(q => q.id !== deleteTarget.id));
      
      toast({
        title: locale === 'ar' ? 'تم الحذف' : 'Supprimé',
        description: locale === 'ar' ? 'تم حذف رمز QR' : 'Code QR supprimé',
      });
      
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting QR:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر حذف رمز QR' : 'Impossible de supprimer le code QR',
        variant: 'destructive',
      });
    }
  };

  const toggleQRStatus = async (qr: QRCode) => {
    try {
      const { error } = await supabase
        .from('qr_codes')
        .update({ is_active: !qr.is_active })
        .eq('id', qr.id);
      if (error) throw error;

      setQRCodes(qrCodes.map(q => 
        q.id === qr.id ? { ...q, is_active: !q.is_active } : q
      ));

      toast({
        title: locale === 'ar' ? 'تم التحديث' : 'Mis à jour',
        description: qr.is_active 
          ? (locale === 'ar' ? 'تم تعطيل QR' : 'QR désactivé')
          : (locale === 'ar' ? 'تم تفعيل QR' : 'QR activé'),
      });
    } catch (error) {
      console.error('Error toggling QR status:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر تحديث الحالة' : 'Impossible de mettre à jour le statut',
        variant: 'destructive',
      });
    }
  };

  const downloadQR = () => {
    if (!qrImageUrl) return;
    const link = document.createElement('a');
    link.download = `qr-${selectedQR?.code || 'code'}.png`;
    link.href = qrImageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyQRData = () => {
    if (!selectedQR) return;
    const qrData = {
      id: selectedQR.id,
      code: selectedQR.code,
      type: selectedQR.type,
      targetId: selectedQR.target_id,
      targetType: selectedQR.target_type,
      version: selectedQR.version,
      expiresAt: selectedQR.expires_at,
      data: selectedQR.data,
    };
    const qrString = JSON.stringify(qrData);
    navigator.clipboard.writeText(qrString);
    toast({
      title: locale === 'ar' ? 'تم النسخ' : 'Copié',
      description: locale === 'ar' ? 'تم نسخ بيانات QR' : 'Données QR copiées',
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, { ar: string; fr: string; icon: any }> = {
      bus: { ar: 'حافلة', fr: 'Bus', icon: Bus },
      station: { ar: 'محطة', fr: 'Station', icon: MapPin },
      line: { ar: 'خط', fr: 'Ligne', icon: MapPin },
      driver: { ar: 'سائق', fr: 'Chauffeur', icon: User },
    };
    return labels[type] || { ar: type, fr: type, icon: QrCode };
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          {locale === 'ar' ? 'رموز QR' : 'Codes QR'}
          <Badge variant="secondary" className="ml-2">
            {qrCodes.length}
          </Badge>
        </h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchQRCodes}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setGenerateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {locale === 'ar' ? 'إنشاء QR' : 'Générer QR'}
          </Button>
        </div>
      </div>

      {qrCodes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <QrCode className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-2">
            {locale === 'ar' ? 'لا توجد رموز QR' : 'Aucun code QR'}
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setGenerateDialogOpen(true)}
          >
            {locale === 'ar' ? 'إنشاء أول رمز QR' : 'Créer le premier code QR'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => {
            const typeInfo = getTypeLabel(qr.type);
            const Icon = typeInfo.icon;
            const isExpired = qr.expires_at && new Date(qr.expires_at) < new Date();
            const isActive = qr.is_active && !isExpired;

            return (
              <Card key={qr.id} className={`p-4 transition-all hover:shadow-lg ${!isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">
                        {qr.target_name || qr.target_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {locale === 'ar' ? typeInfo.ar : typeInfo.fr}
                      </div>
                    </div>
                  </div>
                  <Badge variant={isActive ? 'default' : 'destructive'}>
                    {isActive 
                      ? (locale === 'ar' ? 'نشط' : 'Actif')
                      : (isExpired ? (locale === 'ar' ? 'منتهي' : 'Expiré') : (locale === 'ar' ? 'غير نشط' : 'Inactif'))}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(qr.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                  </span>
                  {qr.scanned_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {qr.scanned_count}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => showQRCode(qr)}
                  >
                    <Eye className="h-3 w-3" />
                    {locale === 'ar' ? 'عرض' : 'Voir'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => toggleQRStatus(qr)}
                  >
                    {qr.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {qr.is_active 
                      ? (locale === 'ar' ? 'تعطيل' : 'Désactiver')
                      : (locale === 'ar' ? 'تفعيل' : 'Activer')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={() => {
                      setDeleteTarget(qr);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locale === 'ar' ? 'إنشاء رمز QR جديد' : 'Générer un nouveau code QR'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'ar' 
                ? 'سيتم تعطيل الرموز القديمة تلقائياً' 
                : 'Les anciens codes seront automatiquement désactivés'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{locale === 'ar' ? 'النوع' : 'Type'}</Label>
              <Select
                value={generateForm.type}
                onValueChange={(value) => setGenerateForm({ ...generateForm, type: value, target_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bus">{locale === 'ar' ? 'حافلة' : 'Bus'}</SelectItem>
                  <SelectItem value="station">{locale === 'ar' ? 'محطة' : 'Station'}</SelectItem>
                  <SelectItem value="line">{locale === 'ar' ? 'خط' : 'Ligne'}</SelectItem>
                  <SelectItem value="driver">{locale === 'ar' ? 'سائق' : 'Chauffeur'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{locale === 'ar' ? 'الهدف' : 'Cible'}</Label>
              <Select
                value={generateForm.target_id}
                onValueChange={(value) => setGenerateForm({ ...generateForm, target_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={locale === 'ar' ? 'اختر هدف' : 'Choisir une cible'} />
                </SelectTrigger>
                <SelectContent>
                  {generateForm.type === 'bus' && availableBuses.map((bus) => (
                    <SelectItem key={bus.id} value={bus.id}>
                      {bus.plate} {bus.model ? `(${bus.model})` : ''}
                    </SelectItem>
                  ))}
                  {generateForm.type === 'station' && availableStations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {locale === 'ar' ? station.name_ar : station.name_fr}
                    </SelectItem>
                  ))}
                  {generateForm.type === 'line' && availableLines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.number} - {locale === 'ar' ? line.name_ar : line.name_fr}
                    </SelectItem>
                  ))}
                  {generateForm.type === 'driver' && availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{locale === 'ar' ? 'مدة الصلاحية (أيام)' : 'Durée de validité (jours)'}</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={generateForm.expires_days}
                onChange={(e) => setGenerateForm({ ...generateForm, expires_days: Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {locale === 'ar' ? '0 = لا تنتهي أبداً' : '0 = n\'expire jamais'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button onClick={generateQR} disabled={generating}>
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  {locale === 'ar' ? 'جاري الإنشاء...' : 'Génération...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  {locale === 'ar' ? 'إنشاء' : 'Générer'}
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show QR Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {locale === 'ar' ? 'رمز QR' : 'Code QR'}
              {selectedQR && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {selectedQR.target_name || selectedQR.target_id.slice(0, 8)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrImageUrl ? (
              <div className="relative">
                <img
                  src={qrImageUrl}
                  alt="QR Code"
                  className="h-64 w-64 rounded-lg border"
                />
                {selectedQR && !selectedQR.is_active && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                    <Badge variant="destructive" className="text-lg">
                      {locale === 'ar' ? 'غير نشط' : 'Inactif'}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border bg-muted/20">
                <QrCode className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
            
            {selectedQR && (
              <div className="mt-4 w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'الكود' : 'Code'}</span>
                  <span className="font-mono">{selectedQR.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'النوع' : 'Type'}</span>
                  <span>{getTypeLabel(selectedQR.type)[locale === 'ar' ? 'ar' : 'fr']}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'النسخة' : 'Version'}</span>
                  <span>v{selectedQR.version}</span>
                </div>
                {selectedQR.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{locale === 'ar' ? 'تنتهي في' : 'Expire le'}</span>
                    <span>{new Date(selectedQR.expires_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{locale === 'ar' ? 'عدد المسح' : 'Scans'}</span>
                  <span>{selectedQR.scanned_count}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={copyQRData} className="gap-2">
              <Copy className="h-4 w-4" />
              {locale === 'ar' ? 'نسخ البيانات' : 'Copier les données'}
            </Button>
            {qrImageUrl && (
              <Button variant="outline" onClick={downloadQR} className="gap-2">
                <Download className="h-4 w-4" />
                {locale === 'ar' ? 'تحميل' : 'Télécharger'}
              </Button>
            )}
            <Button onClick={() => setShowQRDialog(false)}>
              {locale === 'ar' ? 'إغلاق' : 'Fermer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{locale === 'ar' ? 'تأكيد الحذف' : 'Confirmation'}</DialogTitle>
            <DialogDescription>
              {locale === 'ar' 
                ? `هل أنت متأكد من حذف رمز QR لـ "${deleteTarget?.target_name || deleteTarget?.target_id}"؟`
                : `Êtes-vous sûr de vouloir supprimer le code QR pour "${deleteTarget?.target_name || deleteTarget?.target_id}" ?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {locale === 'ar' ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button variant="destructive" onClick={deleteQR}>
              {locale === 'ar' ? 'حذف' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}