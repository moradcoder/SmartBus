'use client';

import { motion } from 'framer-motion';
import { Newspaper, AlertCircle, Info, Clock } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useAnnouncements } from '@/hooks/use-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function NewsPage() {
  const { t, locale } = useI18n();
  const { announcements, loading } = useAnnouncements();

  const typeConfig: Record<string, { icon: typeof Info; variant: 'default' | 'destructive' | 'secondary' }> = {
    news: { icon: Newspaper, variant: 'default' },
    alert: { icon: AlertCircle, variant: 'destructive' },
    info: { icon: Info, variant: 'secondary' },
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 text-center"
      >
        <h1 className="text-3xl font-bold md:text-4xl">{t.news.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.news.subtitle}</p>
      </motion.div>

      {announcements.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">{t.news.noNews}</div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {announcements.map((ann, i) => {
            const config = typeConfig[ann.type] || typeConfig.info;
            const Icon = config.icon;
            return (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              >
                <Card className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      ann.type === 'alert' ? 'bg-destructive/10' : ann.type === 'news' ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Icon className={`h-6 w-6 ${
                        ann.type === 'alert' ? 'text-destructive' : ann.type === 'news' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={config.variant}>
                          {t.news[ann.type as keyof typeof t.news] || ann.type}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(ann.published_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                        </span>
                      </div>
                      <h3 className="mb-2 font-semibold text-lg">
                        {locale === 'ar' ? ann.title_ar : ann.title_fr}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {locale === 'ar' ? ann.body_ar : ann.body_fr}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
