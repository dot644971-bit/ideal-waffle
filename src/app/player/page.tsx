import { Suspense } from 'react';
import PlayerClientPage from './PlayerClientPage';

export default function PlayerPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a' }} />}>
      <PlayerClientPage />
    </Suspense>
  );
}
