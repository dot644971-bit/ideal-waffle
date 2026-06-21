import { Suspense } from 'react';
import SeriesClientPage from './SeriesClientPage';

export default function SeriesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a' }} />}>
      <SeriesClientPage />
    </Suspense>
  );
}
