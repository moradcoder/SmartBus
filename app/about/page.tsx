'use client';

import { motion } from 'framer-motion';
import { Info, MapPin, Navigation, Sparkles, LayoutDashboard, Globe, Wifi } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { Card } from '@/components/ui/card';

export default function AboutPage() {
  const { t, locale } = useI18n();

  const features = [
    { icon: MapPin, text: t.about.feature1 },
    { icon: Navigation, text: t.about.feature2 },
    { icon: Sparkles, text: t.about.feature3 },
    { icon: LayoutDashboard, text: t.about.feature4 },
    { icon: Globe, text: t.about.feature5 },
    { icon: Wifi, text: t.about.feature6 },
  ];

  const techs = ['Next.js 15', 'React', 'TypeScript', 'Tailwind CSS', 'shadcn/ui', 'Framer Motion', 'Leaflet', 'Supabase', 'PostgreSQL'];

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Info className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold md:text-4xl">{t.about.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{t.about.subtitle}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mx-auto mt-8 max-w-3xl"
      >
        <Card className="p-6">
          <p className="leading-relaxed text-muted-foreground">{t.about.description}</p>
        </Card>
      </motion.div>

      <div className="mx-auto mt-12 max-w-4xl">
        <h2 className="mb-6 text-center text-2xl font-bold">{t.about.features}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="h-full p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{feature.text}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-2xl text-center">
        <h2 className="mb-4 text-xl font-bold">{t.about.tech}</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {techs.map((tech) => (
            <span key={tech} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
