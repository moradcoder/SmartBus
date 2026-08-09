// app/api/admin/drivers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabase } from '@/lib/supabase/client';

// ============================================
// TYPES
// ============================================
interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    phone?: string;
    role?: string;
  };
  created_at?: string;
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone);
}

// ============================================
// API ROUTE - POST
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, license_number, phone, status } = body;

    // ============================================
    // 1. ✅ VALIDATION DES DONNÉES
    // ============================================
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

    if (phone && !isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'رقم الهاتف غير صحيح' },
        { status: 400 }
      );
    }

    console.log('📝 Creating/Updating driver:', { name, email });

    // ============================================
    // 2. 🔍 RECHERCHE DE L'UTILISATEUR
    // ============================================
    let userId: string | null = null;

    // 2a. Recherche dans user_profiles
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
      console.log('👤 Profile exists:', { id: userId, role: existingProfile.role });

      const { error: updateProfileError } = await supabase
        .from('user_profiles')
        .update({
          role: 'driver',
          full_name: name.trim(),
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateProfileError) {
        console.error('❌ Update profile error:', updateProfileError);
        return NextResponse.json(
          { error: 'Erreur mise à jour profil: ' + updateProfileError.message },
          { status: 500 }
        );
      }
      console.log('✅ Profile updated successfully');
    }

    // 2b. Recherche dans auth.users
    if (!userId) {
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        console.error('❌ Auth list error:', listError);
        return NextResponse.json(
          { error: 'Erreur liste auth: ' + listError.message },
          { status: 500 }
        );
      }

      const users = (authUsers?.users as AuthUser[]) || [];
      const existingAuthUser = users.find((u: AuthUser) => u.email === email);

      if (existingAuthUser) {
        userId = existingAuthUser.id;
        console.log('👤 Auth user exists:', userId);

        const { error: insertProfileError } = await supabase
          .from('user_profiles')
          .upsert({
            id: userId,
            email: email.trim(),
            full_name: name.trim(),
            phone: phone || null,
            role: 'driver',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertProfileError) {
          console.error('❌ Insert profile error:', insertProfileError);
          return NextResponse.json(
            { error: 'Erreur création profil: ' + insertProfileError.message },
            { status: 500 }
          );
        }
        console.log('✅ Profile created successfully');
      }
    }

    // 2c. Création d'un nouvel utilisateur
    if (!userId) {
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
        console.error('❌ Auth create error:', authError);
        return NextResponse.json(
          { error: authError.message },
          { status: 400 }
        );
      }

      if (!authData?.user) {
        return NextResponse.json(
          { error: 'فشل إنشاء المستخدم' },
          { status: 500 }
        );
      }

      userId = authData.user.id;
      console.log('✅ User created:', userId);

      const { error: insertProfileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          email: email.trim(),
          full_name: name.trim(),
          phone: phone || null,
          role: 'driver',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertProfileError) {
        console.error('❌ Insert profile error:', insertProfileError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: 'Erreur création profil: ' + insertProfileError.message },
          { status: 500 }
        );
      }
      console.log('✅ Profile created successfully');
    }

    // ============================================
    // 3. 🚌 GESTION DU CHAUFFEUR
    // ============================================
    if (!userId) {
      throw new Error('❌ User ID is null!');
    }

    const { data: existingDriver } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let driver;

    if (existingDriver) {
      console.log('🚌 Updating existing driver:', existingDriver.id);
      
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
      driver = updatedDriver;
      console.log('✅ Driver updated successfully');

    } else {
      console.log('🚌 Creating new driver...');
      
      const { data: newDriver, error: createDriverError } = await supabase
        .from('drivers')
        .insert({
          name: name.trim(),
          user_id: userId,
          license_number: license_number || null,
          phone: phone || null,
          status: status || 'off_duty',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createDriverError) {
        console.error('❌ Create driver error:', createDriverError);
        return NextResponse.json(
          { error: 'Erreur création chauffeur: ' + createDriverError.message },
          { status: 500 }
        );
      }
      driver = newDriver;
      console.log('✅ Driver created successfully');
    }

    // ============================================
    // 4. 🔗 MISE À JOUR DU LIEN driver_id
    // ============================================
    if (driver) {
      await supabase
        .from('user_profiles')
        .update({
          driver_id: driver.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      console.log('✅ Profile linked to driver');
    }

    // ============================================
    // 5. 📤 RÉPONSE
    // ============================================
    return NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        user_id: driver.user_id,
        license_number: driver.license_number,
        phone: driver.phone,
        status: driver.status,
        created_at: driver.created_at,
        updated_at: driver.updated_at,
      },
      message: existingDriver 
        ? 'تم تحديث السائق بنجاح' 
        : 'تم إضافة السائق بنجاح'
    });

  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'حدث خطأ أثناء إضافة السائق',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// ============================================
// API ROUTE - GET
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (id) {
      const { data: driver, error } = await supabase
        .from('drivers')
        .select('*, user_profiles(*)')
        .eq('id', id)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Chauffeur non trouvé' },
          { status: 404 }
        );
      }

      return NextResponse.json({ driver });
    }

    if (email) {
      const { data: driver, error } = await supabase
        .from('drivers')
        .select('*, user_profiles(*)')
        .eq('user_profiles.email', email)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Chauffeur non trouvé' },
          { status: 404 }
        );
      }

      return NextResponse.json({ driver });
    }

    const { data: drivers, error } = await supabase
      .from('drivers')
      .select('*, user_profiles(*)')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erreur récupération chauffeurs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ drivers });

  } catch (error: any) {
    console.error('❌ GET Error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

// ============================================
// API ROUTE - DELETE
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID du chauffeur requis' },
        { status: 400 }
      );
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('user_id')
      .eq('id', id)
      .single();

    const { error: deleteDriverError } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);

    if (deleteDriverError) {
      return NextResponse.json(
        { error: 'Erreur suppression chauffeur' },
        { status: 500 }
      );
    }

    if (driver?.user_id) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(driver.user_id);
        console.log('✅ Auth user deleted:', driver.user_id);
      } catch (authError) {
        console.warn('⚠️ Could not delete auth user:', driver.user_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Chauffeur supprimé avec succès'
    });

  } catch (error: any) {
    console.error('❌ DELETE Error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}