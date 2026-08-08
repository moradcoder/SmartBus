// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPasswordPage() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSent(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        if (error.message.includes('not found')) {
          toast({
            title: locale === 'ar' ? 'خطأ' : 'Erreur',
            description: locale === 'ar' ? 'لا يوجد حساب بهذا البريد الإلكتروني' : 'Aucun compte avec cet email',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
      } else {
        setSent(true);
        toast({
          title: locale === 'ar' ? '✅ تم الإرسال' : '✅ Envoyé',
          description: locale === 'ar' 
            ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
            : 'Un lien de réinitialisation a été envoyé à votre email',
        });
      }
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Erreur',
        description: locale === 'ar' ? 'تعذر إرسال رابط إعادة التعيين' : 'Impossible d\'envoyer le lien de réinitialisation',
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
            {locale === 'ar' ? 'نسيت كلمة المرور' : 'Mot de passe oublié'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {locale === 'ar' 
              ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين'
              : 'Entrez votre email et nous vous enverrons un lien de réinitialisation'}
          </p>
        </div>

        <Card className="glass p-6 shadow-xl">
          {sent ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-16 w-16 text-success animate-bounce" />
              <h3 className="mt-4 text-lg font-semibold">
                {locale === 'ar' ? 'تم الإرسال!' : 'Envoyé !'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {locale === 'ar'
                  ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
                  : 'Un lien de réinitialisation a été envoyé à votre email'}
              </p>
              <Link href="/login">
                <Button variant="link" className="mt-4">
                  {locale === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Retour à la connexion'}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t.auth.email}</Label>
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
                    placeholder={t.auth.email}
                  />
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full gap-2">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {locale === 'ar' ? 'جاري الإرسال...' : 'Envoi...'}
                  </span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {locale === 'ar' ? 'إرسال رابط التعيين' : 'Envoyer le lien'}
                  </>
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