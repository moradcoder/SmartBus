// app/api/qr/scan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const { qrData } = await request.json();
    
    if (!qrData || !qrData.id) {
      return NextResponse.json(
        { error: 'Invalid QR data' },
        { status: 400 }
      );
    }

    const { data: qrCode, error: updateError } = await supabase
      .from('qr_codes')
      .update({
        scanned_count: supabase.rpc('increment', { row_id: qrData.id }),
        last_scanned_at: new Date().toISOString(),
      })
      .eq('id', qrData.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating scan count:', updateError);
    }

    await supabase
      .from('qr_scan_logs')
      .insert({
        qr_code_id: qrData.id,
        scanner_type: 'web',
        scan_data: qrData,
        ip_address: request.headers.get('x-forwarded-for') || request.ip,
        user_agent: request.headers.get('user-agent'),
      });

    return NextResponse.json({ success: true, qrCode });
  } catch (error) {
    console.error('Error processing QR scan:', error);
    return NextResponse.json(
      { error: 'Failed to process scan' },
      { status: 500 }
    );
  }
}