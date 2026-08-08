// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
  swcMinify: true,
  // Exposer les variables d'environnement au client (si nécessaire)
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // SUPABASE_SERVICE_ROLE_KEY ne doit JAMAIS être exposée au client !
  },
  // إزالة خاصية onError نهائياً
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: true,
  },
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizeCss: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // إضافة إعدادات لمنع أخطاء الخطوط
  optimizeFonts: false, // تعطيل تحسين الخطوط مؤقتاً
};

module.exports = nextConfig;