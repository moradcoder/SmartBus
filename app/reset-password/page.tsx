// app/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function ResetPasswordPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // التحقق من وجود token في الرابط
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: locale === 'ar' ? 'خطأ' : 'Erreur',
          description: locale === 'ar' ? 'رابط إعادة التعيين غير صالح' : 'Lien de réinitialisation invalide',
          variant: 'destructive',
        });
        router.push('/login');
      }
    };
    checkSession();
  }, [router, locale, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Le mot de passe doit contenir au moins 6 caractères',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'كلمات المرور غير متطابقة' : 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setDone(true);
      toast({
        title: locale === 'ar' ? '✅ تم التحديث' : '✅ Mis à jour',
        description: locale === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Mot de passe changé avec succès',
      });
      
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر تغيير كلمة المرور' : 'Impossible de changer le mot de passe',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-transparent to-primary/10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">
            {locale === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Réinitialiser le mot de passe'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {locale === 'ar' 
              ? 'أدخل كلمة المرور الجديدة'
              : 'Entrez votre nouveau mot de passe'}
          </p>
        </div>

        <Card className="glass p-6 shadow-xl">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-16 w-16 text-success animate-bounce" />
              <h3 className="mt-4 text-lg font-semibold">
                {locale === 'ar' ? 'تم التحديث!' : 'Mis à jour !'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {locale === 'ar'
                  ? 'تم تغيير كلمة المرور بنجاح. سيتم توجيهك إلى صفحة تسجيل الدخول...'
                  : 'Mot de passe changé avec succès. Vous serez redirigé vers la page de connexion...'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">{locale === 'ar' ? 'كلمة المرور الجديدة' : 'Nouveau mot de passe'}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    placeholder={locale === 'ar' ? 'كلمة المرور الجديدة' : 'Nouveau mot de passe'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">{locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirmer le mot de passe'}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    placeholder={locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirmer le mot de passe'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full gap-2">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {locale === 'ar' ? 'جاري التحديث...' : 'Mise à jour...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {locale === 'ar' ? 'تغيير كلمة المرور' : 'Changer le mot de passe'}
                  </span>
                )}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              {locale === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Retour à la connexion'}
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}