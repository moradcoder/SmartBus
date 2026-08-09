// lib/withAuth.tsx - نسخة محسنة

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase/client';
import { Loader2 } from 'lucide-react';

type AllowedRoles = 'admin' | 'super_admin' | 'driver' | 'customer';

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: AllowedRoles[] = ['admin', 'super_admin']
) {
  return function ProtectedPage(props: P) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
      const checkAuth = async () => {
        try {
          // 1. التحقق من وجود مستخدم
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) {
            router.push('/auth');
            return;
          }

          // 2. جلب دور المستخدم
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('role, driver_id')
            .eq('id', user.id)
            .maybeSingle();

          if (error) {
            console.error('❌ Error fetching profile:', error);
            router.push('/auth');
            return;
          }

          if (!profile) {
            console.error('❌ No profile found for user:', user.id);
            router.push('/auth');
            return;
          }

          console.log('👤 User role:', profile.role);
          console.log('🔑 Allowed roles:', allowedRoles);
          setUserRole(profile.role);

          // 3. التحقق من الصلاحيات
          const isAuthorized = allowedRoles.includes(profile.role);
          
          // ✅ حالة خاصة: إذا كان السائق وليس لديه driver_id
          if (profile.role === 'driver' && !profile.driver_id) {
            console.warn('⚠️ Driver has no driver_id, redirecting to profile');
            router.push('/profile');
            return;
          }

          if (isAuthorized) {
            setAuthorized(true);
          } else {
            // ✅ توجيه المستخدم إلى صفحة ممنوع الدخول مع معلومات
            router.push('/forbidden');
          }
        } catch (error) {
          console.error('❌ Auth check error:', error);
          router.push('/auth');
        } finally {
          setLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">جاري التحقق من الصلاحيات...</p>
          </div>
        </div>
      );
    }

    if (!authorized) {
      return null;
    }

    return <Component {...props} />;
  };
}