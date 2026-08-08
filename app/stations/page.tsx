// app/stations/page.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search, MapPinned, Bus, Route } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { useStations, useLines } from '@/hooks/use-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Station } from '@/lib/types';

export default function StationsPage() {
  const { t, locale } = useI18n();
  const { stations, loading } = useStations();
  const { lines } = useLines();
  const [search, setSearch] = useState('');

  // الحصول على الخطوط التي تمر بالمحطة
  const getStationLines = (stationId: string) => {
    return lines.filter(line => 
      line.waypoints?.some((wp: any) => wp.station_id === stationId)
    );
  };

  const filtered = stations.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name_ar.includes(search) ||
      s.name_fr.toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">{t.stations.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.stations.subtitle}</p>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Route className="h-4 w-4" />
          <span>{stations.length} {locale === 'ar' ? 'محطة' : 'stations'}</span>
          <span className="mx-1">•</span>
          <Bus className="h-4 w-4" />
          <span>{lines.length} {locale === 'ar' ? 'خط' : 'lignes'}</span>
        </div>
      </div>

      <div className="mx-auto mb-8 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.stations.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((station: Station, i) => {
          const stationLines = getStationLines(station.id);
          return (
            <motion.div
              key={station.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <Card className="h-full p-5 transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{locale === 'ar' ? station.name_ar : station.name_fr}</h3>
                      <div className="text-xs text-muted-foreground">{station.code}</div>
                    </div>
                  </div>
                  {station.has_shelter && (
                    <Badge variant="secondary" className="text-xs">{t.stations.shelter}</Badge>
                  )}
                </div>
                
                {/* عرض الخطوط التي تمر بالمحطة */}
                {stationLines.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {stationLines.map((line) => (
                      <Badge 
                        key={line.id} 
                        style={{ 
                          backgroundColor: line.color + '20', 
                          color: line.color,
                          borderColor: line.color + '40'
                        }}
                        variant="outline"
                        className="text-xs"
                      >
                        <span className="h-2 w-2 rounded-full mr-1" style={{ backgroundColor: line.color }} />
                        {line.number}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {station.lat.toFixed(4)}, {station.lng.toFixed(4)}
                  </span>
                  {/* تم إزالة رابط الخريطة */}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center text-muted-foreground">
          {locale === 'ar' ? 'لا توجد محطات مطابقة للبحث' : 'Aucune station correspondant à la recherche'}
        </div>
      )}
    </div>
  );
}