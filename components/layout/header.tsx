// components/layout/header.tsx - تحديث القسم

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Menu, X, Moon, Sun, Globe, MapPin, Route, Newspaper, Phone, Info, LayoutDashboard, User, LogOut, LogIn, Car } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useI18n } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Header() {
  const { t, locale, setLocale, dir } = useI18n();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const role = profile?.role;

  // ✅ عناصر القائمة حسب الدور
  const navItems = [
    { href: '/', label: t.nav.home, icon: Bus, roles: null },
    { href: '/map', label: t.nav.map, icon: MapPin, roles: null },
    { href: '/lines', label: t.nav.lines, icon: Route, roles: null },
    { href: '/stations', label: t.nav.stations, icon: MapPin, roles: null },
    { href: '/news', label: t.nav.news, icon: Newspaper, roles: null },
    { href: '/contact', label: t.nav.contact, icon: Phone, roles: null },
    { href: '/about', label: t.nav.about, icon: Info, roles: null },
    { href: '/driver', label: t.nav.driver, icon: Car, roles: ['driver'] },
    { href: '/admin', label: t.nav.admin, icon: LayoutDashboard, roles: ['admin', 'super_admin'] },
  ].filter((item) => item.roles === null || (role && item.roles.includes(role)));

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // ✅ عرض اسم المستخدم أو البريد الإلكتروني
  const displayName = profile?.full_name || profile?.email || '';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled ? 'glass border-b border-border/40 shadow-sm' : 'bg-transparent'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Bus className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight">SmartBus</span>
              <span className="text-[10px] text-muted-foreground">
                {locale === 'ar' ? 'النقل الذكي' : 'Transport Intelligent'}
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocale(locale === 'ar' ? 'fr' : 'ar')}
              className="h-9 w-9"
              title={locale === 'ar' ? 'Français' : 'العربية'}
            >
              <Globe className="h-4 w-4" />
              <span className="ml-1 text-xs font-bold">{locale === 'ar' ? 'FR' : 'ع'}</span>
            </Button>

            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-9 w-9"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}

            {/* ✅ عرض معلومات المستخدم */}
            {profile ? (
              <div className="hidden items-center gap-1 sm:flex">
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <User className="h-4 w-4" />
                    <span className="max-w-[100px] truncate font-medium">
                      {displayName}
                    </span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9" title={t.nav.logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link href="/auth" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <LogIn className="h-4 w-4" />
                  {t.nav.login}
                </Button>
              </Link>
            )}

            {/* Menu Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/40 glass lg:hidden"
          >
            <nav className="container mx-auto flex flex-col gap-1 px-4 py-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              {profile ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                  >
                    <User className="h-4 w-4" />
                    {displayName}
                  </Link>
                  <button
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  <LogIn className="h-4 w-4" />
                  {t.nav.login}
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}