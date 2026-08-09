// app/profile/page.tsx - النسخة المصححة
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Save, CheckCircle2, Shield } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    await supabase
      .from('user_profiles')
      .update({ full_name: fullName, phone })
      .eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  if (!profile) {
    return (
      <div className="container mx-auto py-20 text-center text-muted-foreground">
        {locale === 'ar' ? 'يرجى تسجيل الدخول' : 'Veuillez vous connecter'}
      </div>
    );
  }

  const roleLabels: Record<string, { ar: string; fr: string }> = {
    customer: { ar: 'عميل', fr: 'Client' },
    driver: { ar: 'سائق', fr: 'Chauffeur' },
    admin: { ar: 'مدير', fr: 'Administrateur' },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl"
      >
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.full_name || profile.email}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                {roleLabels[profile.role || 'customer']?.[locale] || profile.role}
              </Badge>
            </div>
          </div>
        </div>

        <Card className="glass p-6">
          {/* ✅ رسالة نجاح الحفظ - استخدم نص مباشر */}
          {saved && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {locale === 'ar' ? '✅ تم الحفظ بنجاح' : '✅ Enregistré avec succès'}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="email">{t.auth.email}</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" value={profile.email} disabled className="pl-10 bg-muted/50" />
              </div>
            </div>

            <div>
              <Label htmlFor="fullName">{t.auth.fullName}</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">{t.contact.phone}</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  placeholder="+212..."
                />
              </div>
            </div>

            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {locale === 'ar' ? '💾 حفظ' : '💾 Enregistrer'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}