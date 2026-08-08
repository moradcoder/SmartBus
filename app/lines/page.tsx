'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Route, MapPin } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useLines } from '@/hooks/use-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LinesPage() {
  const { t, locale, dir } = useI18n();
  const { lines, loading } = useLines();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">{t.lines.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.lines.subtitle}</p>
      </div>

      {lines.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">{t.lines.noLines}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lines.map((line, i) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="h-full overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
                <div className="h-2 w-full" style={{ backgroundColor: line.color }} />
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-white font-bold text-xl"
                      style={{ backgroundColor: line.color }}
                    >
                      {line.number.replace('L', '')}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold leading-tight">
                        {locale === 'ar' ? line.name_ar : line.name_fr}
                      </h3>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}