'use client';

import Link from 'next/link';
import { Bus, Mail, Phone, MapPin } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

export function Footer() {
  const { t, locale } = useI18n();

  return (
    <footer className="border-t border-border/40 bg-card/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bus className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold">SmartBus</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {locale === 'ar'
                ? 'منصة ذكية لإدارة وتتبع النقل الحضري'
                : 'Plateforme intelligente de gestion du transport urbain'}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t.nav.home}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/map" className="hover:text-primary transition-colors">{t.nav.map}</Link></li>
              <li><Link href="/lines" className="hover:text-primary transition-colors">{t.nav.lines}</Link></li>
              <li><Link href="/stations" className="hover:text-primary transition-colors">{t.nav.stations}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{locale === 'ar' ? 'روابط' : 'Liens'}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/news" className="hover:text-primary transition-colors">{t.nav.news}</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors">{t.nav.about}</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors">{t.nav.contact}</Link></li>
              <li><Link href="/admin" className="hover:text-primary transition-colors">{t.nav.admin}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t.contact.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {locale === 'ar' ? 'ورزازات، المغرب' : 'Ouarzazate, Maroc'}</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> 0628708074</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> contact@smartbus.ma</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SmartBus — {locale === 'ar' ? 'جميع الحقوق محفوظة' : 'Tous droits réservés'}
        </div>
      </div>
    </footer>
  );
}
