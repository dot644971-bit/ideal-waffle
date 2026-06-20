import { Suspense } from 'react';
import SeriesClientPage from './SeriesClientPage';

export default function SeriesPage() {
  return (
    <Suspense fallback={null}>
      <SeriesClientPage />
    </Suspense>
  );
}
