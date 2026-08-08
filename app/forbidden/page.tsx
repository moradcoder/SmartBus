'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldX, Home } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold text-destructive">403</h1>
        <h2 className="mt-2 text-xl font-semibold">{t.forbidden.title}</h2>
        <p className="mt-2 text-muted-foreground">{t.forbidden.message}</p>
        <Link href="/" className="mt-6 inline-block">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            {t.forbidden.goHome}
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
