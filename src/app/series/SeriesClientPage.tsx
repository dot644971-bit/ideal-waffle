'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import SeriesPage from '@/components/Series';

export default function SeriesClientPage() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') || '';
  const setPageParams = useAppStore((s) => s.setPageParams);

  useEffect(() => {
    if (slug) {
      setPageParams({ slug });
    }
  }, [slug, setPageParams]);

  return <SeriesPage />;
}
