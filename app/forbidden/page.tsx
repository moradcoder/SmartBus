// app/forbidden/page.tsx - تحسين الصفحة

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldX, Home, User, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  const { locale } = useI18n();
  const { profile } = useAuth();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold text-destructive">403</h1>
        <h2 className="mt-2 text-xl font-semibold">
          {locale === 'ar' ? 'غير مصرح بالدخول' : 'Accès interdit'}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {locale === 'ar' 
            ? 'ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة'
            : 'Vous n\'avez pas les droits nécessaires pour accéder à cette page'
          }
        </p>
        
        {/* ✅ عرض دور المستخدم الحالي */}
        {profile && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <User className="h-4 w-4" />
              {locale === 'ar' ? 'دورك الحالي:' : 'Votre rôle actuel:'}
              <span className="font-semibold text-foreground">
                {profile.role === 'driver' ? (locale === 'ar' ? '🚌 سائق' : '🚌 Chauffeur') :
                 profile.role === 'admin' ? (locale === 'ar' ? '🛡️ مدير' : '🛡️ Admin') :
                 profile.role === 'customer' ? (locale === 'ar' ? '👤 عميل' : '👤 Client') :
                 profile.role}
              </span>
            </p>
            {profile.role === 'customer' && (
              <p className="text-xs text-muted-foreground mt-1">
                {locale === 'ar' 
                  ? '💡 لتتمكن من الوصول إلى لوحة السائق، يجب أن يكون دورك "سائق"'
                  : '💡 Pour accéder au tableau de bord du chauffeur, votre rôle doit être "chauffeur"'}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              {locale === 'ar' ? 'العودة للرئيسية' : 'Retour à l\'accueil'}
            </Button>
          </Link>
          {profile?.role === 'customer' && (
            <Link href="/profile">
              <Button variant="outline" className="gap-2">
                <User className="h-4 w-4" />
                {locale === 'ar' ? 'الملف الشخصي' : 'Profil'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}