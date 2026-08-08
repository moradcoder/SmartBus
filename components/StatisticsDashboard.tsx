// app/admin/components/StatisticsDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, RadialBarChart, RadialBar, ScatterChart,
  Scatter, ZAxis, ComposedChart
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useI18n } from '@/lib/i18n-context';
import { supabase } from '@/lib/supabase/client';
import { 
  Users, Bus, Route, MapPin, TrendingUp, TrendingDown,
  Clock, Calendar, AlertCircle, CheckCircle, Activity,
  BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  ArrowUp, ArrowDown, Minus, Circle, Dot
} from 'lucide-react';
import type { Bus as BusType, Driver, Report, ActivityLog, BusLine, Station } from '@/lib/types';

interface StatisticsData {
  // Données pour les graphiques
  dailyActivity: { date: string; buses: number; drivers: number; reports: number }[];
  busStatusDistribution: { name: string; value: number; color: string }[];
  driverStatusDistribution: { name: string; value: number; color: string }[];
  reportStatusDistribution: { name: string; value: number; color: string }[];
  lineUsage: { name: string; buses: number; stations: number; color: string }[];
  weeklyTrend: { day: string; active: number; total: number }[];
  hourlyActivity: { hour: string; trips: number; users: number }[];
  performanceMetrics: {
    name: string;
    value: number;
    target: number;
    color: string;
    icon: React.ReactNode;
  }[];
  recentActivity: ActivityLog[];
  topStations: { name: string; visits: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const RADIAL_COLORS = [
  '#3b82f6', '#60a5fa', '#93c5fd',
  '#10b981', '#34d399', '#6ee7b7',
  '#f59e0b', '#fbbf24', '#fcd34d'
];

export default function StatisticsDashboard() {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatisticsData>({
    dailyActivity: [],
    busStatusDistribution: [],
    driverStatusDistribution: [],
    reportStatusDistribution: [],
    lineUsage: [],
    weeklyTrend: [],
    hourlyActivity: [],
    performanceMetrics: [],
    recentActivity: [],
    topStations: [],
  });
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    fetchStatistics();
  }, [timeRange]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // Récupérer toutes les données nécessaires
      const [
        { data: buses },
        { data: drivers },
        { data: reports },
        { data: logs },
        { data: lines },
        { data: stations },
      ] = await Promise.all([
        supabase.from('buses').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('reports').select('*'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('lines').select('*'),
        supabase.from('stations').select('*'),
      ]);

      const busesData = (buses as unknown as BusType[]) || [];
      const driversData = (drivers as unknown as Driver[]) || [];
      const reportsData = (reports as unknown as Report[]) || [];
      const logsData = (logs as unknown as ActivityLog[]) || [];
      const linesData = (lines as unknown as BusLine[]) || [];
      const stationsData = (stations as unknown as Station[]) || [];

      // 1. Distribution des bus par statut
      const busStatusCounts = {
        active: busesData.filter(b => b.status === 'active').length,
        maintenance: busesData.filter(b => b.status === 'maintenance').length,
        offline: busesData.filter(b => b.status === 'offline').length,
      };
      const busStatusDistribution = [
        { name: locale === 'ar' ? 'نشط' : 'Actif', value: busStatusCounts.active, color: COLORS[0] },
        { name: locale === 'ar' ? 'صيانة' : 'Maintenance', value: busStatusCounts.maintenance, color: COLORS[2] },
        { name: locale === 'ar' ? 'غير متصل' : 'Hors ligne', value: busStatusCounts.offline, color: COLORS[3] },
      ].filter(d => d.value > 0);

      // 2. Distribution des conducteurs par statut
      const driverStatusCounts = {
        on_duty: driversData.filter(d => d.status === 'on_duty').length,
        in_service: driversData.filter(d => d.status === 'in_service').length,
        break: driversData.filter(d => d.status === 'break').length,
        off_duty: driversData.filter(d => d.status === 'off_duty').length,
      };
      const driverStatusDistribution = [
        { name: locale === 'ar' ? 'في الخدمة' : 'En service', value: driverStatusCounts.on_duty + driverStatusCounts.in_service, color: COLORS[1] },
        { name: locale === 'ar' ? 'استراحة' : 'Pause', value: driverStatusCounts.break, color: COLORS[2] },
        { name: locale === 'ar' ? 'غير متصل' : 'Hors service', value: driverStatusCounts.off_duty, color: COLORS[3] },
      ].filter(d => d.value > 0);

      // 3. Distribution des rapports
      const reportStatusCounts = {
        open: reportsData.filter(r => r.status === 'open').length,
        in_progress: reportsData.filter(r => r.status === 'in_progress').length,
        resolved: reportsData.filter(r => r.status === 'resolved').length,
      };
      const reportStatusDistribution = [
        { name: locale === 'ar' ? 'مفتوح' : 'Ouvert', value: reportStatusCounts.open, color: COLORS[3] },
        { name: locale === 'ar' ? 'قيد المعالجة' : 'En cours', value: reportStatusCounts.in_progress, color: COLORS[2] },
        { name: locale === 'ar' ? 'تم الحل' : 'Résolu', value: reportStatusCounts.resolved, color: COLORS[1] },
      ].filter(d => d.value > 0);

      // 4. Utilisation des lignes
      const lineUsage = linesData.map(line => ({
        name: locale === 'ar' ? line.name_ar : line.name_fr,
        buses: busesData.filter(b => b.line_id === line.id).length,
        stations: stationsData.filter(s => s.line_id === line.id).length,
        color: line.color || COLORS[Math.floor(Math.random() * COLORS.length)],
      })).filter(l => l.buses > 0 || l.stations > 0);

      // 5. Données hebdomadaires simulées (dans un cas réel, on prendrait les données de la base)
      const days = locale === 'ar' 
        ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
        : ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      
      const weeklyTrend = days.map((day, i) => ({
        day,
        active: Math.floor(Math.random() * 30) + 10 + i * 2,
        total: Math.floor(Math.random() * 15) + 30 + i,
      }));

      // 6. Activité horaire simulée
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const hourlyActivity = hours.map(hour => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        trips: Math.floor(Math.random() * 50) + (hour >= 6 && hour <= 9 ? 40 : hour >= 17 && hour <= 20 ? 35 : 10),
        users: Math.floor(Math.random() * 30) + (hour >= 6 && hour <= 9 ? 30 : hour >= 17 && hour <= 20 ? 25 : 5),
      }));

      // 7. Métriques de performance
      const performanceMetrics = [
        {
          name: locale === 'ar' ? 'معدل التشغيل' : 'Taux d\'opération',
          value: busesData.length > 0 ? (busStatusCounts.active / busesData.length) * 100 : 0,
          target: 90,
          color: COLORS[0],
          icon: <Bus className="h-4 w-4" />,
        },
        {
          name: locale === 'ar' ? 'معدل النشاط' : 'Taux d\'activité',
          value: driversData.length > 0 ? ((driverStatusCounts.on_duty + driverStatusCounts.in_service) / driversData.length) * 100 : 0,
          target: 85,
          color: COLORS[1],
          icon: <Users className="h-4 w-4" />,
        },
        {
          name: locale === 'ar' ? 'معدل الحل' : 'Taux de résolution',
          value: reportsData.length > 0 ? (reportStatusCounts.resolved / reportsData.length) * 100 : 0,
          target: 80,
          color: COLORS[2],
          icon: <CheckCircle className="h-4 w-4" />,
        },
        {
          name: locale === 'ar' ? 'تغطية المحطات' : 'Couverture des stations',
          value: linesData.length > 0 ? Math.min((stationsData.length / (linesData.length * 5)) * 100, 100) : 0,
          target: 70,
          color: COLORS[4],
          icon: <MapPin className="h-4 w-4" />,
        },
      ];

      // 8. Top stations (simulé)
      const topStations = stationsData.slice(0, 5).map((station, i) => ({
        name: locale === 'ar' ? station.name_ar : station.name_fr,
        visits: Math.floor(Math.random() * 1000) + 100 - i * 30,
      }));

      setData({
        dailyActivity: [],
        busStatusDistribution,
        driverStatusDistribution,
        reportStatusDistribution,
        lineUsage,
        weeklyTrend,
        hourlyActivity,
        performanceMetrics,
        recentActivity: logsData,
        topStations: topStations.length > 0 ? topStations : [
          { name: locale === 'ar' ? 'محطة المركز' : 'Station Centre', visits: 856 },
          { name: locale === 'ar' ? 'محطة المدينة' : 'Station Ville', visits: 723 },
          { name: locale === 'ar' ? 'محطة الجامعة' : 'Station Université', visits: 645 },
        ],
      });

    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((p: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: p.color || p.fill }}>
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Métriques de performance avec jauges radiales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {data.performanceMetrics.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="glass">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.name}
                  </CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {metric.icon}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {metric.value.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {locale === 'ar' ? 'هدف' : 'Objectif'}: {metric.target}%
                    </div>
                  </div>
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {metric.value.toFixed(0)}%
                    </div>
                    <svg className="h-16 w-16 -rotate-90 transform">
                      <circle
                        className="stroke-muted"
                        strokeWidth="6"
                        fill="none"
                        r="28"
                        cx="32"
                        cy="32"
                      />
                      <circle
                        className="transition-all duration-1000"
                        strokeWidth="6"
                        strokeLinecap="round"
                        fill="none"
                        r="28"
                        cx="32"
                        cy="32"
                        stroke={metric.color}
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={2 * Math.PI * 28 * (1 - metric.value / 100)}
                      />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Graphiques principaux */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Distribution des bus */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bus className="h-4 w-4 text-primary" />
                {locale === 'ar' ? 'توزيع الحافلات' : 'Distribution des bus'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'حالة الحافلات الحالية' : 'Statut actuel des bus'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.busStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.busStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Distribution des conducteurs */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                {locale === 'ar' ? 'توزيع السائقين' : 'Distribution des chauffeurs'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'حالة السائقين الحالية' : 'Statut actuel des chauffeurs'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.driverStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.driverStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tendance hebdomadaire */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              {locale === 'ar' ? 'النشاط الأسبوعي' : 'Activité hebdomadaire'}
            </CardTitle>
            <CardDescription>
              {locale === 'ar' ? 'عدد الحافلات النشطة خلال الأسبوع' : 'Nombre de bus actifs par jour'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="active"
                  name={locale === 'ar' ? 'نشط' : 'Actif'}
                  fill={COLORS[0]}
                  barSize={20}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name={locale === 'ar' ? 'الإجمالي' : 'Total'}
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[1] }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Distribution des rapports et utilisation des lignes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-primary" />
                {locale === 'ar' ? 'حالة البلاغات' : 'Statut des rapports'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'توزيع البلاغات حسب الحالة' : 'Distribution des rapports par statut'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.reportStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.reportStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Route className="h-4 w-4 text-primary" />
                {locale === 'ar' ? 'استخدام الخطوط' : 'Utilisation des lignes'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'عدد الحافلات والمحطات لكل خط' : 'Nombre de bus et stations par ligne'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.lineUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" width={60} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="buses"
                    name={locale === 'ar' ? 'حافلات' : 'Bus'}
                    fill={COLORS[0]}
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="stations"
                    name={locale === 'ar' ? 'محطات' : 'Stations'}
                    fill={COLORS[1]}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activité horaire et top stations */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="md:col-span-2"
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                {locale === 'ar' ? 'النشاط حسب الساعة' : 'Activité horaire'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'عدد الرحلات والمستخدمين خلال اليوم' : 'Nombre de trajets et utilisateurs par heure'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" interval={3} className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="trips"
                    name={locale === 'ar' ? 'رحلات' : 'Trajets'}
                    stackId="1"
                    stroke={COLORS[0]}
                    fill={COLORS[0]}
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    name={locale === 'ar' ? 'مستخدمين' : 'Utilisateurs'}
                    stackId="1"
                    stroke={COLORS[1]}
                    fill={COLORS[1]}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                {locale === 'ar' ? 'أكثر المحطات زيارة' : 'Stations les plus visitées'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' ? 'عدد الزيارات' : 'Nombre de visites'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topStations.map((station, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{station.name}</div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full transition-all duration-1000"
                          style={{
                            width: `${(station.visits / (data.topStations[0]?.visits || 1)) * 100}%`,
                            backgroundColor: RADIAL_COLORS[index % RADIAL_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{station.visits}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activité récente */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-primary" />
              {locale === 'ar' ? 'النشاط الأخير' : 'Activité récente'}
            </CardTitle>
            <CardDescription>
              {locale === 'ar' ? 'آخر الإجراءات في النظام' : 'Dernières actions du système'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentActivity.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {locale === 'ar' ? 'لا توجد نشاطات حديثة' : 'Aucune activité récente'}
                </div>
              ) : (
                data.recentActivity.map((log, index) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg border border-border/40 p-2 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{log.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.actor} {log.target ? `→ ${log.target}` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}