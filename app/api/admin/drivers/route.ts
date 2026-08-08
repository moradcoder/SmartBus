// app/api/admin/drivers/route.ts - النسخة النهائية
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabase } from '@/lib/supabase/client';

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, license_number, phone, status } = body;

    // التحقق من البيانات
    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'الاسم يجب أن يحتوي على حرفين على الأقل' },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني غير صحيح' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      );
    }

    console.log('📝 Creating/Updating driver:', { name, email });

    // ============================================
    // 1. 🔍 البحث عن المستخدم
    // ============================================
    
    // 1a. البحث في user_profiles
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    let userId: string | null = null;

    if (existingProfile) {
      // ====== المستخدم موجود ======
      userId = existingProfile.id;
      console.log('👤 Profile exists:', { id: userId, role: existingProfile.role });

      // تحديث الدور
      await supabase
        .from('user_profiles')
        .update({
          role: 'driver',
          full_name: name.trim(),
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    } else {
      // ====== 1b. البحث في auth.users ======
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = authUsers?.users?.find(u => u.email === email);

      if (existingAuthUser) {
        // ====== موجود في auth فقط ======
        userId = existingAuthUser.id;
        console.log('👤 Auth user exists:', userId);

        // محاولة إنشاء profile
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: email.trim(),
            full_name: name.trim(),
            phone: phone || null,
            role: 'driver',
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          if (insertError.code === '23505') {
            // 🔑 إذا كان هناك مفتاح مكرر، جلب الـ profile الموجود
            console.log('🔄 Duplicate key, fetching existing profile...');
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            if (profile) {
              console.log('✅ Found existing profile:', profile);
              // تحديث الـ profile الموجود
              await supabase
                .from('user_profiles')
                .update({
                  role: 'driver',
                  full_name: name.trim(),
                  phone: phone || null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', userId);
            } else {
              // إذا لم نجد profile، نحاول إنشاءه باستخدام ON CONFLICT
              // يمكننا استخدام upsert
              const { error: upsertError } = await supabase
                .from('user_profiles')
                .upsert({
                  id: userId,
                  email: email.trim(),
                  full_name: name.trim(),
                  phone: phone || null,
                  role: 'driver',
                  created_at: new Date().toISOString(),
                });

              if (upsertError) {
                console.error('❌ Upsert error:', upsertError);
                return NextResponse.json(
                  { error: 'Erreur upsert: ' + upsertError.message },
                  { status: 500 }
                );
              }
              console.log('✅ Profile upserted successfully');
            }
          } else {
            console.error('❌ Insert error:', insertError);
            return NextResponse.json(
              { error: 'Erreur insert: ' + insertError.message },
              { status: 500 }
            );
          }
        } else {
          console.log('✅ Profile created successfully');
        }

      } else {
        // ====== مستخدم جديد بالكامل ======
        console.log('👤 Creating new user...');
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim(),
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: name.trim(),
            phone: phone || null,
            role: 'driver',
          },
        });

        if (authError) {
          console.error('❌ Auth error:', authError);
          return NextResponse.json(
            { error: authError.message },
            { status: 400 }
          );
        }

        userId = authData.user.id;
        console.log('✅ User created:', userId);

        // 🔑 استخدام upsert لتجنب مشكلة المفتاح المكرر
        const { error: upsertError } = await supabase
          .from('user_profiles')
          .upsert({
            id: userId,
            email: email.trim(),
            full_name: name.trim(),
            phone: phone || null,
            role: 'driver',
            created_at: new Date().toISOString(),
          });

        if (upsertError) {
          console.error('❌ Upsert error:', upsertError);
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return NextResponse.json(
            { error: 'Erreur upsert: ' + upsertError.message },
            { status: 500 }
          );
        }
        console.log('✅ Profile upserted successfully');
      }
    }

    if (!userId) {
      throw new Error('User ID is null!');
    }

    // ============================================
    // 3. 🚌 إنشاء/تحديث السائق
    // ============================================
    
    // البحث عن السائق
    const { data: existingDriver } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let newDriver;

    if (existingDriver) {
      // تحديث سائق موجود
      const { data: updatedDriver, error: updateDriverError } = await supabase
        .from('drivers')
        .update({
          name: name.trim(),
          license_number: license_number || null,
          phone: phone || null,
          status: status || 'off_duty',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDriver.id)
        .select()
        .single();

      if (updateDriverError) {
        console.error('❌ Update driver error:', updateDriverError);
        return NextResponse.json(
          { error: 'Erreur mise à jour chauffeur: ' + updateDriverError.message },
          { status: 500 }
        );
      }
      newDriver = updatedDriver;
    } else {
      // إنشاء سائق جديد
      const { data: createdDriver, error: driverError } = await supabase
        .from('drivers')
        .insert({
          name: name.trim(),
          user_id: userId,
          license_number: license_number || null,
          phone: phone || null,
          status: status || 'off_duty',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (driverError) {
        console.error('❌ Driver creation error:', driverError);
        return NextResponse.json(
          { error: 'Erreur création chauffeur: ' + driverError.message },
          { status: 500 }
        );
      }
      newDriver = createdDriver;
    }

    // ============================================
    // 4. 🔗 ربط driver_id
    // ============================================
    await supabase
      .from('user_profiles')
      .update({
        driver_id: newDriver.id,
        role: 'driver',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // ============================================
    // 5. 🔍 التحقق النهائي
    // ============================================
    const { data: finalProfile } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, driver_id, created_at')
      .eq('id', userId)
      .single();

    console.log('✅ Final profile:', finalProfile);

    return NextResponse.json({
      success: true,
      driver: newDriver,
      profile: finalProfile,
      message: 'تم إضافة السائق بنجاح'
    });

  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'حدث خطأ أثناء إضافة السائق',
        details: error.stack
      },
      { status: 500 }
    );
  }
}