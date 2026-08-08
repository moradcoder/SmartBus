// components/qr-scanner.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useI18n } from '@/lib/i18n-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, X, QrCode, AlertCircle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess?: (data: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

export function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scannerRef.current) return;
    const html5QrCode = new Html5Qrcode(scannerRef.current);
    setScanner(html5QrCode);
    return () => {
      if (html5QrCode) {
        html5QrCode.stop().catch(console.error);
        html5QrCode.clear();
      }
    };
  }, []);

  const startScanning = async () => {
    if (!scanner) return;
    setError(null);
    setScanning(true);

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.id && data.code && data.targetId) {
              await scanner.stop();
              setScanning(false);
              if (onScanSuccess) onScanSuccess(data);
            } else {
              setError(locale === 'ar' ? 'رمز QR غير صالح' : 'Code QR invalide');
              toast({
                title: locale === 'ar' ? 'خطأ' : 'Erreur',
                description: locale === 'ar' ? 'رمز QR غير صالح' : 'Code QR invalide',
                variant: 'destructive',
              });
            }
          } catch {
            setError(locale === 'ar' ? 'بيانات QR غير صالحة' : 'Données QR invalides');
          }
        },
        (errorMessage) => {
          if (errorMessage.includes('No QR code found')) return;
          console.warn('QR scan error:', errorMessage);
        }
      );
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError(locale === 'ar' ? 'تعذر الوصول إلى الكاميرا' : 'Impossible d\'accéder à la caméra');
      setScanning(false);
      if (onScanError) onScanError(locale === 'ar' ? 'خطأ في الكاميرا' : 'Erreur de caméra');
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try { await scanner.stop(); } catch {}
    }
    setScanning(false);
    if (onClose) onClose();
  };

  return (
    <Card className="glass p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          {locale === 'ar' ? 'مسح QR' : 'Scanner QR'}
        </h3>
        <Button variant="ghost" size="icon" onClick={stopScanning}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        <div ref={scannerRef} className="aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden bg-black" />
        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button onClick={startScanning} className="gap-2">
              <Camera className="h-4 w-4" />
              {locale === 'ar' ? 'بدء المسح' : 'Commencer le scan'}
            </Button>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-lg">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-2 text-white text-center px-4">{error}</p>
            <Button onClick={() => setError(null)} className="mt-4">
              {locale === 'ar' ? 'إعادة المحاولة' : 'Réessayer'}
            </Button>
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-primary rounded-lg">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}