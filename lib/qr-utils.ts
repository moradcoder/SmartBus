// lib/qr-utils.ts
import QRCode from 'qrcode';

export interface QRCodeData {
  id: string;
  code: string;
  type: 'bus' | 'station' | 'route' | 'driver';
  targetId: string;
  targetType: string;
  version: number;
  timestamp: string;
  expiresAt?: string;
  data?: Record<string, any>;
}

export function generateQRCodeData(params: {
  id: string;
  code: string;
  type: 'bus' | 'station' | 'route' | 'driver';
  targetId: string;
  targetType: string;
  version: number;
  expiresAt?: string;
  data?: Record<string, any>;
}): QRCodeData {
  return {
    id: params.id,
    code: params.code,
    type: params.type,
    targetId: params.targetId,
    targetType: params.targetType,
    version: params.version,
    timestamp: new Date().toISOString(),
    expiresAt: params.expiresAt,
    data: params.data,
  };
}

export function generateQRCodeString(data: QRCodeData): string {
  return JSON.stringify(data);
}

export function decodeQRCodeString(qrString: string): QRCodeData | null {
  try {
    return JSON.parse(qrString);
  } catch {
    return null;
  }
}

export async function generateQRImage(data: QRCodeData, options?: {
  width?: number;
  margin?: number;
  color?: { dark?: string; light?: string };
}): Promise<string> {
  const qrString = generateQRCodeString(data);
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(qrString, {
      width: options?.width || 300,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || '#0ea5e9',
        light: options?.color?.light || '#ffffff',
      },
      errorCorrectionLevel: 'H',
    }, (err, url) => {
      if (err) reject(err);
      else resolve(url);
    });
  });
}

export function validateQRCode(data: QRCodeData): { valid: boolean; message?: string } {
  if (!data.id || !data.code || !data.targetId) {
    return { valid: false, message: 'Invalid QR code data' };
  }
  if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
    return { valid: false, message: 'QR code has expired' };
  }
  return { valid: true };
}

export function generateQRCodeStringSimple(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H',
    }, (err, url) => {
      if (err) reject(err);
      else resolve(url);
    });
  });
}