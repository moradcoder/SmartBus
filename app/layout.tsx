import './globals.css';

import type { Metadata } from 'next';

import {
  Inter,
  Cairo,
} from 'next/font/google';

import { Providers } from './providers';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

import AIAssistantWidget from '@/components/ai/ai-assistant-widget';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'SmartBus — منصة النقل الحضري الذكي',

  description:
    'SmartBus — Plateforme intelligente de gestion et suivi du transport urbain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
    >
      <body
        className={`${inter.variable} ${cairo.variable} font-sans`}
      >
        <Providers>
          <Header />

          <main>
            {children}
          </main>

          <Footer />

          <AIAssistantWidget locale="ar" />
        </Providers>
      </body>
    </html>
  );
}