// app/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, Route, Bus, Zap, ArrowLeft, ArrowRight, 
  Clock, MapPinned, Navigation, Sparkles, Bot, 
  WifiOff, BarChart3, Shield, Globe, Smartphone 
} from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useStats, useAnnouncements } from '@/hooks/use-data';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  const { t, locale, dir } = useI18n();
  const { stats } = useStats();
  const { announcements } = useAnnouncements();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  // ✅ جلب المحطات مباشرة من قاعدة البيانات
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  
  // ✅ جلب الخطوط مباشرة من قاعدة البيانات
  const [lines, setLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  
  // ✅ إحصائيات
  const [totalStations, setTotalStations] = useState(0);
  const [activeBuses, setActiveBuses] = useState(0);
  const [totalLines, setTotalLines] = useState(0);

  // ✅ جلب جميع البيانات مباشرة
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // 1. جلب المحطات النشطة
        const { data: stationsData, count: stationsCount } = await supabase
          .from('stations')
          .select('*, line:lines(id, number, name_ar, name_fr, color)', { count: 'exact' })
          .eq('status', 'active')
          .order('name_ar');

        if (stationsData) {
          setStations(stationsData);
          setTotalStations(stationsCount || stationsData.length || 0);
        }

        // 2. جلب الحافلات النشطة
        const { data: busesData, count: busesCount } = await supabase
          .from('buses')
          .select('*', { count: 'exact' })
          .eq('status', 'active');

        setActiveBuses(busesCount || busesData?.length || 0);

        // 3. جلب الخطوط النشطة
        const { data: linesData, count: linesCount } = await supabase
          .from('lines')
          .select('*', { count: 'exact' })
          .eq('status', 'active')
          .order('number');

        console.log('✅ Lines fetched:', linesData);

        if (linesData) {
          setLines(linesData);
          setTotalLines(linesCount || linesData.length || 0);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoadingStations(false);
        setLoadingLines(false);
      }
    };

    fetchAllData();
  }, []);

  // ✅ استخدام stats من hook مع تحديث يدوي
  const displayStats = {
    activeBuses: stats.activeBuses || activeBuses || 0,
    totalLines: stats.totalLines || totalLines || 0,
    totalStations: stats.totalStations || totalStations || 0,
    totalBuses: stats.totalBuses || 0,
  };

  const statCards = [
    { icon: Bus, label: t.home.liveBuses, value: displayStats.activeBuses, color: 'text-primary', bg: 'bg-primary/10' },
    { icon: Route, label: t.home.totalLines, value: displayStats.totalLines, color: 'text-success', bg: 'bg-success/10' },
    { icon: MapPin, label: t.home.totalStations, value: displayStats.totalStations, color: 'text-warning', bg: 'bg-warning/10' },
    { icon: Zap, label: t.home.fleetStatus, value: `${Math.round((displayStats.activeBuses / Math.max(displayStats.totalBuses, 1)) * 100)}%`, color: 'text-destructive', bg: 'bg-destructive/10' },
  ];

  const steps = [
    { icon: Route, title: t.home.step1, desc: t.home.step1Desc },
    { icon: Navigation, title: t.home.step2, desc: t.home.step2Desc },
    { icon: MapPinned, title: t.home.step3, desc: t.home.step3Desc },
  ];

  // ✅ عرض المحطات المميزة (أول 6 محطات)
  const featuredStations = stations.slice(0, 6);

  // ✅ عرض الخطوط النشطة
  const activeLines = lines || [];

  console.log('✅ Active lines count:', activeLines.length);
  console.log('✅ Lines data:', lines);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.12),transparent_50%)]" />
        <div className="container relative mx-auto px-4 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Sparkles className="h-3 w-3" />
              {locale === 'ar' ? 'مدعوم بالذكاء الاصطناعي' : 'Propulsé par l\'IA'}
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
              {t.home.heroTitle}
            </h1>
            <p className="mt-4 text-balance text-lg text-muted-foreground md:text-xl">
              {t.home.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/map">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <MapPin className="h-5 w-5" />
                  {t.home.exploreMap}
                  <Arrow className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/lines">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                  <Route className="h-5 w-5" />
                  {t.home.viewLines}
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4"
          >
            {statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Card key={i} className="relative overflow-hidden p-5">
                  <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </Card>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ✅ قسم الخطوط المميزة - بدون روابط */}
      <section className="py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl flex items-center gap-2">
                <Route className="h-6 w-6 text-primary" />
                {locale === 'ar' ? 'الخطوط المميزة' : 'Lignes populaires'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'ar' ? 'اختر خطك المفضل للتنقل' : 'Choisissez votre ligne préférée'}
              </p>
            </div>
            {/* ✅ تم إزالة زر "عرض الكل" */}
          </div>

          {loadingLines ? (
            <div className="text-center py-8">
              <div className="animate-pulse flex justify-center">
                <div className="w-12 h-12 rounded-full bg-muted"></div>
              </div>
              <p className="text-muted-foreground mt-2">
                {locale === 'ar' ? 'جاري تحميل الخطوط...' : 'Chargement des lignes...'}
              </p>
            </div>
          ) : activeLines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Route className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
              <p>{locale === 'ar' ? 'لا توجد خطوط متاحة حالياً' : 'Aucune ligne disponible'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {activeLines.slice(0, 8).map((line, i) => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  {/* ✅ إزالة Link - عرض البطاقة فقط */}
                  <Card className="group h-full cursor-default p-4 transition-all hover:shadow-lg hover:-translate-y-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl text-white font-bold text-lg flex-shrink-0"
                        style={{ backgroundColor: line.color || '#3B82F6' }}
                      >
                        {line.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {locale === 'ar' ? line.name_ar : line.name_fr}
                        </div>
                      
                      </div>
                      <Badge variant="default" className="flex-shrink-0">
                        {locale === 'ar' ? 'نشط' : 'Actif'}
                      </Badge>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ✅ قسم المحطات الرئيسية - بدون روابط */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl flex items-center gap-2">
                <MapPin className="h-6 w-6 text-primary" />
                {locale === 'ar' ? 'المحطات الرئيسية' : 'Stations principales'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'ar' ? 'اكتشف المحطات الرئيسية في المدينة' : 'Découvrez les principales stations'}
              </p>
            </div>
            {/* ✅ تم إزالة زر "عرض الكل" */}
          </div>

          {loadingStations ? (
            <div className="text-center py-8">
              <div className="animate-pulse flex justify-center">
                <div className="w-12 h-12 rounded-full bg-muted"></div>
              </div>
              <p className="text-muted-foreground mt-2">
                {locale === 'ar' ? 'جاري تحميل المحطات...' : 'Chargement des stations...'}
              </p>
            </div>
          ) : stations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
              <p>{locale === 'ar' ? 'لا توجد محطات متاحة حالياً' : 'Aucune station disponible'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {featuredStations.map((station, i) => (
                <motion.div
                  key={station.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  {/* ✅ إزالة Link - عرض البطاقة فقط */}
                  <Card className="group h-full cursor-default p-4 transition-all hover:shadow-lg hover:-translate-y-1">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0">
                        {station.type === 'bus' ? '🚌' : station.type === 'tram' ? '🚋' : '🚆'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {locale === 'ar' ? station.name_ar : station.name_fr}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {locale === 'ar' 
                            ? (station.address_ar || 'بدون عنوان') 
                            : (station.address_fr || 'Sans adresse')
                          }
                        </div>
                        {station.line && (
                          <div className="flex items-center gap-1 mt-1">
                            <span 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: station.line.color || '#3B82F6' }} 
                            />
                            <span className="text-xs text-muted-foreground">
                              {station.line.number} - {locale === 'ar' ? station.line.name_ar : station.line.name_fr}
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge variant="default" className="flex-shrink-0 text-[10px]">
                        {station.type === 'bus' ? '🚌' : station.type === 'tram' ? '🚋' : '🚆'}
                      </Badge>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border/40 bg-card/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-2 text-center text-2xl font-bold md:text-3xl">{t.home.howItWorks}</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <Card className="h-full p-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="mb-2 text-sm font-bold text-primary">0{i + 1}</div>
                    <h3 className="mb-2 font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why SmartBus? */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container relative mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Sparkles className="h-3 w-3" />
              {locale === 'ar' ? 'المميزات' : 'Fonctionnalités'}
            </Badge>
            <h2 className="text-balance text-3xl font-bold md:text-4xl">{t.why.title}</h2>
            <p className="mt-3 text-balance text-muted-foreground md:text-lg">{t.why.subtitle}</p>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MapPin, title: t.why.liveTracking, desc: t.why.liveTrackingDesc, color: 'from-sky-500/20 to-sky-500/5', iconBg: 'bg-sky-500/10 text-sky-500' },
              { icon: Bot, title: t.why.aiAssistant, desc: t.why.aiAssistantDesc, color: 'from-primary/20 to-primary/5', iconBg: 'bg-primary/10 text-primary' },
              { icon: WifiOff, title: t.why.offlineSupport, desc: t.why.offlineSupportDesc, color: 'from-success/20 to-success/5', iconBg: 'bg-success/10 text-success' },
              { icon: BarChart3, title: t.why.analytics, desc: t.why.analyticsDesc, color: 'from-warning/20 to-warning/5', iconBg: 'bg-warning/10 text-warning' },
              { icon: Shield, title: t.why.secure, desc: t.why.secureDesc, color: 'from-destructive/20 to-destructive/5', iconBg: 'bg-destructive/10 text-destructive' },
              { icon: Globe, title: t.why.multiLang, desc: t.why.multiLangDesc, color: 'from-primary/20 to-primary/5', iconBg: 'bg-primary/10 text-primary' },
              { icon: Zap, title: t.why.realtime, desc: t.why.realtimeDesc, color: 'from-amber-500/20 to-amber-500/5', iconBg: 'bg-amber-500/10 text-amber-500' },
              { icon: Smartphone, title: t.why.mobile, desc: t.why.mobileDesc, color: 'from-sky-500/20 to-sky-500/5', iconBg: 'bg-sky-500/10 text-sky-500' },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: (i % 4) * 0.1 }}
                  whileHover={{ y: -6 }}
                >
                  <Card className={`glass group h-full overflow-hidden p-5 transition-all hover:shadow-xl bg-gradient-to-br ${feature.color}`}>
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg} transition-transform group-hover:scale-110`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 font-semibold text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Latest News - بدون رابط */}
      {announcements && announcements.length > 0 && (
        <section className="border-t border-border/40 bg-card/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold md:text-3xl">{t.home.latestNews}</h2>
              {/* ✅ تم إزالة زر "عرض الكل" */}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {announcements.slice(0, 3).map((ann, i) => (
                <motion.div
                  key={ann.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <Card className="h-full p-5">
                    <Badge
                      variant={ann.type === 'alert' ? 'destructive' : ann.type === 'news' ? 'default' : 'secondary'}
                      className="mb-3"
                    >
                      {ann.type === 'alert' ? '⚠️ ' : ann.type === 'news' ? '📰 ' : 'ℹ️ '}
                      {locale === 'ar' 
                        ? (ann.type === 'alert' ? 'تنبيه' : ann.type === 'news' ? 'خبر' : 'معلومة')
                        : (ann.type === 'alert' ? 'Alerte' : ann.type === 'news' ? 'Actualité' : 'Info')}
                    </Badge>
                    <h3 className="mb-2 font-semibold">{locale === 'ar' ? ann.title_ar : ann.title_fr}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {locale === 'ar' ? ann.body_ar : ann.body_fr}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(ann.published_at || ann.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}