import './globals.css';

import type { Metadata } from 'next';

import { Providers } from './providers';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

import AIAssistantWidget from '@/components/ai/ai-assistant-widget';

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
    <html lang="ar" dir="rtl">
      <body className="font-sans">
        <Providers>
          <Header />

          <main>{children}</main>

          <Footer />

          <AIAssistantWidget locale="ar" />
        </Providers>
      </body>
    </html>
  );
}