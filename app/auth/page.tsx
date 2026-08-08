// app/auth/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bus, Mail, Lock, User, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AuthPage() {
  const { t, locale, dir } = useI18n();
  const { signIn, signUp, profile } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  // ✅ التحقق من وجود ملف تعريف وتوجيه المستخدم
  const redirectBasedOnRole = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      const role = profile?.role || 'customer';
      
      if (role === 'admin' || role === 'super_admin') {
        router.push('/admin');
      } else if (role === 'driver') {
        router.push('/driver');
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error fetching role:', error);
      router.push('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        // ✅ تسجيل الدخول
        await signIn(email, password);
        
        // ✅ الحصول على المستخدم الحالي
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          await redirectBasedOnRole(session.user.id);
        } else {
          router.push('/');
        }
      } else {
        // ✅ تسجيل مستخدم جديد
        await signUp(email, password, fullName);
        
        // ✅ الحصول على المستخدم الجديد
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          // ✅ إنشاء ملف تعريف للمستخدم الجديد
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: session.user.id,
              email: email,
              full_name: fullName,
              role: 'customer',
            });

          if (profileError) {
            console.error('Error creating profile:', profileError);
          }

          router.push('/');
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      
      // ✅ رسائل خطأ مفهومة
      if (err.message?.includes('Invalid login credentials')) {
        setError(t.auth?.invalidCreds || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (err.message?.includes('User already registered')) {
        setError(t.auth?.emailExists || 'هذا البريد الإلكتروني مسجل بالفعل');
      } else {
        setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Bus className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">SmartBus</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'signin' ? t.auth?.welcomeBack || 'مرحباً بعودتك' : t.auth?.joinUs || 'انضم إلينا'}
          </p>
        </div>

        <Card className="glass p-6 shadow-xl">
          <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                mode === 'signin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t.auth?.signInTitle || 'تسجيل الدخول'}
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t.auth?.signUpTitle || 'إنشاء حساب'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label htmlFor="fullName">{t.auth?.fullName || 'الاسم الكامل'}</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    placeholder={t.auth?.fullName || 'الاسم الكامل'}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="email">{t.auth?.email || 'البريد الإلكتروني'}</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder={t.auth?.email || 'admin@smartbus.ma'}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">{t.auth?.password || 'كلمة المرور'}</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder={t.auth?.password || '••••••••'}
                />
              </div>
            </div>

            {mode === 'signin' && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {locale === 'ar' ? 'نسيت كلمة المرور؟' : 'Mot de passe oublié ?'}
                </Link>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full gap-2">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  {mode === 'signin' ? (t.auth?.signingIn || 'جاري تسجيل الدخول...') : (t.auth?.signingUp || 'جاري إنشاء الحساب...')}
                </span>
              ) : (
                <>
                  {mode === 'signin' ? (t.auth?.signIn || 'تسجيل الدخول') : (t.auth?.signUp || 'إنشاء حساب')}
                  <Arrow className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'signin' ? (t.auth?.noAccount || 'ليس لديك حساب؟') : (t.auth?.haveAccount || 'لديك حساب بالفعل؟')}{' '}
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="font-medium text-primary hover:underline"
            >
              {mode === 'signin' ? (t.auth?.createAccount || 'إنشاء حساب') : (t.auth?.loginInstead || 'تسجيل الدخول')}
            </button>
          </div>
        </Card>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          {locale === 'ar' ? 'محمي بنظام تحكم في الصلاحيات حسب الأدوار' : 'Protégé par contrôle d\'accès basé sur les rôles'}
        </div>
      </motion.div>
    </div>
  );
}